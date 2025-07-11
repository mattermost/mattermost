-- Add DCR (Dynamic Client Registration) fields to OAuthApps table

-- Required DCR metadata fields
ALTER TABLE OAuthApps ADD COLUMN GrantTypes TEXT;
ALTER TABLE OAuthApps ADD COLUMN ResponseTypes TEXT;
ALTER TABLE OAuthApps ADD COLUMN TokenEndpointAuthMethod VARCHAR(32) DEFAULT 'client_secret_post';

-- Optional DCR metadata fields
ALTER TABLE OAuthApps ADD COLUMN ClientURI TEXT;
ALTER TABLE OAuthApps ADD COLUMN LogoURI TEXT;
ALTER TABLE OAuthApps ADD COLUMN Scope TEXT;

-- DCR management fields
ALTER TABLE OAuthApps ADD COLUMN ClientIDIssuedAt BIGINT DEFAULT 0;
ALTER TABLE OAuthApps ADD COLUMN IsDynamicallyRegistered TINYINT(1) DEFAULT 0;

-- Add index for dynamic registration lookup
CREATE INDEX idx_oauth_apps_dynamic_registered ON OAuthApps(IsDynamicallyRegistered);