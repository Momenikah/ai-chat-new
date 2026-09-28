package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// RefreshToken is a persisted refresh-token record. Only the SHA-256 hash
// of the token is stored.
type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	Revoked   bool
	CreatedAt time.Time
}

// RefreshTokenRepository handles persistence for refresh tokens.
type RefreshTokenRepository struct {
	db DBTX
}

// NewRefreshTokenRepository constructs a RefreshTokenRepository.
func NewRefreshTokenRepository(db DBTX) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *RefreshTokenRepository) WithTx(tx pgx.Tx) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: tx}
}

// Create stores a refresh-token hash for a user.
func (r *RefreshTokenRepository) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)`, userID, tokenHash, expiresAt)
	return err
}

// GetValidByHash returns a non-revoked, non-expired token by its hash.
func (r *RefreshTokenRepository) GetValidByHash(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	const q = `
		SELECT id::text, user_id::text, token_hash, expires_at, revoked, created_at
		FROM refresh_tokens
		WHERE token_hash = $1 AND revoked = false AND expires_at > now()`
	var t RefreshToken
	err := r.db.QueryRow(ctx, q, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.Revoked, &t.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Consume atomically revokes a valid (unrevoked, unexpired) token and
// returns it. Because the check and the revoke are a single UPDATE, two
// concurrent refreshes with the same token cannot both succeed.
func (r *RefreshTokenRepository) Consume(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	const q = `
		UPDATE refresh_tokens SET revoked = true
		WHERE token_hash = $1 AND revoked = false AND expires_at > now()
		RETURNING id::text, user_id::text, token_hash, expires_at, revoked, created_at`
	var t RefreshToken
	err := r.db.QueryRow(ctx, q, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.Revoked, &t.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Revoke marks a single token (by hash) as revoked.
func (r *RefreshTokenRepository) Revoke(ctx context.Context, tokenHash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, tokenHash)
	return err
}

// RevokeAllForUser revokes every active token of a user (full logout).
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`, userID)
	return err
}
