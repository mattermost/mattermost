-- Remove DCR (Dynamic Client Registration) fields from OAuthApps table

ALTER TABLE oauthapps DROP COLUMN IF EXISTS isdynamicallyregistered;
