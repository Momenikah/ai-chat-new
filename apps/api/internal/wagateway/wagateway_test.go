package wagateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"081234567890":                    "6281234567890",
		"+62 812-3456-7890":               "6281234567890",
		"6281234567890@s.whatsapp.net":    "6281234567890",
		"6281234567890:12@s.whatsapp.net": "6281234567890",
		"6281234567890@c.us":              "6281234567890",
		"":                                "",
		"abc":                             "",
	}
	for in, want := range cases {
		if got := NormalizePhone(in); got != want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCredentialsValidateAndToken(t *testing.T) {
	tok, err := NewWebhookToken()
	if err != nil || len(tok) != 64 {
		t.Fatalf("NewWebhookToken = %q, %v", tok, err)
	}
	ok := Credentials{Provider: ProviderStarSender, APIKey: "k", WebhookToken: tok}
	if err := ok.Validate(); err != nil {
		t.Fatalf("valid StarSender creds rejected: %v", err)
	}
	if err := (Credentials{Provider: ProviderOneSender, APIKey: "k", WebhookToken: tok}).Validate(); err == nil {
		t.Fatal("OneSender without base_url accepted")
	}
	if err := (Credentials{Provider: "wablas", APIKey: "k", WebhookToken: tok}).Validate(); err == nil {
		t.Fatal("unknown provider accepted")
	}
	if !ok.TokenMatches(tok) || ok.TokenMatches(tok[:63]) || ok.TokenMatches("") {
		t.Fatal("TokenMatches gave a wrong answer")
	}
	if (Credentials{}).TokenMatches("") {
		t.Fatal("empty token must never match")
	}
}

type captured struct {
	path, auth string
	body       map[string]any
}

func fakeGateway(t *testing.T, status int, response string) (*httptest.Server, *captured) {
	t.Helper()
	c := &captured{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c.path = r.URL.Path
		c.auth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &c.body)
		w.WriteHeader(status)
		_, _ = io.WriteString(w, response)
	}))
	t.Cleanup(srv.Close)
	return srv, c
}

func TestSendOneSenderText(t *testing.T) {
	srv, got := fakeGateway(t, 200, `{"code":200,"messages":[{"id":"ABC123","to":"6281234567890"}]}`)
	client := NewClient(srv.Client(), "")
	creds := &Credentials{Provider: ProviderOneSender, BaseURL: srv.URL + "/", APIKey: "os-key", WebhookToken: "t"}

	id, err := client.Send(context.Background(), creds, Outbound{To: "0812-3456-7890", Text: "Halo"})
	if err != nil {
		t.Fatal(err)
	}
	if id != "ABC123" {
		t.Errorf("id = %q, want ABC123", id)
	}
	if got.path != "/api/v1/messages" || got.auth != "Bearer os-key" {
		t.Errorf("path=%q auth=%q", got.path, got.auth)
	}
	if got.body["to"] != "6281234567890" || got.body["type"] != "text" ||
		got.body["recipient_type"] != "individual" {
		t.Errorf("unexpected body %v", got.body)
	}
	if text, _ := got.body["text"].(map[string]any); text["body"] != "Halo" {
		t.Errorf("text.body = %v", got.body["text"])
	}
}

func TestSendOneSenderImage(t *testing.T) {
	srv, got := fakeGateway(t, 200, `{}`)
	client := NewClient(srv.Client(), "")
	creds := &Credentials{Provider: ProviderOneSender, BaseURL: srv.URL + "/api/v1/messages", APIKey: "k", WebhookToken: "t"}

	id, err := client.Send(context.Background(), creds, Outbound{
		To: "6281", Text: "Promo", MediaURL: "https://cdn.example.com/a.jpg", MediaKind: MediaImage,
	})
	if err != nil || id != "" {
		t.Fatalf("Send = %q, %v; want empty id, nil", id, err)
	}
	if got.path != "/api/v1/messages" {
		t.Errorf("full endpoint URL was doubled: path=%q", got.path)
	}
	img, _ := got.body["image"].(map[string]any)
	if got.body["type"] != "image" || img["link"] != "https://cdn.example.com/a.jpg" || img["caption"] != "Promo" {
		t.Errorf("unexpected body %v", got.body)
	}
}

