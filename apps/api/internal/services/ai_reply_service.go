package services

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"

	"github.com/aichat/api/internal/ai"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// AIReplyService orchestrates AI auto-reply for inbound messages and
// powers the chatbot playground. It glues the AI agent settings, the
// knowledge base RAG retrieval and the existing channel deliverers.
type AIReplyService struct {
	ai            *repositories.AIRepository
	agents        *AIAgentService
	knowledge     *KnowledgeService
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	channels      *repositories.ChannelRepository
	deliverers    map[models.ChannelType]ChannelDeliverer
	llm           ai.LLM
	topK          int
}

// NewAIReplyService constructs an AIReplyService.
func NewAIReplyService(
	repo *repositories.AIRepository,
	agents *AIAgentService,
	knowledge *KnowledgeService,
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	channels *repositories.ChannelRepository,
	deliverers map[models.ChannelType]ChannelDeliverer,
	llm ai.LLM,
) *AIReplyService {
	if deliverers == nil {
		deliverers = map[models.ChannelType]ChannelDeliverer{}
	}
	return &AIReplyService{
		ai: repo, agents: agents, knowledge: knowledge,
		conversations: conversations, messages: messages, channels: channels,
		deliverers: deliverers, llm: llm, topK: 4,
	}
}

// MaybeReply is called by each inbound-message dispatcher (WhatsApp/IG/
// Messenger) AFTER the message has been persisted + broadcast. It checks
// all the gates (agent enabled, channel allowed, conversation not in
// human-takeover, prompt approved) and — if green — generates and sends
// a reply through the registered ChannelDeliverer. Logged either way.
//
// Runs in its own goroutine; errors are logged and swallowed.
func (s *AIReplyService) MaybeReply(ctx context.Context, channelID, conversationID, messageID, inboundText string) {
	conv, err := s.conversations.GetByID(ctx, conversationID)
	if err != nil {
		return
	}
	agent, err := s.ai.GetAIAgentByWorkspace(ctx, conv.WorkspaceID)
	if err != nil {
		return // workspace has no agent yet
	}
	if !agent.Enabled || !agent.PromptApproved {
		return
	}
	if disabled, _ := s.conversations.IsAIDisabled(ctx, conversationID); disabled {
		return
	}
	if conv.AssignedAgentID != nil && *conv.AssignedAgentID != "" {
		return // human already on the case
	}
	if !channelInAllowList(channelID, agent.EnabledChannelIDs) {
		return
	}

	result, err := s.generate(ctx, agent, conv.WorkspaceID, inboundText)
	if err != nil {
		log.Printf("ai-reply: generate: %v", err)
		s.logFailure(ctx, conv, &messageID, inboundText, err)
		return
	}

	// Confidence gate → optional handoff.
	if result.Confidence < agent.ConfidenceThreshold && agent.HandoffEnabled {
		s.handoff(ctx, conv, agent, &messageID, inboundText, result)
		return
	}

	// Send the reply via the registered channel deliverer.
	channel, err := s.channels.GetByID(ctx, channelID)
	if err != nil {
		s.logFailure(ctx, conv, &messageID, inboundText, err)
		return
	}
	deliverer, ok := s.deliverers[channel.Type]
	if !ok {
		s.logFailure(ctx, conv, &messageID, inboundText,
			errors.New("no deliverer for channel type"))
		return
	}
	msg, err := deliverer.Deliver(ctx, DeliverInput{
		ChannelID:      channel.ID,
		ConversationID: conv.ID,
		Body:           result.Text,
		// Empty SenderUserID = bot-sent message (bypasses the member
		// guard inside the deliverer).
	})
	if err != nil {
		s.logFailure(ctx, conv, &messageID, inboundText, err)
		return
	}
	s.logSuccess(ctx, conv, &messageID, &msg.ID, inboundText, result, false)
}

// PlaygroundInput powers the operator-facing test endpoint.
type PlaygroundInput struct {
	WorkspaceID  string
	Message      string
	SystemPrompt string // optional override
}

// PlaygroundResult is what the playground returns to the UI.
type PlaygroundResult struct {
	Response   string             `json:"response"`
	Confidence float32            `json:"confidence"`
	Model      string             `json:"model"`
	Chunks     []ai.SearchResult  `json:"chunks"`
	WouldHandoff bool             `json:"would_handoff"`
	Fallback   string             `json:"fallback,omitempty"`
}

// Playground runs the same generation pipeline used in production, but
// without touching the conversation or sending anything.
func (s *AIReplyService) Playground(ctx context.Context, in PlaygroundInput) (*PlaygroundResult, error) {
	agent, err := s.agents.Get(ctx, in.WorkspaceID)
	if err != nil {
		return nil, err
	}
	if in.SystemPrompt != "" {
		agent.SystemPrompt = in.SystemPrompt
	}
	chunks, err := s.retrieve(ctx, agent, in.Message)
	if err != nil {
		return nil, err
	}
	result, err := s.callLLM(ctx, agent, in.Message, chunks)
	if err != nil {
		return nil, err
	}
	wouldHandoff := result.Confidence < agent.ConfidenceThreshold && agent.HandoffEnabled
	out := &PlaygroundResult{
		Response:     result.Text,
		Confidence:   result.Confidence,
		Model:        result.Model,
		Chunks:       chunks,
		WouldHandoff: wouldHandoff,
	}
	if wouldHandoff {
		out.Fallback = agent.FallbackMessage
	}
	return out, nil
}

