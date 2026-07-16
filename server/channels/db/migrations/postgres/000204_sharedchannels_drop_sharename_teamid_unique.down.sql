ALTER TABLE sharedchannels ADD CONSTRAINT sharedchannels_sharename_teamid_key UNIQUE (sharename, teamid);
