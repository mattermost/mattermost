ALTER TABLE retentionpolicieschannels DROP CONSTRAINT IF EXISTS fk_retentionpolicieschannels_retentionpolicies;
ALTER TABLE retentionpoliciesteams DROP CONSTRAINT IF EXISTS fk_retentionpoliciesteams_retentionpolicies;

DROP TABLE IF EXISTS retentionpolicieschannels;
DROP TABLE IF EXISTS retentionpoliciesteams;
DROP TABLE IF EXISTS retentionpolicies;
