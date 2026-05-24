package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/instagram"
	"github.com/aichat/api/internal/messenger"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/whatsapp"
)

// Broadcast-related service errors.
var (
	ErrCampaignNotFound    = errors.New("campaign not found")
	ErrCampaignNotLaunchable = errors.New("campaign cannot be launched from its current status")
	ErrEmptyAudience       = errors.New("audience resolved to zero recipients")
	ErrInvalidAudienceKind = errors.New("invalid audience kind")
	ErrChannelMismatch     = errors.New("template channel mismatch")
)

// BroadcastJob is the payload pushed to Redis for the worker to send.
type BroadcastJob struct {
	QueueRowID      string `json:"queue_row_id"`
	RecipientID     string `json:"recipient_id"`
	CampaignID      string `json:"campaign_id"`
	WorkspaceID     string `json:"workspace_id"`
	ChannelID       string `json:"channel_id"`
	ChannelKind     string `json:"channel_kind"`     // whatsapp / instagram / messenger
	AccessToken     string `json:"access_token"`     // decrypted at enqueue time
	PhoneNumberID   string `json:"phone_number_id"`  // whatsapp routing id
	MessagingProduct string `json:"messaging_product"` // "instagram" or ""
	RecipientTo     string `json:"recipient_to"`     // phone for WA, PSID/IGSID otherwise
	Body            string `json:"body"`
	RatePerMinute   int    `json:"rate_per_minute"`
}

// BroadcastService implements broadcast-campaign CRUD + launch + cancel.
type BroadcastService struct {
	pool       *pgxpool.Pool
	broadcasts *repositories.BroadcastRepository
	contacts   *repositories.ContactRepository
	channels   *repositories.ChannelRepository
	templates  *repositories.TemplateRepository
	segments   *SegmentService
	encryptor  *crypto.Encryptor
	rdb        *redis.Client
	queueKey   string
}

// NewBroadcastService constructs a BroadcastService.
func NewBroadcastService(
	pool *pgxpool.Pool,
	broadcasts *repositories.BroadcastRepository,
	contacts *repositories.ContactRepository,
	channels *repositories.ChannelRepository,
	templates *repositories.TemplateRepository,
	segments *SegmentService,
	encryptor *crypto.Encryptor,
	rdb *redis.Client,
	queueKey string,
) *BroadcastService {
	if queueKey == "" {
		queueKey = "aichat:broadcast:queue"
	}
	return &BroadcastService{
		pool: pool, broadcasts: broadcasts, contacts: contacts,
		channels: channels, templates: templates, segments: segments,
		encryptor: encryptor, rdb: rdb, queueKey: queueKey,
	}
}

// QueueKey exposes the Redis list name (used by the worker config too).
func (s *BroadcastService) QueueKey() string { return s.queueKey }

// CreateBroadcastInput is the payload to /broadcasts (POST).
type CreateBroadcastInput struct {
	WorkspaceID    string
	ActorID        string
	ChannelID      string
	TemplateID     *string
	Name           string
	AudienceKind   string
	AudienceFilter json.RawMessage
	BodyOverride   *string
	Variables      json.RawMessage
	RatePerMinute  int
}

// Create persists a draft campaign.
func (s *BroadcastService) Create(ctx context.Context, in CreateBroadcastInput) (*models.BroadcastCampaign, error) {
	if !validAudienceKind(in.AudienceKind) {
		return nil, ErrInvalidAudienceKind
	}
	actor := in.ActorID
	return s.broadcasts.CreateCampaign(ctx, repositories.CreateCampaignParams{
		WorkspaceID:    in.WorkspaceID,
		ChannelID:      in.ChannelID,
		TemplateID:     in.TemplateID,
		Name:           strings.TrimSpace(in.Name),
		AudienceKind:   in.AudienceKind,
		AudienceFilter: in.AudienceFilter,
		BodyOverride:   in.BodyOverride,
		Variables:      in.Variables,
		RatePerMinute:  in.RatePerMinute,
		CreatedBy:      &actor,
	})
}

// List returns campaigns for a workspace.
func (s *BroadcastService) List(ctx context.Context, workspaceID string) ([]models.BroadcastCampaign, error) {
	return s.broadcasts.ListCampaignsByWorkspace(ctx, workspaceID)
}

// Detail bundles a campaign with its recipient list + recent logs.
type Detail struct {
	Campaign   *models.BroadcastCampaign     `json:"campaign"`
	Recipients []models.BroadcastRecipient   `json:"recipients"`
	Logs       []models.BroadcastLog         `json:"logs"`
}

