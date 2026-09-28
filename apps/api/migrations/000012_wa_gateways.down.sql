-- Postgres cannot drop enum values, so rebuild channel_type without the
-- gateway values. Gateway channels (and their conversations, messages and
-- credentials, via ON DELETE CASCADE) are removed first.
DELETE FROM channels WHERE type IN ('onesender', 'starsender');
UPDATE contacts SET external_source = NULL
    WHERE external_source IN ('onesender', 'starsender');

ALTER TYPE channel_type RENAME TO channel_type_old;
CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram', 'messenger');
ALTER TABLE channels
    ALTER COLUMN type TYPE channel_type USING type::text::channel_type;
ALTER TABLE contacts
    ALTER COLUMN external_source TYPE channel_type USING external_source::text::channel_type;
DROP TYPE channel_type_old;