func TestSendStarSender(t *testing.T) {
	srv, got := fakeGateway(t, 200, `{"success":true,"data":{"id":"ss-1"},"message":"Message sent"}`)
	client := NewClient(srv.Client(), srv.URL+"/api/send")
	creds := &Credentials{Provider: ProviderStarSender, APIKey: "device-key", WebhookToken: "t"}

	id, err := client.Send(context.Background(), creds, Outbound{To: "+62 812 000", Text: "Hi"})
	if err != nil || id != "ss-1" {
		t.Fatalf("Send = %q, %v", id, err)
	}
	if got.path != "/api/send" || got.auth != "device-key" {
		t.Errorf("path=%q auth=%q (StarSender wants the raw key)", got.path, got.auth)
	}
	if got.body["messageType"] != "text" || got.body["to"] != "62812000" || got.body["body"] != "Hi" {
		t.Errorf("unexpected body %v", got.body)
	}

	_, _ = client.Send(context.Background(), creds, Outbound{To: "62812", Text: "cap", MediaURL: "https://x.test/f.pdf"})
	if got.body["messageType"] != "media" || got.body["file"] != "https://x.test/f.pdf" {
		t.Errorf("unexpected media body %v", got.body)
	}
}

func TestSendDetectsFailures(t *testing.T) {
	cases := map[string]struct {
		status int
		body   string
	}{
		"http error":          {401, `{"message":"Unauthorized"}`},
		"success false":       {200, `{"success":false,"message":"Device not connected"}`},
		"status false":        {200, `{"status":false,"message":"invalid number"}`},
		"code in body":        {200, `{"code":400,"message":"bad request"}`},
		"error field present": {200, `{"error":"quota exceeded"}`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			srv, _ := fakeGateway(t, tc.status, tc.body)
			client := NewClient(srv.Client(), srv.URL)
			_, err := client.Send(context.Background(),
				&Credentials{Provider: ProviderStarSender, APIKey: "k", WebhookToken: "t"},
				Outbound{To: "62812", Text: "x"})
			if err == nil {
				t.Fatal("expected error")
			}
		})
	}

	if _, err := NewClient(http.DefaultClient, "").Send(context.Background(),
		&Credentials{Provider: ProviderStarSender, APIKey: "k"}, Outbound{To: "abc", Text: "x"}); err == nil ||
		!strings.Contains(err.Error(), "empty") {
		t.Fatalf("empty recipient: err=%v", err)
	}
}

func TestParseWebhookVariants(t *testing.T) {
	cases := []struct {
		name string
		body string
		want Inbound
	}{
		{
			name: "onesender style",
			body: `{"message_id":"3EB0A1","from":"6281234567890@s.whatsapp.net","push_name":"Budi",
				"message_type":"text","message_text":"Halo kak","is_group":false,"from_me":false}`,
			want: Inbound{ID: "3EB0A1", From: "6281234567890", PushName: "Budi", Text: "Halo kak", MediaType: "text"},
		},
		{
			name: "starsender style",
			body: `{"device":"6289999","from":"081234567890","pushname":"Sari","message":"Mau order","id":"ss-9"}`,
			want: Inbound{ID: "ss-9", From: "6281234567890", PushName: "Sari", Text: "Mau order"},
		},
		{
			name: "wrapped in data with media",
			body: `{"event":"message","data":{"sender":"62811","caption":"bukti transfer",
				"file":"https://cdn.test/x.jpg","message_type":"image","key":{"id":"K1"}}}`,
			want: Inbound{ID: "K1", From: "62811", Text: "bukti transfer",
				MediaURL: "https://cdn.test/x.jpg", MediaType: "image"},
		},
		{
			name: "baileys-like key object",
			body: `{"key":{"remoteJid":"62822@s.whatsapp.net","fromMe":true,"id":"B1"},"message":{"conversation":"sent from phone"}}`,
			want: Inbound{ID: "B1", From: "62822", Text: "sent from phone", FromMe: true},
		},
		{
			name: "group message",
			body: `{"from":"12036302@g.us","message":"rame","id":"G1"}`,
			want: Inbound{ID: "G1", From: "12036302", Text: "rame", IsGroup: true},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseWebhook([]byte(tc.body))
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != 1 {
				t.Fatalf("got %d events, want 1: %+v", len(got), got)
			}
			if got[0] != tc.want {
				t.Errorf("got  %+v\nwant %+v", got[0], tc.want)
			}
		})
	}
}

func TestParseWebhookArrayAndIgnorable(t *testing.T) {
	got, err := ParseWebhook([]byte(`[{"from":"62811","message":"a"},{"from":"62812","message":"b","fromMe":"true"},{"status":"ok"}]`))
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d events, want 2 (status ping is not an event)", len(got))
	}
	if got[0].Ignorable() || !got[1].Ignorable() {
		t.Errorf("Ignorable: first=%v second=%v, want false/true", got[0].Ignorable(), got[1].Ignorable())
	}
	if (Inbound{From: "62811"}).Ignorable() != true {
		t.Error("event without content must be ignorable")
	}
	if _, err := ParseWebhook([]byte(`not json`)); err == nil {
		t.Error("invalid JSON accepted")
	}
}
