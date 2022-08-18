CREATE TABLE IF NOT EXISTS retentionpolicies (
	id VARCHAR(26),
	displayname VARCHAR(64),
	postduration bigint,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS retentionpoliciesteams (
	PolicyId varchar(26),
    teamid varchar(26),
    PRIMARY KEY (teamid)
);

CREATE TABLE IF NOT EXISTS retentionpolicieschannels (
	policyid varchar(26),
    channelid varchar(26),
    PRIMARY KEY (channelid)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_retentionpoliciesteams_retentionpolicies') THEN
        ALTER TABLE retentionpoliciesteams
            ADD CONSTRAINT fk_retentionpoliciesteams_retentionpolicies
            FOREIGN KEY (policyid) REFERENCES retentionpolicies (id) ON DELETE CASCADE;
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_retentionpolicieschannels_retentionpolicies') THEN
        ALTER TABLE retentionpolicieschannels
            ADD CONSTRAINT fk_retentionpolicieschannels_retentionpolicies
            FOREIGN KEY (policyid) REFERENCES retentionpolicies (id) ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS IDX_RetentionPoliciesTeams_PolicyId ON retentionpoliciesteams (policyid);
CREATE INDEX IF NOT EXISTS IDX_RetentionPoliciesChannels_PolicyId ON retentionpolicieschannels (policyid);

DROP INDEX IF EXISTS IDX_RetentionPolicies_DisplayName_Id;
CREATE INDEX IF NOT EXISTS IDX_RetentionPolicies_DisplayName ON retentionpolicies (displayname);
