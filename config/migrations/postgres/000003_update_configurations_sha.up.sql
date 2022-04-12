ALTER TABLE Configurations ADD COLUMN IF NOT EXISTS SHA VARCHAR(64) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_configurations_sha ON Configurations(SHA);

DO $$
	<< migrate_configuration_sha >>
DECLARE
	sha_not_exist boolean := FALSE;
BEGIN
	SELECT
		count(*) > 0 INTO sha_not_exist
	FROM
		Configurations
	WHERE
		SHA = '';
	IF sha_not_exist THEN
	UPDATE
			Configurations
		SET
			SHA = SHA256(Value)
		WHERE
			SHA = '';
		END IF;
END migrate_configuration_sha
$$;
