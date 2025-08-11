-- Add DCR (Dynamic Client Registration) fields to OAuthApps table

ALTER TABLE oauthapps ADD COLUMN isdynamicallyregistered BOOLEAN DEFAULT FALSE;
