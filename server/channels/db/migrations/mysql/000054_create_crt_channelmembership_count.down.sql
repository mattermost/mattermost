CREATE PROCEDURE ClearCRTChannelMembershipCounts ()
BEGIN
	IF((
		SELECT
			COUNT(*) FROM Systems
		WHERE
			Name = 'CRTChannelMembershipCountsMigrationComplete') > 0) THEN
		DELETE FROM Systems
		WHERE Name = 'CRTChannelMembershipCountsMigrationComplete';
	END IF;
END;

CALL ClearCRTChannelMembershipCounts ();

DROP PROCEDURE IF EXISTS ClearCRTChannelMembershipCounts;