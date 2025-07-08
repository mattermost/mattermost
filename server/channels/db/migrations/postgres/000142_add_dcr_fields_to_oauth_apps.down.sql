-- Remove DCR (Dynamic Client Registration) fields from OAuthApps table

-- Remove index first
DROP INDEX IF EXISTS idx_oauth_apps_dynamic_registered;

-- Remove DCR management fields
ALTER TABLE oauthapps DROP COLUMN IF EXISTS isdynamicallyregistered;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS clientidissuedat;

-- Remove optional DCR metadata fields
ALTER TABLE oauthapps DROP COLUMN IF EXISTS scope;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS logouri;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS clienturi;

-- Remove required DCR metadata fields
ALTER TABLE oauthapps DROP COLUMN IF EXISTS tokenendpointauthmethod;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS responsetypes;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS granttypes;