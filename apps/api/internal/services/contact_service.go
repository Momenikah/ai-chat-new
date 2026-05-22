package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/webhook"
)

// Contact-related service errors.
var (
	ErrContactNotFound = errors.New("contact not found")
	ErrSameContact     = errors.New("source and target contact are the same")
)

// ContactDetail bundles a contact with its tags and timeline.
type ContactDetail struct {
	Contact    *models.Contact                   `json:"contact"`
	Tags       []models.Tag                      `json:"tags"`
	Activities []models.ContactActivity          `json:"activities"`
	Messages   []repositories.ContactMessage     `json:"messages"`
}

// ImportResult summarises a CSV import.
type ImportResult struct {
	Created int      `json:"created"`
	Updated int      `json:"updated"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors"`
}

// ContactService implements CRM contact operations.
type ContactService struct {
	pool       *pgxpool.Pool
	contacts   *repositories.ContactRepository
	tags       *repositories.TagRepository
	activities *repositories.ActivityRepository
	webhooks   webhook.Dispatcher
}

// NewContactService constructs a ContactService.
func NewContactService(
	pool *pgxpool.Pool,
	contacts *repositories.ContactRepository,
	tags *repositories.TagRepository,
	activities *repositories.ActivityRepository,
) *ContactService {
	return &ContactService{
		pool: pool, contacts: contacts, tags: tags, activities: activities,
		webhooks: webhook.NoopDispatcher{},
	}
}

// SetWebhookDispatcher wires outbound webhook emission. Optional.
func (s *ContactService) SetWebhookDispatcher(d webhook.Dispatcher) {
	if d != nil {
		s.webhooks = d
	}
}

// CreateContactInput is the payload for adding a contact.
type CreateContactInput struct {
	WorkspaceID string
	ActorID     string
	Name        string
	Phone       *string
	Email       *string
	Location    *string
	Company     *string
	Birthday    *time.Time
	Notes       *string
	TagIDs      []string
}

// Create inserts a contact and logs a `contact_created` activity.
func (s *ContactService) Create(ctx context.Context, in CreateContactInput) (*models.Contact, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	contact, err := s.contacts.WithTx(tx).Create(ctx, repositories.CreateContactParams{
		WorkspaceID: in.WorkspaceID,
		Name:        name,
		Phone:       trimPtr(in.Phone),
		Email:       lowerPtr(in.Email),
		Location:    trimPtr(in.Location),
		Company:     trimPtr(in.Company),
		Birthday:    in.Birthday,
		Notes:       trimPtr(in.Notes),
	})
	if err != nil {
		return nil, err
	}

	for _, tagID := range in.TagIDs {
		if err := s.contacts.WithTx(tx).AttachTag(ctx, contact.ID, tagID); err != nil {
			return nil, err
		}
	}

	// ActorID is empty when the contact is created without a human actor
	// (e.g. via the developer API). Store NULL in that case so the FK to
	// users isn't violated by an empty-string UUID.
	var actorPtr *string
	if in.ActorID != "" {
		actor := in.ActorID
		actorPtr = &actor
	}
	if _, err := s.activities.WithTx(tx).Create(ctx, repositories.CreateActivityParams{
		ContactID:   contact.ID,
		WorkspaceID: in.WorkspaceID,
		ActorID:     actorPtr,
		Kind:        models.ActivityContactCreated,
		Body:        ptr("Kontak ditambahkan secara manual"),
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	s.webhooks.Emit(in.WorkspaceID, webhook.EventContactCreated, contact)
	return contact, nil
}

// UpdateContactInput is the payload for editing a contact.
type UpdateContactInput struct {
	ID        string
	Name      string
	Phone     *string
	Email     *string
	Location  *string
	Company   *string
	Birthday  *time.Time
	Notes     *string
	AvatarURL *string
}

// Update saves the editable fields. AvatarURL is preserved if not supplied
// (so the form-based PATCH doesn't accidentally wipe an existing avatar).
func (s *ContactService) Update(ctx context.Context, in UpdateContactInput) (*models.Contact, error) {
	avatar := in.AvatarURL
	if avatar == nil {
		current, err := s.contacts.GetByID(ctx, in.ID)
		if err != nil {
			return nil, err
		}
		avatar = current.AvatarURL
	}
	return s.contacts.Update(ctx, repositories.UpdateContactParams{
		ID:        in.ID,
		Name:      strings.TrimSpace(in.Name),
		Phone:     trimPtr(in.Phone),
		Email:     lowerPtr(in.Email),
		AvatarURL: avatar,
		Location:  trimPtr(in.Location),
		Company:   trimPtr(in.Company),
		Birthday:  in.Birthday,
		Notes:     trimPtr(in.Notes),
	})
}

// Delete removes a contact.
func (s *ContactService) Delete(ctx context.Context, id string) error {
	return s.contacts.Delete(ctx, id)
}

// AttachTag links a tag to a contact.
func (s *ContactService) AttachTag(ctx context.Context, contactID, tagID string) error {
	return s.contacts.AttachTag(ctx, contactID, tagID)
}

// DetachTag unlinks a tag from a contact.
func (s *ContactService) DetachTag(ctx context.Context, contactID, tagID string) error {
	return s.contacts.DetachTag(ctx, contactID, tagID)
}

// List returns contacts filtered by query params.
func (s *ContactService) List(ctx context.Context, filter repositories.ListFilter) ([]models.Contact, error) {
	return s.contacts.ListWithFilters(ctx, filter)
}

// Get returns a contact with its tags + timeline (activities + recent messages).
func (s *ContactService) Get(ctx context.Context, id string) (*ContactDetail, error) {
	contact, err := s.contacts.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrContactNotFound
		}
		return nil, err
	}
	tags, err := s.contacts.ListTags(ctx, id)
	if err != nil {
		return nil, err
	}
	acts, err := s.activities.ListByContact(ctx, id)
	if err != nil {
		return nil, err
	}
	msgs, err := s.activities.ListMessagesForContact(ctx, id, 50)
	if err != nil {
		return nil, err
	}
	return &ContactDetail{
		Contact: contact, Tags: tags, Activities: acts, Messages: msgs,
	}, nil
}

