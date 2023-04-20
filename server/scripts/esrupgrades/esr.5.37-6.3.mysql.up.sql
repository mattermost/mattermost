/* ==> mysql/000054_create_crt_channelmembership_count.up.sql <== */
/* fixCRTChannelMembershipCounts fixes the channel counts, i.e. the total message count,
total root message count, mention count, and mention count in root messages for users
who have viewed the channel after the last post in the channel */

DELIMITER //
CREATE PROCEDURE MigrateCRTChannelMembershipCounts ()
BEGIN
	IF(
		SELECT
			EXISTS (
			SELECT
				* FROM Systems
			WHERE
				Name = 'CRTChannelMembershipCountsMigrationComplete') = 0) THEN
		UPDATE
			ChannelMembers
			INNER JOIN Channels ON Channels.Id = ChannelMembers.ChannelId SET
				MentionCount = 0, MentionCountRoot = 0, MsgCount = Channels.TotalMsgCount, MsgCountRoot = Channels.TotalMsgCountRoot, LastUpdateAt = (
				SELECT
					(SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)))
	WHERE
		ChannelMembers.LastViewedAt >= Channels.LastPostAt;
		INSERT INTO Systems
			VALUES('CRTChannelMembershipCountsMigrationComplete', 'true');
	END IF;
END//
DELIMITER ;
CALL MigrateCRTChannelMembershipCounts ();
DROP PROCEDURE IF EXISTS MigrateCRTChannelMembershipCounts;

/* ==> mysql/000055_create_crt_thread_count_and_unreads.up.sql <== */
/* fixCRTThreadCountsAndUnreads Marks threads as read for users where the last
reply time of the thread is earlier than the time the user viewed the channel.
Marking a thread means setting the mention count to zero and setting the
last viewed at time of the the thread as the last viewed at time
of the channel */

DELIMITER //
CREATE PROCEDURE MigrateCRTThreadCountsAndUnreads ()
BEGIN
	IF(SELECT EXISTS(SELECT * FROM Systems WHERE Name = 'CRTThreadCountsAndUnreadsMigrationComplete') = 0) THEN
		UPDATE
			ThreadMemberships
			INNER JOIN (
				SELECT
					PostId,
					UserId,
					ChannelMembers.LastViewedAt AS CM_LastViewedAt,
					Threads.LastReplyAt
				FROM
					Threads
					INNER JOIN ChannelMembers ON ChannelMembers.ChannelId = Threads.ChannelId
				WHERE
					Threads.LastReplyAt <= ChannelMembers.LastViewedAt) AS q ON ThreadMemberships.Postid = q.PostId
				AND ThreadMemberships.UserId = q.UserId SET LastViewed = q.CM_LastViewedAt + 1, UnreadMentions = 0, LastUpdated = (
				SELECT
					(SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)));
		INSERT INTO Systems
			VALUES('CRTThreadCountsAndUnreadsMigrationComplete', 'true');
	END IF;
END//
DELIMITER ;
CALL MigrateCRTThreadCountsAndUnreads ();
DROP PROCEDURE IF EXISTS MigrateCRTThreadCountsAndUnreads;

/* ==> mysql/000056_upgrade_channels_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id_display_name'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_team_id_display_name ON Channels(TeamId, DisplayName);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id_type'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channels_team_id_type ON Channels(TeamId, Type);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channels_team_id'
    ) > 0,
    'DROP INDEX idx_channels_team_id ON Channels;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

/* ==> mysql/000057_upgrade_command_webhooks_v6.0.up.sql <== */

DELIMITER //
CREATE PROCEDURE MigrateRootId_CommandWebhooks () BEGIN DECLARE ParentId_EXIST INT;
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'CommandWebhooks'
  AND table_schema = DATABASE()
  AND COLUMN_NAME = 'ParentId' INTO ParentId_EXIST;
IF(ParentId_EXIST > 0) THEN
    UPDATE CommandWebhooks SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