// Get returns the detail view of a campaign.
func (s *BroadcastService) Get(ctx context.Context, id string) (*Detail, error) {
	c, err := s.broadcasts.GetCampaignByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}
	recipients, err := s.broadcasts.ListRecipientsByCampaign(ctx, id)
	if err != nil {
		return nil, err
	}
	logs, err := s.broadcasts.ListLogs(ctx, id)
	if err != nil {
		return nil, err
	}
	return &Detail{Campaign: c, Recipients: recipients, Logs: logs}, nil
}

// Schedule flips a draft campaign to scheduled with a future timestamp.
func (s *BroadcastService) Schedule(ctx context.Context, id string, at time.Time) (*models.BroadcastCampaign, error) {
	c, err := s.broadcasts.GetCampaignByID(ctx, id)
	if err != nil {
		return nil, ErrCampaignNotFound
	}
	if c.Status != models.BroadcastDraft && c.Status != models.BroadcastScheduled {
		return nil, ErrCampaignNotLaunchable
	}
	return s.broadcasts.UpdateCampaignStatus(ctx, repositories.UpdateCampaignStatusParams{
		ID:          id,
		Status:      models.BroadcastScheduled,
		ScheduledAt: &at,
	})
}

// Cancel flips a campaign to cancelled (from draft/scheduled/sending).
func (s *BroadcastService) Cancel(ctx context.Context, id string) (*models.BroadcastCampaign, error) {
	c, err := s.broadcasts.GetCampaignByID(ctx, id)
	if err != nil {
		return nil, ErrCampaignNotFound
	}
	if c.Status == models.BroadcastCompleted || c.Status == models.BroadcastCancelled {
		return nil, ErrCampaignNotLaunchable
	}
	now := time.Now()
	return s.broadcasts.UpdateCampaignStatus(ctx, repositories.UpdateCampaignStatusParams{
		ID:          id,
		Status:      models.BroadcastCancelled,
		CompletedAt: &now,
	})
}

/* ----------------------------- Launch -------------------------------- */

// Launch resolves the audience, renders bodies, creates recipient rows and
// enqueues Redis jobs. The campaign flips to `sending` (or `completed` for
// zero-recipient runs).
func (s *BroadcastService) Launch(ctx context.Context, id string) (*models.BroadcastCampaign, error) {
	camp, err := s.broadcasts.GetCampaignByID(ctx, id)
	if err != nil {
		return nil, ErrCampaignNotFound
	}
	if camp.Status != models.BroadcastDraft && camp.Status != models.BroadcastScheduled {
		return nil, ErrCampaignNotLaunchable
	}

	channel, err := s.channels.GetByID(ctx, camp.ChannelID)
	if err != nil {
		return nil, fmt.Errorf("load channel: %w", err)
	}

	// Resolve the channel-specific access info up front. The worker job
	// carries the decrypted token so it doesn't need to touch the
	// encryption key.
	jobBase, err := s.buildJobBase(ctx, channel)
	if err != nil {
		return nil, err
	}

	// Compose the body (template body or override).
	bodyTpl, err := s.resolveBody(ctx, camp)
	if err != nil {
		return nil, err
	}

	// Default variable map.
	defaults := map[string]string{}
	_ = json.Unmarshal(camp.Variables, &defaults)

	// Resolve recipients.
	rows, err := s.resolveAudience(ctx, camp, channel)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, ErrEmptyAudience
	}

	now := time.Now()
	updated, err := s.broadcasts.UpdateCampaignStatus(ctx, repositories.UpdateCampaignStatusParams{
		ID:        id,
		Status:    models.BroadcastSending,
		StartedAt: &now,
	})
	if err != nil {
		return nil, err
	}
	_ = s.broadcasts.SetTotalRecipients(ctx, id, len(rows))
	_ = s.broadcasts.AppendLog(ctx, id, nil, "launch",
		ptr(fmt.Sprintf("audience=%d", len(rows))))

	// Insert recipient rows + enqueue Redis jobs.
	for _, row := range rows {
		merged := mergeVars(defaults, row.Variables)
		rendered := renderBody(bodyTpl, merged)

		varsJSON, _ := json.Marshal(merged)
		rec, err := s.broadcasts.CreateRecipient(ctx, repositories.CreateRecipientParams{
			CampaignID:   camp.ID,
			WorkspaceID:  camp.WorkspaceID,
			ContactID:    row.ContactID,
			Name:         row.Name,
			Phone:        row.Phone,
			ExternalID:   row.ExternalID,
			Variables:    varsJSON,
			RenderedBody: rendered,
		})
		if err != nil {
			return nil, err
		}
		if err := s.enqueueJob(ctx, camp, channel, jobBase, rec, rendered); err != nil {
			return nil, err
		}
	}
	_ = s.broadcasts.AppendLog(ctx, id, nil, "enqueued",
		ptr(fmt.Sprintf("enqueued=%d", len(rows))))
	return updated, nil
}

