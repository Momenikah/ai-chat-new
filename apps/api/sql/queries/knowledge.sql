-- name: CreateKnowledgeDocument :one
INSERT INTO knowledge_documents
    (workspace_id, title, source_kind, source_url, mime_type, raw_content, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: ListKnowledgeDocuments :many
SELECT * FROM knowledge_documents
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: GetKnowledgeDocumentByID :one
SELECT * FROM knowledge_documents WHERE id = $1;

-- name: UpdateKnowledgeDocumentStatus :exec
UPDATE knowledge_documents
SET status = $2, chunk_count = $3, error_message = $4, updated_at = now()
WHERE id = $1;

-- name: DeleteKnowledgeDocument :exec
DELETE FROM knowledge_documents WHERE id = $1;

-- name: CreateKnowledgeChunk :exec
INSERT INTO knowledge_chunks
    (document_id, workspace_id, position, content, tokens, embedding, dim)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: ListChunkEmbeddings :many
SELECT id::text, document_id::text, position, content, embedding
FROM knowledge_chunks
WHERE workspace_id = $1 AND dim = $2;

-- name: CreateBotReplyLog :exec
INSERT INTO bot_reply_logs
    (workspace_id, conversation_id, inbound_message_id, reply_message_id,
     inbound_text, response_text, confidence, handed_off, chunk_ids,
     model, error_message)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

-- name: ListBotReplyLogs :many
SELECT * FROM bot_reply_logs
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 100;
