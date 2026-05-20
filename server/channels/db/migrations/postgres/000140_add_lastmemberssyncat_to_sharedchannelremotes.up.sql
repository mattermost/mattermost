ALTER TABLE sharedchannelremotes ADD COLUMN IF NOT EXISTS lastmemberssyncat bigint DEFAULT 0;
ALTER TABLE sharedchannelusers ADD COLUMN IF NOT EXISTS lastmembershipsyncat bigint DEFAULT 0;