// audienceRow is one resolved audience entry before insertion.
type audienceRow struct {
	ContactID  *string
	Name       *string
	Phone      *string
	ExternalID *string
	Variables  map[string]string
}

func (s *BroadcastService) resolveAudience(ctx context.Context, camp *models.BroadcastCampaign, channel *models.Channel) ([]audienceRow, error) {
	filter := map[string]any{}
	_ = json.Unmarshal(camp.AudienceFilter, &filter)
	wantExternal := channel.Type == models.ChannelInstagram ||
		channel.Type == models.ChannelMessenger

	switch camp.AudienceKind {
	case "all":
		all, err := s.contacts.ListByWorkspace(ctx, camp.WorkspaceID)
		if err != nil {
			return nil, err
		}
		return contactsToAudience(all, wantExternal), nil

	case "tag":
		tagID, _ := filter["tag_id"].(string)
		if tagID == "" {
			return nil, fmt.Errorf("audience_filter.tag_id required")
		}
		list, err := s.contacts.ListWithFilters(ctx, repositories.ListFilter{
			WorkspaceID: camp.WorkspaceID,
			TagID:       &tagID,
			Limit:       500,
		})
		if err != nil {
			return nil, err
		}
		return contactsToAudience(list, wantExternal), nil

	case "segment":
		segmentID, _ := filter["segment_id"].(string)
		if segmentID == "" {
			return nil, fmt.Errorf("audience_filter.segment_id required")
		}
		_, members, err := s.segments.Get(ctx, segmentID)
		if err != nil {
			return nil, err
		}
		return contactsToAudience(members, wantExternal), nil

	case "csv":
		raw, _ := filter["csv_rows"].([]any)
		out := make([]audienceRow, 0, len(raw))
		for _, item := range raw {
			row, _ := item.(map[string]any)
			if row == nil {
				continue
			}
			phone, _ := row["phone"].(string)
			extID, _ := row["external_id"].(string)
			name, _ := row["name"].(string)
			vars := map[string]string{}
			if v, ok := row["variables"].(map[string]any); ok {
				for k, val := range v {
					if s, ok := val.(string); ok {
						vars[k] = s
					}
				}
			}
			if name != "" {
				vars["name"] = name
			}
			if phone != "" {
				vars["phone"] = phone
			}
			out = append(out, audienceRow{
				Name:       strPtr(name),
				Phone:      strPtr(phone),
				ExternalID: strPtr(extID),
				Variables:  vars,
			})
		}
		return out, nil
	}
	return nil, ErrInvalidAudienceKind
}

func contactsToAudience(list []models.Contact, wantExternal bool) []audienceRow {
	out := make([]audienceRow, 0, len(list))
	for i := range list {
		c := list[i]
		if wantExternal {
			if c.ExternalID == nil || *c.ExternalID == "" {
				continue
			}
		} else if c.Phone == nil || *c.Phone == "" {
			continue
		}
		vars := map[string]string{}
		vars["name"] = c.Name
		if c.Phone != nil {
			vars["phone"] = *c.Phone
		}
		if c.Email != nil {
			vars["email"] = *c.Email
		}
		if c.Company != nil {
			vars["company"] = *c.Company
		}
		id := c.ID
		out = append(out, audienceRow{
			ContactID:  &id,
			Name:       &c.Name,
			Phone:      c.Phone,
			ExternalID: c.ExternalID,
			Variables:  vars,
		})
	}
	return out
}

func (s *BroadcastService) resolveBody(ctx context.Context, camp *models.BroadcastCampaign) (string, error) {
	if camp.TemplateID != nil {
		t, err := s.templates.GetByID(ctx, *camp.TemplateID)
		if err != nil {
			return "", fmt.Errorf("load template: %w", err)
		}
		if t.WorkspaceID != camp.WorkspaceID {
			return "", ErrChannelMismatch
		}
		return t.Body, nil
	}
	if camp.BodyOverride != nil && *camp.BodyOverride != "" {
		return *camp.BodyOverride, nil
	}
	return "", errors.New("campaign needs either template_id or body_override")
}

type credPair struct {
	AccessToken      string
	PhoneNumberID    string
	MessagingProduct string
	Kind             string
}

