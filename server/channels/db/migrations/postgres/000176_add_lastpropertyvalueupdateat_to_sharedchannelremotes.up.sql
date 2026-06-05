ALTER TABLE sharedchannelremotes ADD COLUMN IF NOT EXISTS lastpropertyvalueupdateat bigint DEFAULT 0;
