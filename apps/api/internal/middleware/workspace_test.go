package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Integration test: runs only when TEST_DATABASE_URL points at a migrated
// database, e.g. postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable.
func TestWorkspaceGuardsStopChainOnDenial(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	users := repositories.NewUserRepository(pool)
	workspaces := repositories.NewWorkspaceRepository(pool)
	members := repositories.NewWorkspaceMemberRepository(pool)

	suffix := uuid.NewString()[:8]
	newUser := func(name string) *models.User {
		u, err := users.Create(ctx, repositories.CreateUserParams{
			Name: name, Email: name + "-" + suffix + "@example.test", PasswordHash: "x",
		})
		if err != nil {
			t.Fatal(err)
		}
		return u
	}
	owner, viewer, outsider := newUser("owner"), newUser("viewer"), newUser("outsider")

	ws, err := workspaces.Create(ctx, repositories.CreateWorkspaceParams{
		Name: "Guard Test", Slug: "guard-test-" + suffix, OwnerID: owner.ID,
		BrandColor: "#000000", Timezone: "Asia/Jakarta",
	})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	for _, m := range []struct {
		user *models.User
		role models.MemberRole
	}{{owner, models.RoleOwner}, {viewer, models.RoleViewer}} {
		if _, err := members.Add(ctx, repositories.AddMemberParams{
			WorkspaceID: ws.ID, UserID: m.user.ID, Role: m.role,
			Status: models.MemberActive, JoinedAt: &now,
		}); err != nil {
			t.Fatal(err)
		}
	}

	guard := NewWorkspaceMiddleware(members, nil, nil, nil, nil, nil, workspaces)
	e := echo.New()

	call := func(userID string, minimum models.MemberRole) (status int, reached bool) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)
		c.SetParamNames("id")
		c.SetParamValues(ws.ID)
		c.Set(ContextKeyUserID, userID)
		h := guard.RequireWorkspaceRole(minimum)(func(c echo.Context) error {
			reached = true
			return c.NoContent(http.StatusOK)
		})
		if err := h(c); err != nil {
			t.Fatalf("handler chain returned error: %v", err)
		}
		return rec.Code, reached
	}

	cases := []struct {
		name        string
		user        string
		minimum     models.MemberRole
		wantStatus  int
		wantReached bool
	}{
		{"owner allowed", owner.ID, models.RoleAdmin, http.StatusOK, true},
		{"viewer allowed at viewer", viewer.ID, models.RoleViewer, http.StatusOK, true},
		{"viewer denied at admin", viewer.ID, models.RoleAdmin, http.StatusForbidden, false},
		{"outsider denied", outsider.ID, models.RoleViewer, http.StatusNotFound, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, reached := call(tc.user, tc.minimum)
			if status != tc.wantStatus || reached != tc.wantReached {
				t.Fatalf("status=%d reached=%v, want status=%d reached=%v",
					status, reached, tc.wantStatus, tc.wantReached)
			}
		})
	}

	if _, err := pool.Exec(ctx, `UPDATE workspaces SET suspended_at = now() WHERE id = $1`, ws.ID); err != nil {
		t.Fatal(err)
	}
	if status, reached := call(owner.ID, models.RoleViewer); status != http.StatusForbidden || reached {
		t.Fatalf("suspended workspace: status=%d reached=%v, want 403 and not reached", status, reached)
	}
}
