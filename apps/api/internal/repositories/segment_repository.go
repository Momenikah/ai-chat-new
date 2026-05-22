package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// SegmentRepository handles persistence for segments and their rules.
type SegmentRepository struct {
	db DBTX
}

// NewSegmentRepository constructs a SegmentRepository.
func NewSegmentRepository(db DBTX) *SegmentRepository {
	return &SegmentRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *SegmentRepository) WithTx(tx pgx.Tx) *SegmentRepository {
	return &SegmentRepository{db: tx}
}

const segmentColumns = `
	id::text, workspace_id::text, name, description, color,
	created_by::text, created_at, updated_at`

// CreateSegmentParams holds inputs for inserting a segment.
type CreateSegmentParams struct {
	WorkspaceID string
	Name        string
	Description *string
	Color       string
	CreatedBy   *string
}

// Create inserts a new segment.
func (r *SegmentRepository) Create(ctx context.Context, p CreateSegmentParams) (*models.Segment, error) {
	const q = `
		INSERT INTO segments (workspace_id, name, description, color, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + segmentColumns
	return scanSegment(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, p.Description, p.Color, p.CreatedBy))
}

// GetByID fetches a segment by id.
func (r *SegmentRepository) GetByID(ctx context.Context, id string) (*models.Segment, error) {
	const q = `SELECT ` + segmentColumns + ` FROM segments WHERE id = $1`
	return scanSegment(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all segments in a workspace.
func (r *SegmentRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.Segment, error) {
	const q = `SELECT ` + segmentColumns + ` FROM segments WHERE workspace_id = $1 ORDER BY name ASC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Segment{}
	for rows.Next() {
		s, err := scanSegmentRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

// Delete removes a segment (cascades to rules).
func (r *SegmentRepository) Delete(ctx context.Context, id, workspaceID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM segments WHERE id = $1 AND workspace_id = $2`, id, workspaceID)
	return err
}

// AddRule inserts a rule.
func (r *SegmentRepository) AddRule(ctx context.Context, segmentID, field, operator, value string) (*models.SegmentRule, error) {
	const q = `INSERT INTO segment_rules (segment_id, field, operator, value)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, segment_id::text, field, operator, value, created_at`
	var rule models.SegmentRule
	if err := r.db.QueryRow(ctx, q, segmentID, field, operator, value).
		Scan(&rule.ID, &rule.SegmentID, &rule.Field, &rule.Operator, &rule.Value, &rule.CreatedAt); err != nil {
		return nil, err
	}
	return &rule, nil
}

// ListRules returns the rules of a segment.
func (r *SegmentRepository) ListRules(ctx context.Context, segmentID string) ([]models.SegmentRule, error) {
	const q = `SELECT id::text, segment_id::text, field, operator, value, created_at
		FROM segment_rules WHERE segment_id = $1 ORDER BY created_at ASC`
	rows, err := r.db.Query(ctx, q, segmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.SegmentRule{}
	for rows.Next() {
		var rule models.SegmentRule
		if err := rows.Scan(&rule.ID, &rule.SegmentID, &rule.Field, &rule.Operator, &rule.Value, &rule.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rule)
	}
	return out, rows.Err()
}

// ClearRules removes all rules of a segment (used by full replace).
func (r *SegmentRepository) ClearRules(ctx context.Context, segmentID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM segment_rules WHERE segment_id = $1`, segmentID)
	return err
}

func scanSegment(row pgx.Row) (*models.Segment, error) {
	s, err := scanSegmentRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s, nil
}

func scanSegmentRow(row pgx.Row) (*models.Segment, error) {
	var s models.Segment
	err := row.Scan(
		&s.ID, &s.WorkspaceID, &s.Name, &s.Description, &s.Color,
		&s.CreatedBy, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