// FindDuplicates returns contacts sharing a phone or email with another contact.
func (s *ContactService) FindDuplicates(ctx context.Context, workspaceID string) ([]models.Contact, error) {
	return s.contacts.FindDuplicates(ctx, workspaceID)
}

// Merge merges source into target: target field gaps are filled from source,
// then conversations / activities / tags are reassigned and source is removed.
func (s *ContactService) Merge(ctx context.Context, workspaceID, sourceID, targetID, actorID string) (*models.Contact, error) {
	if sourceID == targetID {
		return nil, ErrSameContact
	}
	src, err := s.contacts.GetByID(ctx, sourceID)
	if err != nil {
		return nil, ErrContactNotFound
	}
	dst, err := s.contacts.GetByID(ctx, targetID)
	if err != nil {
		return nil, ErrContactNotFound
	}
	if src.WorkspaceID != workspaceID || dst.WorkspaceID != workspaceID {
		return nil, ErrContactNotFound
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	contacts := s.contacts.WithTx(tx)
	activities := s.activities.WithTx(tx)

	// Fill gaps on target from source.
	merged := repositories.UpdateContactParams{
		ID:        dst.ID,
		Name:      dst.Name,
		Phone:     pickPtr(dst.Phone, src.Phone),
		Email:     pickPtr(dst.Email, src.Email),
		AvatarURL: pickPtr(dst.AvatarURL, src.AvatarURL),
		Location:  pickPtr(dst.Location, src.Location),
		Company:   pickPtr(dst.Company, src.Company),
		Birthday:  pickTime(dst.Birthday, src.Birthday),
		Notes:     pickPtr(dst.Notes, src.Notes),
	}
	updated, err := contacts.Update(ctx, merged)
	if err != nil {
		return nil, err
	}
	if err := contacts.ReassignConversations(ctx, src.ID, dst.ID); err != nil {
		return nil, err
	}
	if err := contacts.ReassignActivities(ctx, src.ID, dst.ID); err != nil {
		return nil, err
	}
	if err := contacts.CopyTagsTo(ctx, src.ID, dst.ID); err != nil {
		return nil, err
	}

	body := fmt.Sprintf("Digabungkan dari %s", src.Name)
	meta, _ := json.Marshal(map[string]string{"source_id": src.ID, "source_name": src.Name})
	if _, err := activities.Create(ctx, repositories.CreateActivityParams{
		ContactID:   dst.ID,
		WorkspaceID: workspaceID,
		ActorID:     &actorID,
		Kind:        models.ActivityContactMerged,
		Body:        &body,
		Metadata:    meta,
	}); err != nil {
		return nil, err
	}
	if err := contacts.Delete(ctx, src.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return updated, nil
}

/* ---------------------------------- CSV --------------------------------- */

var csvExportHeader = []string{"name", "phone", "email", "location", "company", "birthday", "notes"}

// Export writes all contacts of a workspace as CSV to the given writer.
func (s *ContactService) Export(ctx context.Context, workspaceID string, w io.Writer) error {
	contacts, err := s.contacts.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return err
	}
	writer := csv.NewWriter(w)
	if err := writer.Write(csvExportHeader); err != nil {
		return err
	}
	for _, c := range contacts {
		birthday := ""
		if c.Birthday != nil {
			birthday = c.Birthday.Format("2006-01-02")
		}
		row := []string{
			c.Name,
			deref(c.Phone),
			deref(c.Email),
			deref(c.Location),
			deref(c.Company),
			birthday,
			deref(c.Notes),
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	writer.Flush()
	return writer.Error()
}

// Import parses CSV bytes and upserts contacts. Existing rows are matched by
// email (case-insensitive) first, then by phone.
func (s *ContactService) Import(ctx context.Context, workspaceID, actorID string, data []byte) (*ImportResult, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	idx := map[string]int{}
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	if _, ok := idx["name"]; !ok {
		return nil, fmt.Errorf("CSV harus memiliki kolom 'name'")
	}

	result := &ImportResult{Errors: []string{}}
	line := 1
	for {
		line++
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("baris %d: %v", line, err))
			continue
		}

		cell := func(key string) string {
			i, ok := idx[key]
			if !ok || i >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[i])
		}
		name := cell("name")
		if name == "" {
			result.Skipped++
			continue
		}
		phone := cell("phone")
		email := cell("email")

		// Try to find an existing contact.
		var existing *models.Contact
		if email != "" {
			if c, err := s.contacts.FindByEmail(ctx, workspaceID, email); err == nil {
				existing = c
			} else if !errors.Is(err, repositories.ErrNotFound) {
				result.Errors = append(result.Errors, fmt.Sprintf("baris %d lookup: %v", line, err))
				continue
			}
		}
		if existing == nil && phone != "" {
			if c, err := s.contacts.FindByPhone(ctx, workspaceID, phone); err == nil {
				existing = c
			} else if !errors.Is(err, repositories.ErrNotFound) {
				result.Errors = append(result.Errors, fmt.Sprintf("baris %d lookup: %v", line, err))
				continue
			}
		}

		birthday := parseDate(cell("birthday"))
		location := cell("location")
		company := cell("company")
		notes := cell("notes")

		if existing != nil {
			if _, err := s.contacts.Update(ctx, repositories.UpdateContactParams{
				ID:        existing.ID,
				Name:      name,
				Phone:     nilIfEmpty(phone),
				Email:     nilIfEmpty(strings.ToLower(email)),
				AvatarURL: existing.AvatarURL,
				Location:  nilIfEmpty(location),
				Company:   nilIfEmpty(company),
				Birthday:  birthday,
				Notes:     nilIfEmpty(notes),
			}); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("baris %d update: %v", line, err))
				continue
			}
			result.Updated++
			continue
		}

		contact, err := s.contacts.Create(ctx, repositories.CreateContactParams{
			WorkspaceID: workspaceID,
			Name:        name,
			Phone:       nilIfEmpty(phone),
			Email:       nilIfEmpty(strings.ToLower(email)),
			Location:    nilIfEmpty(location),
			Company:     nilIfEmpty(company),
			Birthday:    birthday,
			Notes:       nilIfEmpty(notes),
		})
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("baris %d create: %v", line, err))
			continue
		}
		actor := actorID
		_, _ = s.activities.Create(ctx, repositories.CreateActivityParams{
			ContactID:   contact.ID,
			WorkspaceID: workspaceID,
			ActorID:     &actor,
			Kind:        models.ActivityContactImported,
			Body:        ptr("Kontak diimport dari CSV"),
		})
		result.Created++
	}
	return result, nil
}

/* ------------------------------- helpers -------------------------------- */

func trimPtr(p *string) *string {
	if p == nil {
		return nil
	}
	t := strings.TrimSpace(*p)
	if t == "" {
		return nil
	}
	return &t
}

func lowerPtr(p *string) *string {
	t := trimPtr(p)
	if t == nil {
		return nil
	}
	v := strings.ToLower(*t)
	return &v
}

func nilIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func ptr(s string) *string { return &s }

func pickPtr(target, fallback *string) *string {
	if target != nil && strings.TrimSpace(*target) != "" {
		return target
	}
	return fallback
}

func pickTime(target, fallback *time.Time) *time.Time {
	if target != nil {
		return target
	}
	return fallback
}

func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	for _, layout := range []string{"2006-01-02", "02/01/2006", "01/02/2006"} {
		if t, err := time.Parse(layout, s); err == nil {
			return &t
		}
	}
	return nil
}
