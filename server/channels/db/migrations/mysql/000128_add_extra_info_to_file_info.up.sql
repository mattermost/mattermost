CREATE PROCEDURE Migrate_FileInfoExtraInfo ()
BEGIN
DECLARE
	FileInfoExtraInfo_EXIST INT;
	SELECT
		COUNT(*)
	FROM
		INFORMATION_SCHEMA.COLUMNS
	WHERE
		TABLE_NAME = 'fileinfo'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'extrainfo' INTO FileInfoExtraInfo_EXIST;
	IF(FileInfoExtraInfo_EXIST = 0) THEN
				ALTER TABLE fileinfo ADD COLUMN extrainfo text;
				UPDATE fileinfo SET extrainfo = '';
	END IF;
END;
	CALL Migrate_FileInfoExtraInfo ();
	DROP PROCEDURE IF EXISTS Migrate_FileInfoExtraInfo;
