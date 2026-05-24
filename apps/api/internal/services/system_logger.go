package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/aichat/api/internal/repositories"
)

// SystemLogger persists application/system events to system_logs for the
// super-admin "error log" viewer. Writes are best-effort + asynchronous so
// logging never blocks or fails a request.
type SystemLogger struct {
	admin *repositories.AdminRepository
}

// NewSystemLogger constructs a SystemLogger.
func NewSystemLogger(admin *repositories.AdminRepository) *SystemLogger {
	return &SystemLogger{admin: admin}
}

// Log writes one entry off the hot path.
func (l *SystemLogger) Log(level, source, message string, ctxData map[string]any, workspaceID *string) {
	if l == nil || l.admin == nil {
		return
	}
	var raw json.RawMessage
	if len(ctxData) > 0 {
		if b, err := json.Marshal(ctxData); err == nil {
			raw = b
		}
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = l.admin.CreateSystemLog(ctx, repositories.CreateSystemLogParams{
			Level:       level,
			Source:      source,
			Message:     message,
			Context:     raw,
			WorkspaceID: workspaceID,
		})
	}()
}

// Error is a convenience wrapper for error-level events.
func (l *SystemLogger) Error(source, message string, ctxData map[string]any) {
	l.Log("error", source, message, ctxData, nil)
}

// Warn is a convenience wrapper for warn-level events.
func (l *SystemLogger) Warn(source, message string, ctxData map[string]any) {
	l.Log("warn", source, message, ctxData, nil)
}
