-- Remove DCR (Dynamic Client Registration) fields from OAuthApps table

ALTER TABLE oauthapps DROP COLUMN IF EXISTS isdynamicallyregistered;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS tokenendpointauthmethod;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS responsetypes;
ALTER TABLE oauthapps DROP COLUMN IF EXISTS granttypes;
