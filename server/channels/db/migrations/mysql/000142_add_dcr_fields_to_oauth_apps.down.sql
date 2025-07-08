-- Remove DCR (Dynamic Client Registration) fields from OAuthApps table

-- Remove index first
DROP INDEX idx_oauth_apps_dynamic_registered ON OAuthApps;

-- Remove DCR management fields
ALTER TABLE OAuthApps DROP COLUMN IsDynamicallyRegistered;
ALTER TABLE OAuthApps DROP COLUMN ClientIDIssuedAt;

-- Remove optional DCR metadata fields
ALTER TABLE OAuthApps DROP COLUMN Scope;
ALTER TABLE OAuthApps DROP COLUMN LogoURI;
ALTER TABLE OAuthApps DROP COLUMN ClientURI;

-- Remove required DCR metadata fields
ALTER TABLE OAuthApps DROP COLUMN TokenEndpointAuthMethod;
ALTER TABLE OAuthApps DROP COLUMN ResponseTypes;
ALTER TABLE OAuthApps DROP COLUMN GrantTypes;