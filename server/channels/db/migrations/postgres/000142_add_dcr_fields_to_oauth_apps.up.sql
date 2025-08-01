-- Add DCR (Dynamic Client Registration) fields to OAuthApps table

ALTER TABLE oauthapps ADD COLUMN granttypes TEXT;
ALTER TABLE oauthapps ADD COLUMN responsetypes TEXT;
ALTER TABLE oauthapps ADD COLUMN tokenendpointauthmethod VARCHAR(32) DEFAULT 'client_secret_post';
ALTER TABLE oauthapps ADD COLUMN isdynamicallyregistered BOOLEAN DEFAULT FALSE;
