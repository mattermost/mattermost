DO $$
	<< clear_crt_channelmembership_counts >>
BEGIN
	IF((
		SELECT
			COUNT(*)
		FROM systems
	WHERE
		Name = 'CRTChannelMembershipCountsMigrationComplete') > 0) THEN
		DELETE FROM systems
		WHERE Name = 'CRTChannelMembershipCountsMigrationComplete';
	END IF;
END clear_crt_channelmembership_counts
$$;
