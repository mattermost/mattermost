CREATE PROCEDURE ClearCRTThreadCountsAndUnreads ()
BEGIN
	IF((
		SELECT
			COUNT(*) FROM Systems
		WHERE
			Name = 'CRTThreadCountsAndUnreadsMigrationComplete') > 0) THEN
		DELETE FROM Systems
		WHERE Name = 'CRTThreadCountsAndUnreadsMigrationComplete';
	END IF;
END;

CALL ClearCRTThreadCountsAndUnreads ();

DROP PROCEDURE IF EXISTS ClearCRTThreadCountsAndUnreads;
