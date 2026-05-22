package repositories

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// ContactRepository handles persistence for contacts and contact-tag links.
type ContactRepository struct {
	db DBTX
}

// NewContactRepository constructs a ContactRepository.
func NewContactRepository(db DBTX) *ContactRepository {
	return &ContactRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *ContactRepository) WithTx(tx pgx.Tx) *ContactRepository {
	return &ContactRepository{db: tx}
}

const contactColumns = `
	id::text, workspace_id::text, name, phone, email, avatar_url,
	external_source::text, external_id, metadata,
	location, company, birthday, notes,
	last_seen_at, created_at, updated_at`

// Qualified form for JOIN queries.
const contactColumnsC = `
	c.id::text, c.workspace_id::text, c.name, c.phone, c.email, c.avatar_url,
	c.external_source::text, c.external_id, c.metadata,
	c.location, c.company, c.birthday, c.notes,
	c.last_seen_at, c.created_at, c.updated_at`

// CreateContactParams holds inputs for inserting a contact.
type CreateContactParams struct {
	WorkspaceID    string
	Name           string
	Phone          *string
	Email          *string
	AvatarURL      *string
	ExternalSource *models.ChannelType
	ExternalID     *string
	Location       *string
	Company        *string
	Birthday       *time.Time
	Notes          *string
}

// Create inserts a new contact.
func (r *ContactRepository) Create(ctx context.Context, p CreateContactParams) (*models.Contact, error) {
	const q = `
		INSERT INTO contacts (
			workspace_id, name, phone, email, avatar_url,
			external_source, external_id, location, company, birthday, notes
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING ` + contactColumns
	var src *string
	if p.ExternalSource != nil {
		s := string(*p.ExternalSource)
		src = &s
	}
	return scanContact(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, p.Phone, p.Email, p.AvatarURL,
		src, p.ExternalID, p.Location, p.Company, p.Birthday, p.Notes))
}

// UpdateContactParams holds inputs for updating a contact.
type UpdateContactParams struct {
	ID        string
	Name      string
	Phone     *string
	Email     *string
	AvatarURL *string
	Location  *string
	Company   *string
	Birthday  *time.Time
	Notes     *string
}

// Update saves the editable contact fields.
func (r *ContactRepository) Update(ctx context.Context, p UpdateContactParams) (*models.Contact, error) {
	const q = `
		UPDATE contacts
		SET name = $2, phone = $3, email = $4, avatar_url = $5,
		    location = $6, company = $7, birthday = $8, notes = $9,
		    updated_at = now()
		WHERE id = $1
		RETURNING ` + contactColumns
	return scanContact(r.db.QueryRow(ctx, q,
		p.ID, p.Name, p.Phone, p.Email, p.AvatarURL,
		p.Location, p.Company, p.Birthday, p.Notes))
}

// Delete removes a contact (cascades to conversations + activities).
func (r *ContactRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM contacts WHERE id = $1`, id)
	return err
}

// GetByID fetches a contact by id.
func (r *ContactRepository) GetByID(ctx context.Context, id string) (*models.Contact, error) {
	const q = `SELECT ` + contactColumns + ` FROM contacts WHERE id = $1`
	return scanContact(r.db.QueryRow(ctx, q, id))
}

// FindByPhone returns a contact in the workspace matching the phone (exact).
func (r *ContactRepository) FindByPhone(ctx context.Context, workspaceID, phone string) (*models.Contact, error) {
	const q = `SELECT ` + contactColumns + ` FROM contacts
		WHERE workspace_id = $1 AND phone = $2 LIMIT 1`
	return scanContact(r.db.QueryRow(ctx, q, workspaceID, phone))
}

// FindByEmail returns a contact in the workspace matching the email
// case-insensitively.
func (r *ContactRepository) FindByEmail(ctx context.Context, workspaceID, email string) (*models.Contact, error) {
	const q = `SELECT ` + contactColumns + ` FROM contacts
		WHERE workspace_id = $1 AND lower(email) = lower($2) LIMIT 1`
	return scanContact(r.db.QueryRow(ctx, q, workspaceID, email))
}

// FindByExternal returns a contact identified by (source, external_id).
func (r *ContactRepository) FindByExternal(ctx context.Context, workspaceID string, source models.ChannelType, externalID string) (*models.Contact, error) {
	const q = `SELECT ` + contactColumns + ` FROM contacts
		WHERE workspace_id = $1 AND external_source::text = $2 AND external_id = $3
		LIMIT 1`
	return scanContact(r.db.QueryRow(ctx, q, workspaceID, string(source), externalID))
}

// TouchLastSeen updates last_seen_at to now.
func (r *ContactRepository) TouchLastSeen(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE contacts SET last_seen_at = now(), updated_at = now() WHERE id = $1`, id)
	return err
}

// ListFilter is the filter set for ListWithFilters.
type ListFilter struct {
	WorkspaceID  string
	Search       string
	ChannelType  *models.ChannelType
	TagID        *string
	CreatedAfter *time.Time
	Limit        int
	Offset       int
}

