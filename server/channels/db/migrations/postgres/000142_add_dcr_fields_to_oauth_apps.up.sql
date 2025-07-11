-- Add DCR (Dynamic Client Registration) fields to OAuthApps table

-- Required DCR metadata fields
ALTER TABLE oauthapps ADD COLUMN granttypes TEXT;
ALTER TABLE oauthapps ADD COLUMN responsetypes TEXT;
ALTER TABLE oauthapps ADD COLUMN tokenendpointauthmethod VARCHAR(32) DEFAULT 'client_secret_post';

-- Optional DCR metadata fields
ALTER TABLE oauthapps ADD COLUMN clienturi TEXT;
ALTER TABLE oauthapps ADD COLUMN logouri TEXT;
ALTER TABLE oauthapps ADD COLUMN scope TEXT;

-- DCR management fields
ALTER TABLE oauthapps ADD COLUMN clientidissuedat BIGINT DEFAULT 0;
ALTER TABLE oauthapps ADD COLUMN isdynamicallyregistered BOOLEAN DEFAULT FALSE;

-- Add index for dynamic registration lookup
CREATE INDEX idx_oauth_apps_dynamic_registered ON oauthapps(isdynamicallyregistered);