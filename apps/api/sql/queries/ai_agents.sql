-- name: UpsertAIAgent :one
INSERT INTO ai_agents (
    workspace_id, name, tone, language, system_prompt, fallback_message,
    confidence_threshold, enabled, enabled_channel_ids, handoff_enabled,
    model, embedding_model
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (workspace_id) DO UPDATE
SET name                 = EXCLUDED.name,
    tone                 = EXCLUDED.tone,
    language             = EXCLUDED.language,
    system_prompt        = EXCLUDED.system_prompt,
    fallback_message     = EXCLUDED.fallback_message,
    confidence_threshold = EXCLUDED.confidence_threshold,
    enabled              = EXCLUDED.enabled,
    enabled_channel_ids  = EXCLUDED.enabled_channel_ids,
    handoff_enabled      = EXCLUDED.handoff_enabled,
    model                = EXCLUDED.model,
    embedding_model      = EXCLUDED.embedding_model,
    prompt_approved      = FALSE,
    updated_at           = now()
RETURNING *;

-- name: GetAIAgentByWorkspace :one
SELECT * FROM ai_agents WHERE workspace_id = $1;

-- name: SetAIAgentPromptApproved :exec
UPDATE ai_agents
SET prompt_approved = $2, updated_at = now()
WHERE workspace_id = $1;

-- name: CreatePromptReview :one
INSERT INTO ai_prompt_reviews (ai_agent_id, workspace_id, prompt, reviewer_id, status, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListPromptReviews :many
SELECT * FROM ai_prompt_reviews
WHERE ai_agent_id = $1
ORDER BY created_at DESC
LIMIT 50;
