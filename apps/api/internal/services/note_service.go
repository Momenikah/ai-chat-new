package services

import (
	"context"
	"errors"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
)

// ErrEmptyNote is returned when an internal-note body is blank.
var ErrEmptyNote = errors.New("note body must not be empty")

// NoteService implements internal-note CRUD on conversations.
type NoteService struct {
	notes         *repositories.NoteRepository
	conversations *repositories.ConversationRepository
	broadcaster   realtime.Broadcaster
}

// NewNoteService constructs a NoteService.
func NewNoteService(
	notes *repositories.NoteRepository,
	conversations *repositories.ConversationRepository,
	broadcaster realtime.Broadcaster,
) *NoteService {
	return &NoteService{notes: notes, conversations: conversations, broadcaster: broadcaster}
}

// Create inserts an internal note and broadcasts it.
func (s *NoteService) Create(ctx context.Context, conversationID, authorID, body string) (*models.InternalNote, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, ErrEmptyNote
	}
	note, err := s.notes.Create(ctx, conversationID, authorID, body)
	if err != nil {
		return nil, err
	}
	if conv, err := s.conversations.GetByID(ctx, conversationID); err == nil && s.broadcaster != nil {
		s.broadcaster.Broadcast(conv.WorkspaceID, realtime.Event{
			Type:    realtime.EventNoteNew,
			Payload: note,
		})
	}
	return note, nil
}

// List returns notes of a conversation, newest first.
func (s *NoteService) List(ctx context.Context, conversationID string) ([]models.InternalNote, error) {
	return s.notes.ListByConversation(ctx, conversationID)
}
