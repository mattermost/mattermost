DROP INDEX IF EXISTS IDX_RetentionPolicies_DisplayName;
CREATE INDEX IF NOT EXISTS IDX_RetentionPolicies_DisplayName_Id ON retentionpolicies (displayname, id);

ALTER TABLE retentionpolicieschannels DROP CONSTRAINT IF EXISTS fk_retentionpolicieschannels_retentionpolicies;
ALTER TABLE retentionpoliciesteams DROP CONSTRAINT IF EXISTS fk_retentionpoliciesteams_retentionpolicies;

DROP INDEX IF EXISTS IDX_RetentionPoliciesChannels_PolicyId;
DROP INDEX IF EXISTS IDX_RetentionPoliciesTeams_PolicyId;

DROP TABLE IF EXISTS retentionpolicieschannels;
DROP TABLE IF EXISTS retentionpoliciesteams;
DROP TABLE IF EXISTS retentionpolicies;
