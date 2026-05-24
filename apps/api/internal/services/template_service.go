package services

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Template-related service errors.
var (
	ErrTemplateNotFound   = errors.New("template not found")
	ErrTemplateLocked     = errors.New("template is pending/approved and cannot be edited")
	ErrInvalidCategory    = errors.New("invalid template category")
	ErrInvalidStatusFlow  = errors.New("invalid status transition")
	ErrEmptyTemplateBody  = errors.New("template body must not be empty")
)

// TemplateService implements template CRUD + variable handling + submit +
// usage rendering.
type TemplateService struct {
	pool     *pgxpool.Pool
	templates *repositories.TemplateRepository
}

// NewTemplateService constructs a TemplateService.
func NewTemplateService(pool *pgxpool.Pool, templates *repositories.TemplateRepository) *TemplateService {
	return &TemplateService{pool: pool, templates: templates}
}

// TemplateVariableInput is one variable on a Create/Update request.
type TemplateVariableInput struct {
	Name        string
	Label       *string
	SampleValue *string
}

// CreateTemplateInput is the payload for creating a template.
type CreateTemplateInput struct {
	WorkspaceID   string
	ActorID       string
	Name          string
	Category      string
	Language      string
	HeaderKind    *string
	HeaderContent *string
	Body          string
	Footer        *string
	Buttons       json.RawMessage
	Variables     []TemplateVariableInput
}

