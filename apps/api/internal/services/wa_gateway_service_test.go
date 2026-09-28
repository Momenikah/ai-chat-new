package services

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/wagateway"
)

type recordingBroadcaster struct {
	mu     sync.Mutex
	events []string
}

func (b *recordingBroadcaster) Broadcast(_ string, ev realtime.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = append(b.events, ev.Type)
}

type fakeLimits struct{ max int }

func (f fakeLimits) EnsureFeature(context.Context, string, string) error { return nil }
func (f fakeLimits) RetentionCutoff(context.Context, string) *time.Time  { return nil }
func (f fakeLimits) EnsureCanAdd(_ context.Context, _, _ string, current int) error {
	if current >= f.max {
		return ErrPlanLimitReached
	}
	return nil
}

// Integration test against a migrated Postgres (TEST_DATABASE_URL).
func TestGatewayServiceEndToEnd(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	// Fake StarSender endpoint.
	var mu sync.Mutex
	var sent []map[string]any
	var sentAuth string
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		mu.Lock()
		sent = append(sent, body)
		sentAuth = r.Header.Get("Authorization")
		mu.Unlock()
		_, _ = io.WriteString(w, `{"success":true,"data":{"id":"out-1"}}`)
	}))
	defer gw.Close()

	users := repositories.NewUserRepository(pool)
	workspaces := repositories.NewWorkspaceRepository(pool)
	channels := repositories.NewChannelRepository(pool)
	contacts := repositories.NewContactRepository(pool)
	conversations := repositories.NewConversationRepository(pool)
	messages := repositories.NewMessageRepository(pool)
	enc, _ := crypto.NewEncryptor("test-secret")
	hub := &recordingBroadcaster{}

	suffix := uuid.NewString()[:8]
	owner, err := users.Create(ctx, repositories.CreateUserParams{
		Name: "Owner", Email: "gw-" + suffix + "@example.test", PasswordHash: "x"})
	if err != nil {
		t.Fatal(err)
	}
	ws, err := workspaces.Create(ctx, repositories.CreateWorkspaceParams{
		Name: "GW", Slug: "gw-" + suffix, OwnerID: owner.ID, BrandColor: "#000", Timezone: "Asia/Jakarta"})
	if err != nil {
		t.Fatal(err)
	}

	svc := NewGatewayService(channels, contacts, conversations, messages, nil,
		repositories.NewWebhookLogRepository(pool), enc,
		wagateway.NewClient(gw.Client(), gw.URL+"/api/send"), hub, "https://api.example.test", false)
	svc.retryDelays = nil // fail fast in tests
	svc.SetPlanEnforcer(fakeLimits{max: 1})

	// --- Connect --------------------------------------------------------
	info, err := svc.Connect(ctx, GatewayConnectInput{
		WorkspaceID: ws.ID, Provider: wagateway.ProviderStarSender,
		Name: "WA Toko", APIKey: "device-key-1234", PhoneNumber: "0811-111",
	})
	if err != nil {
		t.Fatal(err)
	}
	ch := info.Channel
	if ch.Type != models.ChannelStarSender || ch.Status != models.StatusPending ||
		ch.ExternalID == nil || *ch.ExternalID != "62811111" || info.APIKeyHint != "••••1234" {
		t.Fatalf("unexpected connect result: %+v channel=%+v", info, ch)
	}
	creds, _ := wagateway.LoadCredentials(ctx, channels, enc, ch.ID)
	token := creds.WebhookToken
	if info.WebhookURL != "https://api.example.test/api/webhooks/wa-gateway/"+ch.ID+"/"+token {
		t.Fatalf("webhook url = %s", info.WebhookURL)
	}

	// Re-keying by channel id keeps the channel and webhook token.
	again, err := svc.Connect(ctx, GatewayConnectInput{
		WorkspaceID: ws.ID, Provider: wagateway.ProviderStarSender, ChannelID: ch.ID,
		Name: "WA Toko", APIKey: "device-key-5678",
	})
	if err != nil || again.Channel.ID != ch.ID || again.WebhookURL != info.WebhookURL {
		t.Fatalf("re-key: %+v, %v", again, err)
	}
	// A second number exceeds the (fake) plan limit of 1.
	if _, err := svc.Connect(ctx, GatewayConnectInput{
		WorkspaceID: ws.ID, Provider: wagateway.ProviderStarSender, Name: "Other", APIKey: "k", PhoneNumber: "0822",
	}); !errors.Is(err, ErrPlanLimitReached) {
		t.Fatalf("plan limit: err=%v", err)
	}
	// Tenant-supplied OneSender URL on a private network is refused.
	svc.SetPlanEnforcer(nil)
	if _, err := svc.Connect(ctx, GatewayConnectInput{
		WorkspaceID: ws.ID, Provider: wagateway.ProviderOneSender, Name: "OS", APIKey: "k",
		BaseURL: "http://169.254.169.254",
	}); !errors.Is(err, ErrGatewayPrivateURL) {
		t.Fatalf("private OneSender URL: err=%v", err)
	}

	// --- Inbound webhook ------------------------------------------------
	payload := []byte(`{"id":"in-1","from":"081234567890","pushname":"Budi","message":"Halo, stok ada?"}`)
	if _, err := svc.HandleWebhook(ctx, ch.ID, "wrong-token", payload); !errors.Is(err, ErrGatewayUnauthorized) {
		t.Fatalf("wrong token: err=%v", err)
	}
	res, err := svc.HandleWebhook(ctx, ch.ID, token, payload)
	if err != nil || res.Stored != 1 {
		t.Fatalf("webhook: %+v, %v", res, err)
	}
	// Gateways retry: the same message id must not be stored twice.
	res, err = svc.HandleWebhook(ctx, ch.ID, token, payload)
	if err != nil || res.Stored != 0 || res.Skipped != 1 {
		t.Fatalf("duplicate webhook: %+v, %v", res, err)
	}
	res, _ = svc.HandleWebhook(ctx, ch.ID, token, []byte(`[{"from":"120363@g.us","message":"grup"},{"from":"62811111","fromMe":true,"message":"echo"}]`))
	if res.Stored != 0 || res.Skipped != 2 {
		t.Fatalf("group/fromMe should be skipped: %+v", res)
	}

	contact, err := contacts.FindByExternal(ctx, ws.ID, models.ChannelWhatsApp, "6281234567890")
	if err != nil || contact.Name != "Budi" || contact.Phone == nil || *contact.Phone != "+6281234567890" {
		t.Fatalf("contact: %+v, %v", contact, err)
	}
	conv, err := conversations.FindOpenByContactChannel(ctx, ch.ID, contact.ID)
	if err != nil {
		t.Fatal(err)
	}
	msgs, _ := messages.ListByConversation(ctx, conv.ID)
	if len(msgs) != 1 || msgs[0].Direction != models.MsgInbound || *msgs[0].Body != "Halo, stok ada?" {
		t.Fatalf("inbound messages: %+v", msgs)
	}
	updated, _ := channels.GetByID(ctx, ch.ID)
	if updated.Status != models.StatusConnected || updated.LastConnectedAt == nil {
		t.Fatalf("channel not marked connected: %+v", updated)
	}

	// --- Outbound (inbox reply) ------------------------------------------
	out, err := svc.Deliver(ctx, DeliverInput{ConversationID: conv.ID, Body: "Ada kak 🙏"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Status != models.MsgSent || out.ExternalID == nil || *out.ExternalID != "gw:"+ch.ID+":out-1" {
		t.Fatalf("outbound message: %+v", out)
	}
	mu.Lock()
	last := sent[len(sent)-1]
	auth := sentAuth
	mu.Unlock()
	if last["to"] != "6281234567890" || last["body"] != "Ada kak 🙏" || auth != "device-key-5678" {
		t.Fatalf("gateway got %v auth=%q (want re-keyed key)", last, auth)
	}

	// --- Test send marks errors on the channel ---------------------------
	gw.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"success":false,"message":"Device disconnected"}`)
	})
	if err := svc.SendTest(ctx, ch.ID, "0812", "tes"); err == nil {
		t.Fatal("SendTest succeeded against a failing gateway")
	}
	updated, _ = channels.GetByID(ctx, ch.ID)
	if updated.Status != models.StatusError || updated.ErrorMessage == nil || updated.LastConnectedAt == nil {
		t.Fatalf("channel after failed test: %+v", updated)
	}

	time.Sleep(10 * time.Millisecond) // let async broadcasts settle
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if len(hub.events) == 0 {
		t.Fatal("no realtime events broadcast")
	}
}