/* --------------------------- internal helpers --------------------------- */

// generationResult bundles a generated reply with retrieval info.
type generationResult struct {
	Text       string
	Confidence float32
	Model      string
	Chunks     []ai.SearchResult
}

func (s *AIReplyService) generate(ctx context.Context, agent *models.AIAgent, workspaceID, inbound string) (*generationResult, error) {
	chunks, err := s.retrieve(ctx, agent, inbound)
	if err != nil {
		return nil, err
	}
	res, err := s.callLLM(ctx, agent, inbound, chunks)
	if err != nil {
		return nil, err
	}
	return &generationResult{
		Text:       res.Text,
		Confidence: res.Confidence,
		Model:      res.Model,
		Chunks:     chunks,
	}, nil
}

func (s *AIReplyService) retrieve(ctx context.Context, agent *models.AIAgent, query string) ([]ai.SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return nil, nil
	}
	emb, err := s.llm.Embed(ctx, agent.EmbeddingModel, query)
	if err != nil {
		return nil, err
	}
	return s.ai.SearchChunks(ctx, agent.WorkspaceID, emb, s.topK)
}

func (s *AIReplyService) callLLM(ctx context.Context, agent *models.AIAgent, userMessage string, chunks []ai.SearchResult) (*ai.ChatResult, error) {
	system := buildSystemMessage(agent, chunks)
	messages := []ai.ChatMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: userMessage},
	}
	return s.llm.Chat(ctx, messages, ai.ChatOptions{
		Model:       agent.Model,
		Temperature: 0.4,
		MaxTokens:   400,
	})
}

func buildSystemMessage(agent *models.AIAgent, chunks []ai.SearchResult) string {
	var b strings.Builder
	if agent.SystemPrompt != "" {
		b.WriteString(agent.SystemPrompt)
	} else {
		b.WriteString(defaultSystemPrompt())
	}
	b.WriteString("\n\nNama Anda: ")
	b.WriteString(agent.Name)
	b.WriteString("\nNada bicara: ")
	b.WriteString(agent.Tone)
	b.WriteString("\nBahasa: ")
	b.WriteString(agent.Language)

	if len(chunks) > 0 {
		b.WriteString("\n\nKNOWLEDGE:")
		for i, c := range chunks {
			b.WriteString("\n[")
			b.WriteString(itoa(i + 1))
			b.WriteString("] ")
			b.WriteString(c.Content)
		}
	}
	return b.String()
}

func (s *AIReplyService) handoff(ctx context.Context, conv *models.Conversation, agent *models.AIAgent, messageID *string, inbound string, result *generationResult) {
	_, _ = s.conversations.UpdateStatus(ctx, conv.ID, models.ConvPending)
	_ = s.conversations.SetAIDisabled(ctx, conv.ID, true)

	// Optional: also deliver the fallback message so the customer isn't
	// left in silence while waiting for an agent.
	if agent.FallbackMessage != "" {
		channel, err := s.channels.GetByID(ctx, conv.ChannelID)
		if err == nil {
			if deliverer, ok := s.deliverers[channel.Type]; ok {
				if msg, dErr := deliverer.Deliver(ctx, DeliverInput{
					ChannelID:      channel.ID,
					ConversationID: conv.ID,
					Body:           agent.FallbackMessage,
				}); dErr == nil {
					s.logSuccess(ctx, conv, messageID, &msg.ID, inbound, result, true)
					return
				}
			}
		}
	}
	s.logSuccess(ctx, conv, messageID, nil, inbound, result, true)
}

func (s *AIReplyService) logSuccess(ctx context.Context, conv *models.Conversation, msgID, replyID *string, inbound string, r *generationResult, handedOff bool) {
	ids := make([]string, len(r.Chunks))
	for i, c := range r.Chunks {
		ids[i] = c.ChunkID
	}
	chunkIDs, _ := json.Marshal(ids)
	model := r.Model
	resp := r.Text
	in := inbound
	_ = s.ai.CreateBotReplyLog(ctx, repositories.CreateBotReplyLogParams{
		WorkspaceID:      conv.WorkspaceID,
		ConversationID:   &conv.ID,
		InboundMessageID: msgID,
		ReplyMessageID:   replyID,
		InboundText:      &in,
		ResponseText:     &resp,
		Confidence:       r.Confidence,
		HandedOff:        handedOff,
		ChunkIDs:         chunkIDs,
		Model:            &model,
	})
}

func (s *AIReplyService) logFailure(ctx context.Context, conv *models.Conversation, msgID *string, inbound string, err error) {
	errStr := err.Error()
	in := inbound
	_ = s.ai.CreateBotReplyLog(ctx, repositories.CreateBotReplyLogParams{
		WorkspaceID:      conv.WorkspaceID,
		ConversationID:   &conv.ID,
		InboundMessageID: msgID,
		InboundText:      &in,
		ErrorMessage:     &errStr,
	})
}

func channelInAllowList(channelID string, raw json.RawMessage) bool {
	if len(raw) == 0 {
		return true // empty allow-list = all channels
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err != nil {
		return true
	}
	if len(ids) == 0 {
		return true
	}
	for _, id := range ids {
		if id == channelID {
			return true
		}
	}
	return false
}

// itoa avoids the strconv import for a tiny helper used inside the
// system-message builder.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [8]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