END IF;
END//
DELIMITER ;
CALL MigrateRootId_CommandWebhooks ();
DROP PROCEDURE IF EXISTS MigrateRootId_CommandWebhooks;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'CommandWebhooks'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'ALTER TABLE CommandWebhooks DROP COLUMN ParentId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000058_upgrade_channelmembers_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'NotifyProps'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE ChannelMembers MODIFY COLUMN NotifyProps JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_user_id'
    ) > 0,
    'DROP INDEX idx_channelmembers_user_id ON ChannelMembers;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_user_id_channel_id_last_viewed_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channelmembers_user_id_channel_id_last_viewed_at ON ChannelMembers(UserId, ChannelId, LastViewedAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_channelmembers_channel_id_scheme_guest_user_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_channelmembers_channel_id_scheme_guest_user_id ON ChannelMembers(ChannelId, SchemeGuest, UserId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000059_upgrade_users_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Props'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Props JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'NotifyProps'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN NotifyProps JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Timezone'
        AND column_default IS NOT NULL
    ) > 0,
    'ALTER TABLE Users ALTER Timezone DROP DEFAULT;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Timezone'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Timezone JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Users MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000060_upgrade_jobs_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Jobs'
        AND table_schema = DATABASE()
        AND column_name = 'Data'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Jobs MODIFY COLUMN Data JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;


/* ==> mysql/000061_upgrade_link_metadata_v6.0.up.sql <== */

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'LinkMetadata'
        AND table_schema = DATABASE()
        AND column_name = 'Data'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE LinkMetadata MODIFY COLUMN Data JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000062_upgrade_sessions_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'Props'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Sessions MODIFY COLUMN Props JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;


/* ==> mysql/000063_upgrade_threads_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'Participants'
        AND column_type != 'JSON'
    ) > 0,
    'ALTER TABLE Threads MODIFY COLUMN Participants JSON;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND index_name = 'idx_threads_channel_id_last_reply_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_threads_channel_id_last_reply_at ON Threads(ChannelId, LastReplyAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND index_name = 'idx_threads_channel_id'
    ) > 0,
    'DROP INDEX idx_threads_channel_id ON Threads;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

/* ==> mysql/000064_upgrade_status_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_status_dndendtime'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_status_status_dndendtime ON Status(Status, DNDEndTime);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Status'
        AND table_schema = DATABASE()
        AND index_name = 'idx_status_status'
    ) > 0,
    'DROP INDEX idx_status_status ON Status;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

/* ==> mysql/000065_upgrade_groupchannels_v6.0.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'GroupChannels'
        AND table_schema = DATABASE()
        AND index_name = 'idx_groupchannels_schemeadmin'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_groupchannels_schemeadmin ON GroupChannels(SchemeAdmin);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000066_upgrade_posts_v6.0.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateRootId_Posts ()
BEGIN
DECLARE ParentId_EXIST INT;
DECLARE Alter_FileIds INT;
DECLARE Alter_Props INT;
SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Posts'
  AND table_schema = DATABASE()
  AND COLUMN_NAME = 'ParentId' INTO ParentId_EXIST;
SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE table_name = 'Posts'
  AND table_schema = DATABASE()
  AND column_name = 'FileIds'
  AND column_type != 'text' INTO Alter_FileIds;
SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE table_name = 'Posts'
  AND table_schema = DATABASE()
  AND column_name = 'Props'
  AND column_type != 'JSON' INTO Alter_Props;
IF (Alter_Props OR Alter_FileIds) THEN
	IF(ParentId_EXIST > 0) THEN
		UPDATE Posts SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
		ALTER TABLE Posts MODIFY COLUMN FileIds text, MODIFY COLUMN Props JSON, DROP COLUMN ParentId;
	ELSE
		ALTER TABLE Posts MODIFY COLUMN FileIds text, MODIFY COLUMN Props JSON;
	END IF;
END IF;
END//
DELIMITER ;
CALL MigrateRootId_Posts ();
DROP PROCEDURE IF EXISTS MigrateRootId_Posts;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id_delete_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_posts_root_id_delete_at ON Posts(RootId, DeleteAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_root_id'
    ) > 0,
    'DROP INDEX idx_posts_root_id ON Posts;',
    'SELECT 1'
));

PREPARE removeIndexIfExists FROM @preparedStatement;
EXECUTE removeIndexIfExists;
DEALLOCATE PREPARE removeIndexIfExists;

/* ==> mysql/000067_upgrade_channelmembers_v6.1.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE ChannelMembers MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000068_upgrade_teammembers_v6.1.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE TeamMembers MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000069_upgrade_jobs_v6.1.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Jobs'
        AND table_schema = DATABASE()
        AND index_name = 'idx_jobs_status_type'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_jobs_status_type ON Jobs(Status, Type);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000070_upgrade_cte_v6.1.up.sql <== */