// ListWithFilters returns contacts matching the filter. The query is built
// from a small whitelist of fields so it remains injection-safe.
func (r *ContactRepository) ListWithFilters(ctx context.Context, f ListFilter) ([]models.Contact, error) {
	args := []any{f.WorkspaceID}
	join := ""
	where := []string{"c.workspace_id = $1"}

	if f.TagID != nil && *f.TagID != "" {
		join = " JOIN contact_tags ct ON ct.contact_id = c.id"
		args = append(args, *f.TagID)
		where = append(where, "ct.tag_id = $"+itoa(len(args)))
	}
	if f.Search != "" {
		args = append(args, "%"+strings.ToLower(strings.TrimSpace(f.Search))+"%")
		p := "$" + itoa(len(args))
		where = append(where, "(lower(c.name) LIKE "+p+" OR lower(coalesce(c.phone,'')) LIKE "+p+" OR lower(coalesce(c.email,'')) LIKE "+p+")")
	}
	if f.ChannelType != nil {
		args = append(args, string(*f.ChannelType))
		where = append(where, "c.external_source::text = $"+itoa(len(args)))
	}
	if f.CreatedAfter != nil {
		args = append(args, *f.CreatedAfter)
		where = append(where, "c.created_at >= $"+itoa(len(args)))
	}

	limit := f.Limit
	if limit <= 0 || limit > 500 {
		limit = 200
	}

	q := "SELECT " + contactColumnsC + " FROM contacts c" + join +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY c.created_at DESC LIMIT " + itoa(limit)
	if f.Offset > 0 {
		q += " OFFSET " + itoa(f.Offset)
	}

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Contact{}
	for rows.Next() {
		c, err := scanContactRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ListByWorkspace returns all contacts in a workspace (used by export).
func (r *ContactRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.Contact, error) {
	return r.ListWithFilters(ctx, ListFilter{WorkspaceID: workspaceID, Limit: 500})
}

// FindDuplicates returns contacts that share a phone or email with another
// contact in the same workspace.
func (r *ContactRepository) FindDuplicates(ctx context.Context, workspaceID string) ([]models.Contact, error) {
	const q = `
		SELECT ` + contactColumnsC + `
		FROM contacts c
		WHERE c.workspace_id = $1
		  AND (
		    (c.phone IS NOT NULL AND c.phone IN (
		        SELECT phone FROM contacts
		        WHERE workspace_id = $1 AND phone IS NOT NULL
		        GROUP BY phone HAVING count(*) > 1
		    ))
		    OR
		    (c.email IS NOT NULL AND lower(c.email) IN (
		        SELECT lower(email) FROM contacts
		        WHERE workspace_id = $1 AND email IS NOT NULL
		        GROUP BY lower(email) HAVING count(*) > 1
		    ))
		  )
		ORDER BY c.phone NULLS LAST, c.email NULLS LAST, c.name`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Contact{}
	for rows.Next() {
		c, err := scanContactRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ListTags returns the tags attached to a contact.
func (r *ContactRepository) ListTags(ctx context.Context, contactID string) ([]models.Tag, error) {
	const q = `
		SELECT t.id::text, t.workspace_id::text, t.name, t.color, t.created_at
		FROM tags t
		JOIN contact_tags ct ON ct.tag_id = t.id
		WHERE ct.contact_id = $1
		ORDER BY t.name ASC`
	rows, err := r.db.Query(ctx, q, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Tag{}
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// AttachTag links a tag to a contact (idempotent).
func (r *ContactRepository) AttachTag(ctx context.Context, contactID, tagID string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO contact_tags (contact_id, tag_id) VALUES ($1, $2)
		 ON CONFLICT (contact_id, tag_id) DO NOTHING`, contactID, tagID)
	return err
}

// DetachTag removes a tag from a contact.
func (r *ContactRepository) DetachTag(ctx context.Context, contactID, tagID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM contact_tags WHERE contact_id = $1 AND tag_id = $2`, contactID, tagID)
	return err
}

// ReassignConversations moves all conversations from src to dst (used by merge).
func (r *ContactRepository) ReassignConversations(ctx context.Context, srcContactID, dstContactID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE conversations SET contact_id = $2 WHERE contact_id = $1`,
		srcContactID, dstContactID)
	return err
}

// ReassignActivities moves all timeline activities from src to dst.
func (r *ContactRepository) ReassignActivities(ctx context.Context, srcContactID, dstContactID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE contact_activities SET contact_id = $2 WHERE contact_id = $1`,
		srcContactID, dstContactID)
	return err
}

// CopyTagsTo copies tag attachments from src to dst.
func (r *ContactRepository) CopyTagsTo(ctx context.Context, srcContactID, dstContactID string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO contact_tags (contact_id, tag_id)
		SELECT $2, tag_id FROM contact_tags WHERE contact_id = $1
		ON CONFLICT DO NOTHING`, srcContactID, dstContactID)
	return err
}

func scanContact(row pgx.Row) (*models.Contact, error) {
	c, err := scanContactRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func scanContactRow(row pgx.Row) (*models.Contact, error) {
	var c models.Contact
	var source *string
	err := row.Scan(
		&c.ID, &c.WorkspaceID, &c.Name, &c.Phone, &c.Email, &c.AvatarURL,
		&source, &c.ExternalID, &c.Metadata,
		&c.Location, &c.Company, &c.Birthday, &c.Notes,
		&c.LastSeenAt, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if source != nil {
		ct := models.ChannelType(*source)
		c.ExternalSource = &ct
	}
	return &c, nil
}

// itoa avoids strconv import for a single-purpose helper.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
