-- Part 13: unofficial WhatsApp gateways (OneSender, StarSender).
--
-- Each gateway is its own channel type so routing, plan limits and the UI
-- can tell them apart from the official Cloud API channel. Credentials
-- (API key, instance URL, webhook token) live encrypted in
-- channel_credentials like every other provider.
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'onesender';
ALTER TYPE channel_type ADD VALUE IF NOT EXISTS 'starsender';
