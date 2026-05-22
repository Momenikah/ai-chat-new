package services

import (
	"context"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
)

// PresenceService implements agent online/offline tracking.
type PresenceService struct {
	presence    *repositories.PresenceRepository
	broadcaster realtime.Broadcaster
}

// NewPresenceService constructs a PresenceService.
func NewPresenceService(
	presence *repositories.PresenceRepository,
	broadcaster realtime.Broadcaster,
) *PresenceService {
	return &PresenceService{presence: presence, broadcaster: broadcaster}
}

// Set sets a user's presence and broadcasts the change.
func (s *PresenceService) Set(ctx context.Context, userID, workspaceID, status string) error {
	if err := s.presence.Upsert(ctx, userID, workspaceID, status); err != nil {
		return err
	}
	if s.broadcaster != nil {
		s.broadcaster.Broadcast(workspaceID, realtime.Event{
			Type: realtime.EventPresenceUpdate,
			Payload: map[string]string{
				"user_id": userID,
				"status":  status,
			},
		})
	}
	return nil
}

// List returns presence rows for a workspace.
func (s *PresenceService) List(ctx context.Context, workspaceID string) ([]models.AgentPresence, error) {
	return s.presence.ListByWorkspace(ctx, workspaceID)
}
