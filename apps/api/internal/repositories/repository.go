// Package repositories contains the data-access layer. Queries are written
// against a DBTX interface so the same repository works against a pool or a
// transaction.
//
// Note: the SQL in `apps/api/sql/queries` mirrors these statements and is
// the source of truth for `sqlc generate`. As the schema grows you can swap
// these hand-written queries for the typed code sqlc produces.
package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound is returned when a query matches no rows.
var ErrNotFound = errors.New("record not found")

// DBTX is satisfied by both *pgxpool.Pool and pgx.Tx.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