func (s *BroadcastService) buildJobBase(ctx context.Context, channel *models.Channel) (credPair, error) {
	switch channel.Type {
	case models.ChannelWhatsApp:
		creds, err := whatsapp.LoadCredentials(ctx, s.channels, s.encryptor, channel.ID)
		if err != nil {
			return credPair{}, fmt.Errorf("load whatsapp creds: %w", err)
		}
		return credPair{
			AccessToken:   creds.AccessToken,
			PhoneNumberID: creds.PhoneNumberID,
			Kind:          string(models.ChannelWhatsApp),
		}, nil
	case models.ChannelInstagram:
		creds, err := instagram.LoadCredentials(ctx, s.channels, s.encryptor, channel.ID)
		if err != nil {
			return credPair{}, fmt.Errorf("load instagram creds: %w", err)
		}
		return credPair{
			AccessToken:      creds.PageAccessToken,
			MessagingProduct: "instagram",
			Kind:             string(models.ChannelInstagram),
		}, nil
	case models.ChannelMessenger:
		creds, err := messenger.LoadCredentials(ctx, s.channels, s.encryptor, channel.ID)
		if err != nil {
			return credPair{}, fmt.Errorf("load messenger creds: %w", err)
		}
		return credPair{
			AccessToken: creds.PageAccessToken,
			Kind:        string(models.ChannelMessenger),
		}, nil
	}
	return credPair{}, fmt.Errorf("unsupported channel type %q", channel.Type)
}

func (s *BroadcastService) enqueueJob(
	ctx context.Context,
	camp *models.BroadcastCampaign,
	channel *models.Channel,
	cred credPair,
	rec *models.BroadcastRecipient,
	body string,
) error {
	to := ""
	switch channel.Type {
	case models.ChannelWhatsApp:
		if rec.Phone != nil {
			to = *rec.Phone
		}
	case models.ChannelInstagram, models.ChannelMessenger:
		if rec.ExternalID != nil {
			to = *rec.ExternalID
		}
	}
	if to == "" {
		return s.broadcasts.UpdateRecipientStatus(ctx, repositories.UpdateRecipientStatusParams{
			ID:        rec.ID,
			Status:    models.RecipientSkipped,
			LastError: ptr("recipient has no destination identifier"),
		})
	}

	job := BroadcastJob{
		RecipientID:      rec.ID,
		CampaignID:       camp.ID,
		WorkspaceID:      camp.WorkspaceID,
		ChannelID:        channel.ID,
		ChannelKind:      cred.Kind,
		AccessToken:      cred.AccessToken,
		PhoneNumberID:    cred.PhoneNumberID,
		MessagingProduct: cred.MessagingProduct,
		RecipientTo:      to,
		Body:             body,
		RatePerMinute:    camp.RatePerMinute,
	}
	payload, err := json.Marshal(job)
	if err != nil {
		return err
	}
	queueID, err := s.broadcasts.CreateQueueRow(ctx, camp.WorkspaceID, "broadcast_send", payload, nil)
	if err != nil {
		return err
	}
	job.QueueRowID = queueID
	payload, _ = json.Marshal(job) // re-marshal with queue id
	if err := s.rdb.LPush(ctx, s.queueKey, payload).Err(); err != nil {
		return err
	}
	return nil
}

/* ----------------------- Worker-facing helpers ---------------------- */

// MarkRecipientResult is called by the worker (via the API in tests) to
// record a delivery outcome. The HTTP worker uses the DB directly; this
// helper exists for unit tests.
func (s *BroadcastService) MarkRecipientResult(ctx context.Context, p repositories.UpdateRecipientStatusParams, event, detail, campaignID string) error {
	if err := s.broadcasts.UpdateRecipientStatus(ctx, p); err != nil {
		return err
	}
	if err := s.broadcasts.IncrementCounter(ctx, campaignID, event); err != nil {
		return err
	}
	return s.broadcasts.AppendLog(ctx, campaignID, &p.ID, event, ptrOrNil(detail))
}

/* -------------------------------- helpers ---------------------------- */

func validAudienceKind(k string) bool {
	switch k {
	case "all", "tag", "segment", "csv":
		return true
	}
	return false
}

var broadcastVarPattern = regexp.MustCompile(`{{\s*([a-zA-Z0-9_]+)\s*}}`)

func renderBody(body string, vars map[string]string) string {
	return broadcastVarPattern.ReplaceAllStringFunc(body, func(m string) string {
		name := broadcastVarPattern.FindStringSubmatch(m)[1]
		if v, ok := vars[name]; ok {
			return v
		}
		return m
	})
}

func mergeVars(defaults map[string]string, override map[string]string) map[string]string {
	out := make(map[string]string, len(defaults)+len(override))
	for k, v := range defaults {
		out[k] = v
	}
	for k, v := range override {
		out[k] = v
	}
	return out
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
