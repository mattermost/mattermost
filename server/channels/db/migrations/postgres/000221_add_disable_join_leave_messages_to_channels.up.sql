ALTER TABLE Channels ADD COLUMN IF NOT EXISTS DisableJoinLeaveMessages boolean NOT NULL DEFAULT false;
