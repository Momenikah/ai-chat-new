package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// ChannelRepository handles persistence for channels and their encrypted
// credentials.
type ChannelRepository struct {
	db DBTX
}

// NewChannelRepository constructs a ChannelRepository.
func NewChannelRepository(db DBTX) *ChannelRepository {
	return &ChannelRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *ChannelRepository) WithTx(tx pgx.Tx) *ChannelRepository {
	return &ChannelRepository{db: tx}
}

// channelSelect lists columns plus a has_credentials existence flag.
const channelSelect = `
	c.id::text, c.workspace_id::text, c.type::text, c.name, c.status::text,
	c.external_id, c.error_message, c.last_connected_at, c.created_at, c.updated_at,
	EXISTS(SELECT 1 FROM channel_credentials cc WHERE cc.channel_id = c.id) AS has_credentials`

// CreateChannelParams holds inputs for inserting a channel.
type CreateChannelParams struct {
	WorkspaceID string
	Type        models.ChannelType
	Name        string
	Status      models.ChannelStatus
	ExternalID  *string
}

// Create inserts a new channel.
func (r *ChannelRepository) Create(ctx context.Context, p CreateChannelParams) (*models.Channel, error) {
	const q = `
		INSERT INTO channels (workspace_id, type, name, status, external_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id::text, workspace_id::text, type::text, name, status::text,
			external_id, error_message, last_connected_at, created_at, updated_at`
	var c models.Channel
	var typ, status string
	err := r.db.QueryRow(ctx, q,
		p.WorkspaceID, string(p.Type), p.Name, string(p.Status), p.ExternalID).
		Scan(&c.ID, &c.WorkspaceID, &typ, &c.Name, &status,
			&c.ExternalID, &c.ErrorMessage, &c.LastConnectedAt, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	c.Type = models.ChannelType(typ)
	c.Status = models.ChannelStatus(status)
	return &c, nil
}

// GetByID fetches a channel by id.
func (r *ChannelRepository) GetByID(ctx context.Context, id string) (*models.Channel, error) {
	const q = `SELECT ` + channelSelect + ` FROM channels c WHERE c.id = $1`
	return scanChannel(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all channels of a workspace.
func (r *ChannelRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.Channel, error) {
	const q = `SELECT ` + channelSelect + `
		FROM channels c WHERE c.workspace_id = $1 ORDER BY c.created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Channel{}
	for rows.Next() {
		c, err := scanChannelRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// UpdateChannelParams holds the mutable channel fields.
type UpdateChannelParams struct {
	ID              string
	Name            string
	Status          models.ChannelStatus
	ExternalID      *string
	ErrorMessage    *string
	LastConnectedAt *time.Time
}

// Update saves the editable channel fields.
func (r *ChannelRepository) Update(ctx context.Context, p UpdateChannelParams) (*models.Channel, error) {
	const q = `
		UPDATE channels
		SET name = $2, status = $3, external_id = $4,
		    error_message = $5, last_connected_at = $6, updated_at = now()
		WHERE id = $1`
	if _, err := r.db.Exec(ctx, q,
		p.ID, p.Name, string(p.Status), p.ExternalID, p.ErrorMessage, p.LastConnectedAt); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, p.ID)
}

// Delete removes a channel (cascades to channel_credentials).
func (r *ChannelRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM channels WHERE id = $1`, id)
	return err
}

// FindByExternalID returns a channel of the given type by its external id
// (e.g. WhatsApp phone_number_id). Used to route incoming webhooks.
func (r *ChannelRepository) FindByExternalID(ctx context.Context, chType models.ChannelType, externalID string) (*models.Channel, error) {
	const q = `SELECT ` + channelSelect + `
		FROM channels c
		WHERE c.type = $1 AND c.external_id = $2
		LIMIT 1`
	return scanChannel(r.db.QueryRow(ctx, q, string(chType), externalID))
}

// UpsertCredentials stores (or replaces) the encrypted credentials of a channel.
func (r *ChannelRepository) UpsertCredentials(ctx context.Context, channelID string, ciphertext, nonce []byte) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO channel_credentials (channel_id, ciphertext, nonce)
		VALUES ($1, $2, $3)
		ON CONFLICT (channel_id)
		DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
		              nonce = EXCLUDED.nonce,
		              updated_at = now()`, channelID, ciphertext, nonce)
	return err
}

// GetCredentials returns the encrypted credential blob of a channel.
func (r *ChannelRepository) GetCredentials(ctx context.Context, channelID string) (ciphertext, nonce []byte, err error) {
	err = r.db.QueryRow(ctx,
		`SELECT ciphertext, nonce FROM channel_credentials WHERE channel_id = $1`, channelID).
		Scan(&ciphertext, &nonce)
	if err == pgx.ErrNoRows {
		return nil, nil, ErrNotFound
	}
	return ciphertext, nonce, err
}

func scanChannel(row pgx.Row) (*models.Channel, error) {
	c, err := scanChannelRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func scanChannelRow(row pgx.Row) (*models.Channel, error) {
	var c models.Channel
	var typ, status string
	if err := row.Scan(
		&c.ID, &c.WorkspaceID, &typ, &c.Name, &status,
		&c.ExternalID, &c.ErrorMessage, &c.LastConnectedAt, &c.CreatedAt, &c.UpdatedAt,
		&c.HasCredentials,
	); err != nil {
		return nil, err
	}
	c.Type = models.ChannelType(typ)
	c.Status = models.ChannelStatus(status)
	return &c, nil
}
