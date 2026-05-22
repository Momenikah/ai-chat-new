package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Channel-related service errors.
var (
	ErrInvalidChannelType   = errors.New("invalid channel type")
	ErrInvalidChannelStatus = errors.New("invalid channel status")
)

// ChannelService implements channel management with encrypted credentials.
type ChannelService struct {
	channels  *repositories.ChannelRepository
	encryptor *crypto.Encryptor
}

// NewChannelService constructs a ChannelService.
func NewChannelService(channels *repositories.ChannelRepository, encryptor *crypto.Encryptor) *ChannelService {
	return &ChannelService{channels: channels, encryptor: encryptor}
}

// List returns the channels of a workspace.
func (s *ChannelService) List(ctx context.Context, workspaceID string) ([]models.Channel, error) {
	return s.channels.ListByWorkspace(ctx, workspaceID)
}

// Get returns a single channel.
func (s *ChannelService) Get(ctx context.Context, channelID string) (*models.Channel, error) {
	return s.channels.GetByID(ctx, channelID)
}

// CreateChannelInput is the payload for adding a channel.
type CreateChannelInput struct {
	Type        string
	Name        string
	ExternalID  *string
	Credentials map[string]any
}

// Create adds a channel. When credentials are supplied they are encrypted
// at rest and the channel starts in the `pending` state (awaiting
// verification); otherwise it starts `disconnected`.
func (s *ChannelService) Create(ctx context.Context, workspaceID string, in CreateChannelInput) (*models.Channel, error) {
	chType := models.ChannelType(strings.ToLower(strings.TrimSpace(in.Type)))
	if !chType.Valid() {
		return nil, ErrInvalidChannelType
	}

	status := models.StatusDisconnected
	if len(in.Credentials) > 0 {
		status = models.StatusPending
	}

	channel, err := s.channels.Create(ctx, repositories.CreateChannelParams{
		WorkspaceID: workspaceID,
		Type:        chType,
		Name:        strings.TrimSpace(in.Name),
		Status:      status,
		ExternalID:  in.ExternalID,
	})
	if err != nil {
		return nil, err
	}

	if len(in.Credentials) > 0 {
		if err := s.storeCredentials(ctx, channel.ID, in.Credentials); err != nil {
			return nil, err
		}
		channel.HasCredentials = true
	}
	return channel, nil
}

// UpdateChannelInput is the payload for editing a channel.
type UpdateChannelInput struct {
	Name        *string
	Status      *string
	ExternalID  *string
	Credentials map[string]any
}

// Update edits a channel's name/status and optionally rotates credentials.
func (s *ChannelService) Update(ctx context.Context, channelID string, in UpdateChannelInput) (*models.Channel, error) {
	current, err := s.channels.GetByID(ctx, channelID)
	if err != nil {
		return nil, err
	}

	params := repositories.UpdateChannelParams{
		ID:              channelID,
		Name:            current.Name,
		Status:          current.Status,
		ExternalID:      current.ExternalID,
		ErrorMessage:    current.ErrorMessage,
		LastConnectedAt: current.LastConnectedAt,
	}

	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		params.Name = strings.TrimSpace(*in.Name)
	}
	if in.ExternalID != nil {
		params.ExternalID = in.ExternalID
	}
	if in.Status != nil {
		st := models.ChannelStatus(strings.ToLower(strings.TrimSpace(*in.Status)))
		if !st.Valid() {
			return nil, ErrInvalidChannelStatus
		}
		params.Status = st
	}

	if len(in.Credentials) > 0 {
		if err := s.storeCredentials(ctx, channelID, in.Credentials); err != nil {
			return nil, err
		}
		// New credentials => re-verification required, unless the caller
		// explicitly set a status in the same request.
		if in.Status == nil {
			params.Status = models.StatusPending
		}
	}

	return s.channels.Update(ctx, params)
}

// Delete removes a channel and its credentials.
func (s *ChannelService) Delete(ctx context.Context, channelID string) error {
	return s.channels.Delete(ctx, channelID)
}

// storeCredentials JSON-encodes, encrypts and persists channel credentials.
func (s *ChannelService) storeCredentials(ctx context.Context, channelID string, creds map[string]any) error {
	plaintext, err := json.Marshal(creds)
	if err != nil {
		return err
	}
	ciphertext, nonce, err := s.encryptor.Encrypt(plaintext)
	if err != nil {
		return err
	}
	return s.channels.UpsertCredentials(ctx, channelID, ciphertext, nonce)
}
