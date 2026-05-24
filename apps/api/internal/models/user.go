package models

import "time"

// User is an authenticated account. From Part 2 onward a user is no longer
// tied to a single tenant — workspace membership lives on workspace_members.
type User struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	AvatarURL    *string    `json:"avatar_url"`
	IsActive     bool       `json:"is_active"`
	IsSuperAdmin bool       `json:"is_super_admin"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
