ALTER TABLE threadmemberships ADD COLUMN IF NOT EXISTS ismentiononly boolean DEFAULT false NOT NULL;
