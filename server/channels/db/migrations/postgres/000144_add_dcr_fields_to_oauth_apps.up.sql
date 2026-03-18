-- Add DCR (Dynamic Client Registration) fields to OAuthApps table

ALTER TABLE oauthapps ADD COLUMN IF NOT EXISTS isdynamicallyregistered BOOLEAN DEFAULT FALSE;
