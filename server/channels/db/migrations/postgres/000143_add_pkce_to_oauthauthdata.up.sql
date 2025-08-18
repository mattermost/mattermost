ALTER TABLE oauthauthdata ADD COLUMN IF NOT EXISTS codechallenge varchar(128) DEFAULT '';
ALTER TABLE oauthauthdata ADD COLUMN IF NOT EXISTS codechallengemethod varchar(10) DEFAULT '';
