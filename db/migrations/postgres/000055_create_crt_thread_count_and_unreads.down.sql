DO $$
	<< clear_crt_thread_counts_and_unreads >>
BEGIN
	IF((
		SELECT
			COUNT(*)
		FROM systems
	WHERE
		Name = 'CRTThreadCountsAndUnreadsMigrationComplete') > 0) THEN
		DELETE FROM systems
		WHERE Name = 'CRTThreadCountsAndUnreadsMigrationComplete';
	END IF;
END clear_crt_thread_counts_and_unreads
$$;