// Create inserts a draft template + its variables in one transaction.
func (s *TemplateService) Create(ctx context.Context, in CreateTemplateInput) (*models.TemplateWithVariables, error) {
	body := strings.TrimSpace(in.Body)
	if body == "" {
		return nil, ErrEmptyTemplateBody
	}
	cat := models.TemplateCategory(in.Category)
	if !cat.Valid() {
		return nil, ErrInvalidCategory
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	actor := in.ActorID
	tmpl, err := s.templates.WithTx(tx).Create(ctx, repositories.CreateTemplateParams{
		WorkspaceID:   in.WorkspaceID,
		Name:          strings.TrimSpace(in.Name),
		Category:      cat,
		Status:        models.TemplateDraft,
		Language:      in.Language,
		HeaderKind:    in.HeaderKind,
		HeaderContent: in.HeaderContent,
		Body:          body,
		Footer:        in.Footer,
		Buttons:       in.Buttons,
		CreatedBy:     &actor,
	})
	if err != nil {
		return nil, err
	}
	vars, err := s.persistVariables(ctx, tx, tmpl.ID, in.Variables)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &models.TemplateWithVariables{MessageTemplate: *tmpl, Variables: vars}, nil //nolint:govet
}

// UpdateTemplateInput is the payload for editing a template.
type UpdateTemplateInput struct {
	ID            string
	Name          string
	Category      string
	Language      string
	HeaderKind    *string
	HeaderContent *string
	Body          string
	Footer        *string
	Buttons       json.RawMessage
	Variables     []TemplateVariableInput
}

// Update saves the editable fields and replaces variables in one transaction.
// Only draft/rejected templates may be edited (enforced at the repo level).
func (s *TemplateService) Update(ctx context.Context, in UpdateTemplateInput) (*models.TemplateWithVariables, error) {
	current, err := s.templates.GetByID(ctx, in.ID)
	if err != nil {
		return nil, ErrTemplateNotFound
	}
	if current.Status == models.TemplatePending || current.Status == models.TemplateApproved {
		return nil, ErrTemplateLocked
	}
	cat := models.TemplateCategory(in.Category)
	if !cat.Valid() {
		return nil, ErrInvalidCategory
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	tmpl, err := s.templates.WithTx(tx).Update(ctx, repositories.UpdateTemplateParams{
		ID:            in.ID,
		Name:          strings.TrimSpace(in.Name),
		Category:      cat,
		Language:      in.Language,
		HeaderKind:    in.HeaderKind,
		HeaderContent: in.HeaderContent,
		Body:          strings.TrimSpace(in.Body),
		Footer:        in.Footer,
		Buttons:       in.Buttons,
	})
	if err != nil {
		return nil, err
	}
	if err := s.templates.WithTx(tx).ClearVariables(ctx, tmpl.ID); err != nil {
		return nil, err
	}
	vars, err := s.persistVariables(ctx, tx, tmpl.ID, in.Variables)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &models.TemplateWithVariables{MessageTemplate: *tmpl, Variables: vars}, nil
}

// persistVariables clears + reinserts the template's variables using the
// given transaction. The caller is responsible for commit/rollback.
func (s *TemplateService) persistVariables(ctx context.Context, tx pgx.Tx, templateID string, vars []TemplateVariableInput) ([]models.TemplateVariable, error) {
	repo := s.templates.WithTx(tx)
	out := make([]models.TemplateVariable, 0, len(vars))
	for i, v := range vars {
		name := strings.TrimSpace(v.Name)
		if name == "" {
			continue
		}
		rec, err := repo.AddVariable(ctx, templateID, name, v.Label, v.SampleValue, i)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, nil
}

// Get returns a template with its variables.
func (s *TemplateService) Get(ctx context.Context, id string) (*models.TemplateWithVariables, error) {
	tmpl, err := s.templates.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	vars, err := s.templates.ListVariables(ctx, id)
	if err != nil {
		return nil, err
	}
	return &models.TemplateWithVariables{MessageTemplate: *tmpl, Variables: vars}, nil
}

// List returns the templates of a workspace.
func (s *TemplateService) List(ctx context.Context, workspaceID string) ([]models.MessageTemplate, error) {
	return s.templates.ListByWorkspace(ctx, workspaceID)
}

// Delete removes a template.
func (s *TemplateService) Delete(ctx context.Context, id string) error {
	return s.templates.Delete(ctx, id)
}

// Submit transitions a draft template to pending and (for the demo) flips
// it to approved 3s later — a placeholder for the real Meta template-
// submission API which is per-category and quite involved.
func (s *TemplateService) Submit(ctx context.Context, id string) (*models.MessageTemplate, error) {
	current, err := s.templates.GetByID(ctx, id)
	if err != nil {
		return nil, ErrTemplateNotFound
	}
	if current.Status != models.TemplateDraft && current.Status != models.TemplateRejected {
		return nil, ErrInvalidStatusFlow
	}
	now := time.Now()
	updated, err := s.templates.UpdateStatus(ctx, repositories.UpdateStatusParams{
		ID:              id,
		Status:          models.TemplatePending,
		SubmittedAt:     &now,
		RejectionReason: nil,
	})
	if err != nil {
		return nil, err
	}
	go s.simulateApproval(id)
	return updated, nil
}

// simulateApproval flips the template to "approved" after a short delay.
// Replace with a real call to Meta's template-submission API in Part 8+.
func (s *TemplateService) simulateApproval(id string) {
	time.Sleep(3 * time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	now := time.Now()
	externalID := "demo-template-" + id[:8]
	if _, err := s.templates.UpdateStatus(ctx, repositories.UpdateStatusParams{
		ID:         id,
		Status:     models.TemplateApproved,
		ApprovedAt: &now,
		ExternalID: &externalID,
	}); err != nil {
		log.Printf("templates: simulate approval: %v", err)
	}
}

// UseTemplateInput is the payload for /templates/:id/use.
type UseTemplateInput struct {
	TemplateID     string
	WorkspaceID    string
	ActorID        string
	ConversationID *string
	Variables      map[string]string
}

// UseResult is what /use returns to the composer.
type UseResult struct {
	TemplateID string  `json:"template_id"`
	Body       string  `json:"body"`
	Footer     *string `json:"footer"`
}

// Use renders a template body with the provided variable values and logs
// the usage. Approved templates only.
func (s *TemplateService) Use(ctx context.Context, in UseTemplateInput) (*UseResult, error) {
	tmpl, err := s.templates.GetByID(ctx, in.TemplateID)
	if err != nil {
		return nil, ErrTemplateNotFound
	}
	if tmpl.Status != models.TemplateApproved {
		return nil, errors.New("template is not approved yet")
	}
	rendered := renderTemplateBody(tmpl.Body, in.Variables)

	varsJSON, _ := json.Marshal(in.Variables)
	// Empty ActorID (e.g. developer-API send) → NULL used_by to avoid the
	// FK-to-users being violated by an empty-string UUID.
	var actorPtr *string
	if in.ActorID != "" {
		actor := in.ActorID
		actorPtr = &actor
	}
	_ = s.templates.LogUsage(ctx, tmpl.ID, in.WorkspaceID, in.ConversationID, actorPtr, varsJSON, rendered)

	return &UseResult{TemplateID: tmpl.ID, Body: rendered, Footer: tmpl.Footer}, nil
}

// renderTemplateBody substitutes `{{name}}` style placeholders with values
// from the variables map. Missing keys are left untouched.
var variablePattern = regexp.MustCompile(`{{\s*([a-zA-Z0-9_]+)\s*}}`)

func renderTemplateBody(body string, values map[string]string) string {
	return variablePattern.ReplaceAllStringFunc(body, func(match string) string {
		m := variablePattern.FindStringSubmatch(match)
		if len(m) < 2 {
			return match
		}
		if v, ok := values[m[1]]; ok {
			return v
		}
		return match
	})
}
