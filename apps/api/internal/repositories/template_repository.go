package repositories

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// TemplateRepository handles persistence for message templates, their
// variables, and the usage log.
type TemplateRepository struct {
	db DBTX
}

// NewTemplateRepository constructs a TemplateRepository.
func NewTemplateRepository(db DBTX) *TemplateRepository {
	return &TemplateRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *TemplateRepository) WithTx(tx pgx.Tx) *TemplateRepository {
	return &TemplateRepository{db: tx}
}

const templateColumns = `
	id::text, workspace_id::text, name, category::text, status::text, language,
	header_kind, header_content, body, footer, buttons,
	external_id, submitted_at, approved_at, rejection_reason,
	created_by::text, created_at, updated_at`

// CreateTemplateParams holds inputs for inserting a template.
type CreateTemplateParams struct {
	WorkspaceID   string
	Name          string
	Category      models.TemplateCategory
	Status        models.TemplateStatus
	Language      string
	HeaderKind    *string
	HeaderContent *string
	Body          string
	Footer        *string
	Buttons       json.RawMessage
	CreatedBy     *string
}

// Create inserts a template (without variables; use AddVariable for those).
func (r *TemplateRepository) Create(ctx context.Context, p CreateTemplateParams) (*models.MessageTemplate, error) {
	if p.Status == "" {
		p.Status = models.TemplateDraft
	}
	if p.Language == "" {
		p.Language = "id"
	}
	if len(p.Buttons) == 0 {
		p.Buttons = json.RawMessage(`[]`)
	}
	const q = `
		INSERT INTO message_templates
			(workspace_id, name, category, status, language,
			 header_kind, header_content, body, footer, buttons, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING ` + templateColumns
	return scanTemplate(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, string(p.Category), string(p.Status), p.Language,
		p.HeaderKind, p.HeaderContent, p.Body, p.Footer, p.Buttons, p.CreatedBy,
	))
}

// GetByID fetches a template by id.
func (r *TemplateRepository) GetByID(ctx context.Context, id string) (*models.MessageTemplate, error) {
	const q = `SELECT ` + templateColumns + ` FROM message_templates WHERE id = $1`
	return scanTemplate(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all templates of a workspace.
func (r *TemplateRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.MessageTemplate, error) {
	const q = `SELECT ` + templateColumns + ` FROM message_templates
		WHERE workspace_id = $1 ORDER BY updated_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.MessageTemplate{}
	for rows.Next() {
		t, err := scanTemplateRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

// UpdateTemplateParams holds the mutable fields of a template.
type UpdateTemplateParams struct {
	ID            string
	Name          string
	Category      models.TemplateCategory
	Language      string
	HeaderKind    *string
	HeaderContent *string
	Body          string
	Footer        *string
	Buttons       json.RawMessage
}

// Update saves the editable fields. Only draft/rejected templates may be
// edited; the SQL guard returns no rows in any other case.
func (r *TemplateRepository) Update(ctx context.Context, p UpdateTemplateParams) (*models.MessageTemplate, error) {
	if len(p.Buttons) == 0 {
		p.Buttons = json.RawMessage(`[]`)
	}
	const q = `UPDATE message_templates
		SET name = $2, category = $3, language = $4,
		    header_kind = $5, header_content = $6, body = $7, footer = $8,
		    buttons = $9, updated_at = now()
		WHERE id = $1 AND status IN ('draft', 'rejected')
		RETURNING ` + templateColumns
	return scanTemplate(r.db.QueryRow(ctx, q,
		p.ID, p.Name, string(p.Category), p.Language,
		p.HeaderKind, p.HeaderContent, p.Body, p.Footer, p.Buttons,
	))
}

// UpdateStatusParams holds the status-change fields.
type UpdateStatusParams struct {
	ID              string
	Status          models.TemplateStatus
	SubmittedAt     *time.Time
	ApprovedAt      *time.Time
	RejectionReason *string
	ExternalID      *string
}

// UpdateStatus flips the lifecycle status of a template.
func (r *TemplateRepository) UpdateStatus(ctx context.Context, p UpdateStatusParams) (*models.MessageTemplate, error) {
	const q = `UPDATE message_templates
		SET status            = $2,
		    submitted_at      = COALESCE($3, submitted_at),
		    approved_at       = COALESCE($4, approved_at),
		    rejection_reason  = $5,
		    external_id       = COALESCE($6, external_id),
		    updated_at        = now()
		WHERE id = $1
		RETURNING ` + templateColumns
	return scanTemplate(r.db.QueryRow(ctx, q,
		p.ID, string(p.Status), p.SubmittedAt, p.ApprovedAt, p.RejectionReason, p.ExternalID,
	))
}

// Delete removes a template.
func (r *TemplateRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM message_templates WHERE id = $1`, id)
	return err
}

// --- variables --------------------------------------------------------------

// AddVariable inserts one template variable.
func (r *TemplateRepository) AddVariable(ctx context.Context, templateID, name string, label, sampleValue *string, position int) (*models.TemplateVariable, error) {
	const q = `
		INSERT INTO template_variables (template_id, name, label, sample_value, position)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, template_id::text, name, label, sample_value, position, created_at`
	var v models.TemplateVariable
	if err := r.db.QueryRow(ctx, q, templateID, name, label, sampleValue, position).
		Scan(&v.ID, &v.TemplateID, &v.Name, &v.Label, &v.SampleValue, &v.Position, &v.CreatedAt); err != nil {
		return nil, err
	}
	return &v, nil
}

// ListVariables returns all variables of a template.
func (r *TemplateRepository) ListVariables(ctx context.Context, templateID string) ([]models.TemplateVariable, error) {
	const q = `SELECT id::text, template_id::text, name, label, sample_value, position, created_at
		FROM template_variables WHERE template_id = $1 ORDER BY position ASC`
	rows, err := r.db.Query(ctx, q, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.TemplateVariable{}
	for rows.Next() {
		var v models.TemplateVariable
		if err := rows.Scan(&v.ID, &v.TemplateID, &v.Name, &v.Label, &v.SampleValue, &v.Position, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ClearVariables removes every variable on a template (used when editing).
func (r *TemplateRepository) ClearVariables(ctx context.Context, templateID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM template_variables WHERE template_id = $1`, templateID)
	return err
}

// --- usage logs -------------------------------------------------------------

// LogUsage appends one usage-log row.
func (r *TemplateRepository) LogUsage(ctx context.Context, templateID, workspaceID string, conversationID, usedBy *string, variables json.RawMessage, rendered string) error {
	if len(variables) == 0 {
		variables = json.RawMessage(`{}`)
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO template_usage_logs
			(template_id, workspace_id, conversation_id, used_by, variables, rendered_body)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		templateID, workspaceID, conversationID, usedBy, variables, rendered)
	return err
}

func scanTemplate(row pgx.Row) (*models.MessageTemplate, error) {
	t, err := scanTemplateRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func scanTemplateRow(row pgx.Row) (*models.MessageTemplate, error) {
	var t models.MessageTemplate
	var category, status string
	if err := row.Scan(
		&t.ID, &t.WorkspaceID, &t.Name, &category, &status, &t.Language,
		&t.HeaderKind, &t.HeaderContent, &t.Body, &t.Footer, &t.Buttons,
		&t.ExternalID, &t.SubmittedAt, &t.ApprovedAt, &t.RejectionReason,
		&t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
	); err != nil {
		return nil, err
	}
	t.Category = models.TemplateCategory(category)
	t.Status = models.TemplateStatus(status)
	return &t, nil
}