DELIMITER //
CREATE PROCEDURE Migrate_LastRootPostAt ()
BEGIN
DECLARE
	LastRootPostAt_EXIST INT;
	SELECT
		COUNT(*)
	FROM
		INFORMATION_SCHEMA.COLUMNS
	WHERE
		TABLE_NAME = 'Channels'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'LastRootPostAt' INTO LastRootPostAt_EXIST;
	IF(LastRootPostAt_EXIST = 0) THEN
        ALTER TABLE Channels ADD COLUMN LastRootPostAt bigint DEFAULT 0;
		UPDATE
			Channels
			INNER JOIN (
				SELECT
					Channels.Id channelid,
					COALESCE(MAX(Posts.CreateAt), 0) AS lastrootpost
				FROM
					Channels
					LEFT JOIN Posts FORCE INDEX (idx_posts_channel_id_update_at) ON Channels.Id = Posts.ChannelId
				WHERE
					Posts.RootId = ''
				GROUP BY
					Channels.Id) AS q ON q.channelid = Channels.Id SET LastRootPostAt = lastrootpost;
	END IF;
END//
DELIMITER ;
CALL Migrate_LastRootPostAt ();
DROP PROCEDURE IF EXISTS Migrate_LastRootPostAt;

/* ==> mysql/000071_upgrade_sessions_v6.1.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Sessions'
        AND table_schema = DATABASE()
        AND column_name = 'Roles'
        AND column_type != 'text'
    ) > 0,
    'ALTER TABLE Sessions MODIFY COLUMN Roles text;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000072_upgrade_schemes_v6.3.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultPlaybookAdminRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD COLUMN DefaultPlaybookAdminRole VARCHAR(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultPlaybookMemberRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD COLUMN DefaultPlaybookMemberRole VARCHAR(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultRunAdminRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD COLUMN DefaultRunAdminRole VARCHAR(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Schemes'
        AND table_schema = DATABASE()
        AND column_name = 'DefaultRunMemberRole'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Schemes ADD COLUMN DefaultRunMemberRole VARCHAR(64) DEFAULT "";'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

/* ==> mysql/000073_upgrade_plugin_key_value_store_v6.3.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT Count(*) FROM Information_Schema.Columns
        WHERE table_name = 'PluginKeyValueStore'
        AND table_schema = DATABASE()
        AND column_name = 'PKey'
        AND column_type != 'varchar(150)'
    ) > 0,
    'ALTER TABLE PluginKeyValueStore MODIFY COLUMN PKey varchar(150);',
    'SELECT 1'
));

PREPARE alterTypeIfExists FROM @preparedStatement;
EXECUTE alterTypeIfExists;
DEALLOCATE PREPARE alterTypeIfExists;

/* ==> mysql/000074_upgrade_users_v6.3.up.sql <== */

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'AcceptedTermsOfServiceId'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN AcceptedTermsOfServiceId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
