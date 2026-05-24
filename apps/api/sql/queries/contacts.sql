-- name: CreateContact :one
INSERT INTO contacts (
    workspace_id, name, phone, email, avatar_url,
    external_source, external_id, location, company, birthday, notes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetContactByID :one
SELECT * FROM contacts WHERE id = $1;

-- name: ListContactsByWorkspace :many
SELECT * FROM contacts WHERE workspace_id = $1 ORDER BY name ASC;

-- name: UpdateContact :one
UPDATE contacts
SET name             = $2,
    phone            = $3,
    email            = $4,
    avatar_url       = $5,
    location         = $6,
    company          = $7,
    birthday         = $8,
    notes            = $9,
    updated_at       = now()
WHERE id = $1
RETURNING *;

-- name: DeleteContact :exec
DELETE FROM contacts WHERE id = $1;

-- name: FindContactByPhone :one
SELECT * FROM contacts
WHERE workspace_id = $1 AND phone = $2
LIMIT 1;

-- name: FindContactByEmail :one
SELECT * FROM contacts
WHERE workspace_id = $1 AND lower(email) = lower($2)
LIMIT 1;

-- name: FindDuplicateContacts :many
SELECT * FROM contacts
WHERE workspace_id = $1
  AND (
    (phone IS NOT NULL AND phone IN (
        SELECT phone FROM contacts
        WHERE workspace_id = $1 AND phone IS NOT NULL
        GROUP BY phone HAVING count(*) > 1
    ))
    OR
    (email IS NOT NULL AND lower(email) IN (
        SELECT lower(email) FROM contacts
        WHERE workspace_id = $1 AND email IS NOT NULL
        GROUP BY lower(email) HAVING count(*) > 1
    ))
  )
ORDER BY phone, email, name;

-- name: ListContactTags :many
SELECT t.* FROM tags t
JOIN contact_tags ct ON ct.tag_id = t.id
WHERE ct.contact_id = $1
ORDER BY t.name ASC;

-- name: AttachTagToContact :exec
INSERT INTO contact_tags (contact_id, tag_id)
VALUES ($1, $2)
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- name: DetachTagFromContact :exec
DELETE FROM contact_tags
WHERE contact_id = $1 AND tag_id = $2;
