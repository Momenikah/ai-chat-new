package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// UserRepository handles persistence for users.
type UserRepository struct {
	db DBTX
}

// NewUserRepository constructs a UserRepository.
func NewUserRepository(db DBTX) *UserRepository {
	return &UserRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *UserRepository) WithTx(tx pgx.Tx) *UserRepository {
	return &UserRepository{db: tx}
}

const userColumns = `
	id::text, name, email, password_hash,
	avatar_url, is_active, is_super_admin, last_login_at, created_at, updated_at`

// CreateUserParams holds the inputs required to insert a user.
type CreateUserParams struct {
	Name         string
	Email        string
	PasswordHash string
}

// Create inserts a new user and returns it.
func (r *UserRepository) Create(ctx context.Context, p CreateUserParams) (*models.User, error) {
	const q = `
		INSERT INTO users (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING ` + userColumns
	return scanUser(r.db.QueryRow(ctx, q, p.Name, p.Email, p.PasswordHash))
}

// GetByID fetches a user by id.
func (r *UserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	const q = `SELECT ` + userColumns + ` FROM users WHERE id = $1`
	return scanUser(r.db.QueryRow(ctx, q, id))
}

// GetByEmail fetches a user by email (case-insensitive).
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	const q = `SELECT ` + userColumns + ` FROM users WHERE lower(email) = lower($1)`
	return scanUser(r.db.QueryRow(ctx, q, email))
}

// EmailExists reports whether an email is already registered.
func (r *UserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = lower($1))`, email).
		Scan(&exists)
	return exists, err
}

// TouchLastLogin updates last_login_at to now for the given user.
func (r *UserRepository) TouchLastLogin(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`, id)
	return err
}

// SetSuperAdmin toggles the platform super-admin flag for a user.
func (r *UserRepository) SetSuperAdmin(ctx context.Context, id string, isSuperAdmin bool) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET is_super_admin = $2, updated_at = now() WHERE id = $1`,
		id, isSuperAdmin)
	return err
}

func scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash,
		&u.AvatarURL, &u.IsActive, &u.IsSuperAdmin, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}
