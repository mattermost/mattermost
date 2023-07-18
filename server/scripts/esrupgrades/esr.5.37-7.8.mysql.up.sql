/* ==> mysql/000041_create_upload_sessions.up.sql <== */
/* Release 5.37 was meant to contain the index idx_uploadsessions_type, but a bug prevented that.
   This part of the migration #41 adds such index */
/* ==> mysql/000075_alter_upload_sessions_index.up.sql <== */
/* ==> mysql/000090_create_enums.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateUploadSessions ()
BEGIN
	-- 'CREATE INDEX idx_uploadsessions_type ON UploadSessions(Type);'
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	-- 'DROP INDEX idx_uploadsessions_user_id ON UploadSessions; CREATE INDEX idx_uploadsessions_user_id ON UploadSessions(UserId);'
	DECLARE AlterIndex BOOLEAN;
	DECLARE AlterIndexQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE UploadSessions MODIFY COLUMN Type ENUM("attachment", "import");'
	DECLARE AlterColumn BOOLEAN;
	DECLARE AlterColumnQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'UploadSessions'
		AND table_schema = DATABASE()
		AND index_name = 'idx_uploadsessions_type'
		INTO CreateIndex;

	SELECT IFNULL(GROUP_CONCAT(column_name ORDER BY seq_in_index), '') = 'Type' FROM information_schema.statistics
		WHERE table_name = 'UploadSessions'
		AND table_schema = DATABASE()
		AND index_name = 'idx_uploadsessions_user_id'
		GROUP BY index_name
		INTO AlterIndex;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'UploadSessions'
		AND table_schema = DATABASE()
		AND column_name = 'Type'
		AND REPLACE(LOWER(column_type), '"', "'") != "enum('attachment','import')"
		INTO AlterColumn;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_uploadsessions_type (Type)';
	END IF;

	IF AlterIndex THEN
		SET AlterIndexQuery = 'DROP INDEX idx_uploadsessions_user_id, ADD INDEX idx_uploadsessions_user_id (UserId)';
	END IF;

	IF AlterColumn THEN
		SET AlterColumnQuery = 'MODIFY COLUMN Type ENUM("attachment", "import")';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', CreateIndexQuery, AlterIndexQuery, AlterColumnQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE UploadSessions ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateUploadSessions procedure starting.') AS DEBUG;
CALL MigrateUploadSessions();
SELECT CONCAT('-- ', NOW(), ' MigrateUploadSessions procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateUploadSessions;

/* ==> mysql/000055_create_crt_thread_count_and_unreads.up.sql <== */
/* fixCRTThreadCountsAndUnreads Marks threads as read for users where the last
reply time of the thread is earlier than the time the user viewed the channel.
Marking a thread means setting the mention count to zero and setting the
last viewed at time of the the thread as the last viewed at time
of the channel */
DELIMITER //
CREATE PROCEDURE MigrateThreadMemberships ()
BEGIN
	-- UPDATE ThreadMemberships SET LastViewed = ..., UnreadMentions = ..., LastUpdated = ...
	DECLARE UpdateThreadMemberships BOOLEAN;
	DECLARE UpdateThreadMembershipsQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM Systems
		WHERE Name = 'CRTThreadCountsAndUnreadsMigrationComplete'
		INTO UpdateThreadMemberships;

	IF UpdateThreadMemberships THEN
		UPDATE ThreadMemberships INNER JOIN (
				SELECT PostId, UserId, ChannelMembers.LastViewedAt AS CM_LastViewedAt, Threads.LastReplyAt
					FROM Threads INNER JOIN ChannelMembers ON ChannelMembers.ChannelId = Threads.ChannelId
					WHERE Threads.LastReplyAt <= ChannelMembers.LastViewedAt
			) AS q ON ThreadMemberships.Postid = q.PostId AND ThreadMemberships.UserId = q.UserId
			SET LastViewed = q.CM_LastViewedAt + 1, UnreadMentions = 0, LastUpdated = (SELECT (SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)));
		INSERT INTO Systems VALUES('CRTThreadCountsAndUnreadsMigrationComplete', 'true');
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateThreadMemberships procedure starting.') AS DEBUG;
CALL MigrateThreadMemberships();
SELECT CONCAT('-- ', NOW(), ' MigrateThreadMemberships procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateThreadMemberships;

/* ==> mysql/000056_upgrade_channels_v6.0.up.sql <== */
/* ==> mysql/000070_upgrade_cte_v6.1.up.sql <== */
/* ==> mysql/000090_create_enums.up.sql <== */
/* ==> mysql/000076_upgrade_lastrootpostat.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateChannels ()
BEGIN
	-- 'DROP INDEX idx_channels_team_id ON Channels;'
	DECLARE DropIndex BOOLEAN;
	DECLARE DropIndexQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_channels_team_id_display_name ON Channels(TeamId, DisplayName);'
	DECLARE CreateIndexTeamDisplay BOOLEAN;
	DECLARE CreateIndexTeamDisplayQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_channels_team_id_type ON Channels(TeamId, Type);'
	DECLARE CreateIndexTeamType BOOLEAN;
	DECLARE CreateIndexTeamTypeQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Channels ADD COLUMN LastRootPostAt bigint DEFAULT 0;''
	-- UPDATE Channels INNER JOIN ...
	DECLARE AddLastRootPostAt BOOLEAN;
	DECLARE AddLastRootPostAtQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Channels MODIFY COLUMN Type ENUM("D", "O", "G", "P");',
	DECLARE ModifyColumn BOOLEAN;
	DECLARE ModifyColumnQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Channels ALTER COLUMN LastRootPostAt SET DEFAULT 0;',
	DECLARE SetDefault BOOLEAN;
	DECLARE SetDefaultQuery TEXT DEFAULT NULL;

	-- 'UPDATE Channels SET LastRootPostAt = ...',
	DECLARE UpdateLastRootPostAt BOOLEAN;
	DECLARE UpdateLastRootPostAtQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Channels'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channels_team_id'
		INTO DropIndex;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Channels'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channels_team_id_display_name'
		INTO CreateIndexTeamDisplay;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Channels'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channels_team_id_type'
		INTO CreateIndexTeamType;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'Channels'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'LastRootPostAt'
		INTO AddLastRootPostAt;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Channels'
		AND table_schema = DATABASE()
		AND column_name = 'Type'
		AND REPLACE(LOWER(column_type), '"', "'") != "enum('d','o','g','p')"
		INTO ModifyColumn;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'Channels'
		AND TABLE_SCHEMA = DATABASE()
		AND COLUMN_NAME = 'LastRootPostAt'
		AND (COLUMN_DEFAULT IS NULL OR COLUMN_DEFAULT != 0)
		INTO SetDefault;

	IF DropIndex THEN
		SET DropIndexQuery = 'DROP INDEX idx_channels_team_id';
	END IF;

	IF CreateIndexTeamDisplay THEN
		SET CreateIndexTeamDisplayQuery = 'ADD INDEX idx_channels_team_id_display_name (TeamId, DisplayName)';
	END IF;

	IF CreateIndexTeamType THEN
		SET CreateIndexTeamTypeQuery = 'ADD INDEX idx_channels_team_id_type (TeamId, Type)';
	END IF;

	IF AddLastRootPostAt THEN
		SET AddLastRootPostAtQuery = 'ADD COLUMN LastRootPostAt bigint DEFAULT 0';
	END IF;

	IF ModifyColumn THEN
		SET ModifyColumnQuery = 'MODIFY COLUMN Type ENUM("D", "O", "G", "P")';
	END IF;

	IF SetDefault THEN
		SET SetDefaultQuery = 'ALTER COLUMN LastRootPostAt SET DEFAULT 0';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', DropIndexQuery, CreateIndexTeamDisplayQuery, CreateIndexTeamTypeQuery, AddLastRootPostAtQuery, ModifyColumnQuery, SetDefaultQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Channels ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

	IF AddLastRootPostAt THEN
		UPDATE Channels INNER JOIN (
			SELECT Channels.Id channelid, COALESCE(MAX(Posts.CreateAt), 0) AS lastrootpost
			FROM Channels LEFT JOIN Posts FORCE INDEX (idx_posts_channel_id_update_at) ON Channels.Id = Posts.ChannelId
			WHERE Posts.RootId = '' GROUP BY Channels.Id
		) AS q ON q.channelid = Channels.Id
		SET LastRootPostAt = lastrootpost;
	END IF;

	-- Cover the case where LastRootPostAt was already present and there are rows with it set to NULL
	IF (SELECT COUNT(*) FROM Channels WHERE LastRootPostAt IS NULL) THEN
		-- fixes migrate cte and sets the LastRootPostAt for channels that don't have it set
		UPDATE Channels INNER JOIN (
				SELECT Channels.Id channelid, COALESCE(MAX(Posts.CreateAt), 0) AS lastrootpost
					FROM Channels LEFT JOIN Posts FORCE INDEX (idx_posts_channel_id_update_at) ON Channels.Id = Posts.ChannelId
					WHERE Posts.RootId = ''
					GROUP BY Channels.Id
			) AS q ON q.channelid = Channels.Id
			SET LastRootPostAt = lastrootpost
			WHERE LastRootPostAt IS NULL;
		-- sets LastRootPostAt to 0, for channels with no posts
		UPDATE Channels SET LastRootPostAt=0 WHERE LastRootPostAt IS NULL;
	END IF;

END//
DELIMITER ;

SELECT CONCAT('-- ', NOW(), ' MigrateChannels procedure starting.') AS DEBUG;
CALL MigrateChannels();
SELECT CONCAT('-- ', NOW(), ' MigrateChannels procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateChannels;

/* ==> mysql/000057_upgrade_command_webhooks_v6.0.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateCommandWebhooks ()
BEGIN
	DECLARE DropParentId BOOLEAN;

	SELECT COUNT(*)
		FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'CommandWebhooks'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'ParentId'
		INTO DropParentId;

	IF DropParentId THEN
		UPDATE CommandWebhooks SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
		ALTER TABLE CommandWebhooks DROP COLUMN ParentId;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateCommandWebhooks procedure starting.') AS DEBUG;
CALL MigrateCommandWebhooks();
SELECT CONCAT('-- ', NOW(), ' MigrateCommandWebhooks procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateCommandWebhooks;

/* ==> mysql/000054_create_crt_channelmembership_count.up.sql <== */
/* ==> mysql/000058_upgrade_channelmembers_v6.0.up.sql <== */
/* ==> mysql/000067_upgrade_channelmembers_v6.1.up.sql <== */
/* ==> mysql/000097_create_posts_priority.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateChannelMembers ()
BEGIN
	-- 'ALTER TABLE ChannelMembers MODIFY COLUMN NotifyProps JSON;',
	DECLARE ModifyNotifyProps BOOLEAN;
	DECLARE ModifyNotifyPropsQuery TEXT DEFAULT NULL;

	-- 'DROP INDEX idx_channelmembers_user_id ON ChannelMembers;',
	DECLARE DropIndex BOOLEAN;
	DECLARE DropIndexQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_channelmembers_user_id_channel_id_last_viewed_at ON ChannelMembers(UserId, ChannelId, LastViewedAt);'
	DECLARE CreateIndexLastViewedAt BOOLEAN;
	DECLARE CreateIndexLastViewedAtQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_channelmembers_channel_id_scheme_guest_user_id ON ChannelMembers(ChannelId, SchemeGuest, UserId);'
	DECLARE CreateIndexSchemeGuest BOOLEAN;
	DECLARE CreateIndexSchemeGuestQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE ChannelMembers MODIFY COLUMN Roles text;',
	DECLARE ModifyRoles BOOLEAN;
	DECLARE ModifyRolesQuery TEXT DEFAULT NOT NULL;

	-- 'ALTER TABLE ChannelMembers ADD COLUMN UrgentMentionCount bigint(20);',
	DECLARE AddUrgentMentionCount BOOLEAN;
	DECLARE AddUrgentMentionCountQuery TEXT DEFAULT NOT NULL;

	DECLARE MigrateMemberships BOOLEAN;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND column_name = 'NotifyProps'
		AND LOWER(column_type) != 'json'
		INTO ModifyNotifyProps;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channelmembers_user_id'
		INTO DropIndex;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channelmembers_user_id_channel_id_last_viewed_at'
		INTO CreateIndexLastViewedAt;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND index_name = 'idx_channelmembers_channel_id_scheme_guest_user_id'
		INTO CreateIndexSchemeGuest;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND column_name = 'Roles'
		AND LOWER(column_type) != 'text'
		INTO ModifyRoles;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'ChannelMembers'
		AND table_schema = DATABASE()
		AND column_name = 'UrgentMentionCount'
		INTO AddUrgentMentionCount;

	SELECT COUNT(*) = 0 FROM Systems
		WHERE Name = 'CRTChannelMembershipCountsMigrationComplete'
		INTO MigrateMemberships;

	IF ModifyNotifyProps THEN
		SET ModifyNotifyPropsQuery = 'MODIFY COLUMN NotifyProps JSON';
	END IF;

	IF DropIndex THEN
		SET DropIndexQuery = 'DROP INDEX idx_channelmembers_user_id';
	END IF;

	IF CreateIndexLastViewedAt THEN
		SET CreateIndexLastViewedAtQuery = 'ADD INDEX idx_channelmembers_user_id_channel_id_last_viewed_at (UserId, ChannelId, LastViewedAt)';
	END IF;

	IF CreateIndexSchemeGuest THEN
		SET CreateIndexSchemeGuestQuery = 'ADD INDEX idx_channelmembers_channel_id_scheme_guest_user_id (ChannelId, SchemeGuest, UserId)';
	END IF;

	IF ModifyRoles THEN
		SET ModifyRolesQuery = 'MODIFY COLUMN Roles text';
	END IF;

	IF AddUrgentMentionCount THEN
		SET AddUrgentMentionCountQuery = 'ADD COLUMN UrgentMentionCount bigint(20)';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ModifyNotifyPropsQuery, DropIndexQuery, CreateIndexLastViewedAtQuery, CreateIndexSchemeGuestQuery, ModifyRolesQuery, AddUrgentMentionCountQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE ChannelMembers ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

	IF MigrateMemberships THEN
		UPDATE ChannelMembers INNER JOIN Channels ON Channels.Id = ChannelMembers.ChannelId
			SET MentionCount = 0, MentionCountRoot = 0, MsgCount = Channels.TotalMsgCount, MsgCountRoot = Channels.TotalMsgCountRoot, LastUpdateAt = (SELECT (SELECT ROUND(UNIX_TIMESTAMP(NOW(3))*1000)))
			WHERE ChannelMembers.LastViewedAt >= Channels.LastPostAt;
		INSERT INTO Systems VALUES('CRTChannelMembershipCountsMigrationComplete', 'true');
	END IF;

END//
DELIMITER ;

SELECT CONCAT('-- ', NOW(), ' MigrateChannelMembers procedure starting.') AS DEBUG;
CALL MigrateChannelMembers();
SELECT CONCAT('-- ', NOW(), ' MigrateChannelMembers procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateChannelMembers;

/* ==> mysql/000059_upgrade_users_v6.0.up.sql <== */
/* ==> mysql/000074_upgrade_users_v6.3.up.sql <== */
/* ==> mysql/000077_upgrade_users_v6.5.up.sql <== */
/* ==> mysql/000088_remaining_migrations.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateUsers ()
BEGIN
	-- 'ALTER TABLE Users MODIFY COLUMN Props JSON;',
	DECLARE ChangeProps BOOLEAN;
	DECLARE ChangePropsQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users MODIFY COLUMN NotifyProps JSON;',
	DECLARE ChangeNotifyProps BOOLEAN;
	DECLARE ChangeNotifyPropsQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users ALTER Timezone DROP DEFAULT;',
	DECLARE DropTimezoneDefault BOOLEAN;
	DECLARE DropTimezoneDefaultQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users MODIFY COLUMN Timezone JSON;',
	DECLARE ChangeTimezone BOOLEAN;
	DECLARE ChangeTimezoneQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users MODIFY COLUMN Roles text;',
	DECLARE ChangeRoles BOOLEAN;
	DECLARE ChangeRolesQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users DROP COLUMN AcceptedTermsOfServiceId;',
	DECLARE DropTermsOfService BOOLEAN;
	DECLARE DropTermsOfServiceQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users DROP COLUMN AcceptedServiceTermsId;',
	DECLARE DropServiceTerms BOOLEAN;
	DECLARE DropServiceTermsQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Users DROP COLUMN ThemeProps',
	DECLARE DropThemeProps BOOLEAN;
	DECLARE DropThemePropsQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'Props'
		AND LOWER(column_type) != 'json'
		INTO ChangeProps;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'NotifyProps'
		AND LOWER(column_type) != 'json'
		INTO ChangeNotifyProps;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND column_default IS NOT NULL
		INTO DropTimezoneDefault;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'Timezone'
		AND LOWER(column_type) != 'json'
		INTO ChangeTimezone;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'Roles'
		AND LOWER(column_type) != 'text'
		INTO ChangeRoles;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'AcceptedTermsOfServiceId'
		INTO DropTermsOfService;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'AcceptedServiceTermsId'
		INTO DropServiceTerms;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Users'
		AND table_schema = DATABASE()
		AND column_name = 'ThemeProps'
		INTO DropThemeProps;

	IF ChangeProps THEN
		SET ChangePropsQuery = 'MODIFY COLUMN Props JSON';
	END IF;

	IF ChangeNotifyProps THEN
		SET ChangeNotifyPropsQuery = 'MODIFY COLUMN NotifyProps JSON';
	END IF;

	IF DropTimezoneDefault THEN
		SET DropTimezoneDefaultQuery = 'ALTER Timezone DROP DEFAULT';
	END IF;

	IF ChangeTimezone THEN
		SET ChangeTimezoneQuery = 'MODIFY COLUMN Timezone JSON';
	END IF;

	IF ChangeRoles THEN
		SET ChangeRolesQuery = 'MODIFY COLUMN Roles text';
	END IF;

	IF DropTermsOfService THEN
		SET DropTermsOfServiceQuery = 'DROP COLUMN AcceptedTermsOfServiceId';
	END IF;

	IF DropServiceTerms THEN
		SET DropServiceTermsQuery = 'DROP COLUMN AcceptedServiceTermsId';
	END IF;

	IF DropThemeProps THEN
		INSERT INTO Preferences(UserId, Category, Name, Value) SELECT Id, '', '', ThemeProps FROM Users WHERE Users.ThemeProps != 'null';
		SET DropThemePropsQuery = 'DROP COLUMN ThemeProps';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ChangePropsQuery, ChangeNotifyPropsQuery, DropTimezoneDefaultQuery, ChangeTimezoneQuery, ChangeRolesQuery, DropTermsOfServiceQuery, DropServiceTermsQuery, DropThemePropsQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Users ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateUsers procedure starting.') AS DEBUG;
CALL MigrateUsers();
SELECT CONCAT('-- ', NOW(), ' MigrateUsers procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateUsers;

/* ==> mysql/000060_upgrade_jobs_v6.0.up.sql <== */
/* ==> mysql/000069_upgrade_jobs_v6.1.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateJobs ()
BEGIN
	-- 'ALTER TABLE Jobs MODIFY COLUMN Data JSON;',
	DECLARE ModifyData BOOLEAN;
	DECLARE ModifyDataQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_jobs_status_type ON Jobs(Status, Type);'
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Jobs'
		AND table_schema = DATABASE()
		AND column_name = 'Data'
		AND LOWER(column_type) != 'JSON'
		INTO ModifyData;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Jobs'
		AND table_schema = DATABASE()
		AND index_name = 'idx_jobs_status_type'
		INTO CreateIndex;

	IF ModifyData THEN
		SET ModifyDataQuery = 'MODIFY COLUMN Data JSON';
	END IF;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_jobs_status_type (Status, Type)';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ModifyDataQuery, CreateIndexQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Jobs ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateJobs procedure starting.') AS DEBUG;
CALL MigrateJobs();
SELECT CONCAT('-- ', NOW(), ' MigrateJobs procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateJobs;

/* ==> mysql/000061_upgrade_link_metadata_v6.0.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateLinkMetadata ()
BEGIN
	-- ALTER TABLE LinkMetadata MODIFY COLUMN Data JSON;
	DECLARE ModifyData BOOLEAN;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'LinkMetadata'
		AND table_schema = DATABASE()
		AND column_name = 'Data'
		AND LOWER(column_type) != 'JSON'
		INTO ModifyData;

	IF ModifyData THEN
		ALTER TABLE LinkMetadata MODIFY COLUMN Data JSON;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateLinkMetadata procedure starting.') AS DEBUG;
CALL MigrateLinkMetadata();
SELECT CONCAT('-- ', NOW(), ' MigrateLinkMetadata procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateLinkMetadata;

/* ==> mysql/000062_upgrade_sessions_v6.0.up.sql <== */
/* ==> mysql/000071_upgrade_sessions_v6.1.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateSessions ()
BEGIN
	-- 'ALTER TABLE Sessions MODIFY COLUMN Props JSON;',
	DECLARE ModifyProps BOOLEAN;
	DECLARE ModifyPropsQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Sessions MODIFY COLUMN Roles text;',
	DECLARE ModifyRoles BOOLEAN;
	DECLARE ModifyRolesQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Sessions'
		AND table_schema = DATABASE()
		AND column_name = 'Props'
		AND LOWER(column_type) != 'json'
		INTO ModifyProps;


	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Sessions'
		AND table_schema = DATABASE()
		AND column_name = 'Roles'
		AND LOWER(column_type) != 'text'
		INTO ModifyRoles;

	IF ModifyProps THEN
		SET ModifyPropsQuery = 'MODIFY COLUMN Props JSON';
	END IF;

	IF ModifyRoles THEN
		SET ModifyRolesQuery = 'MODIFY COLUMN Roles text';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ModifyPropsQuery, ModifyRolesQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Sessions ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateSessions procedure starting.') AS DEBUG;
CALL MigrateSessions();
SELECT CONCAT('-- ', NOW(), ' MigrateSessions procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateSessions;

/* ==> mysql/000063_upgrade_threads_v6.0.up.sql <== */
/* ==> mysql/000083_threads_threaddeleteat.up.sql <== */
/* ==> mysql/000096_threads_threadteamid.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateThreads ()
BEGIN
	-- 'ALTER TABLE Threads MODIFY COLUMN Participants JSON;'
	DECLARE ChangeParticipants BOOLEAN;
	DECLARE ChangeParticipantsQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Threads DROP COLUMN DeleteAt;'
	DECLARE DropDeleteAt BOOLEAN;
	DECLARE DropDeleteAtQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Threads ADD COLUMN ThreadDeleteAt bigint(20);'
	DECLARE CreateThreadDeleteAt BOOLEAN;
	DECLARE CreateThreadDeleteAtQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Threads DROP COLUMN TeamId;'
	DECLARE DropTeamId BOOLEAN;
	DECLARE DropTeamIdQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Threads ADD COLUMN ThreadTeamId varchar(26) DEFAULT NULL;'
	DECLARE CreateThreadTeamId BOOLEAN;
	DECLARE CreateThreadTeamIdQuery TEXT DEFAULT NULL;

	-- CREATE INDEX idx_threads_channel_id_last_reply_at ON Threads(ChannelId, LastReplyAt);
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	-- DROP INDEX idx_threads_channel_id ON Threads;
	DECLARE DropIndex BOOLEAN;
	DECLARE DropIndexQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND column_name = 'Participants'
		AND LOWER(column_type) != 'json'
		INTO ChangeParticipants;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND column_name = 'DeleteAt'
		INTO DropDeleteAt;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND column_name = 'ThreadDeleteAt'
		INTO CreateThreadDeleteAt;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND column_name = 'TeamId'
		INTO DropTeamId;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND column_name = 'ThreadTeamId'
		INTO CreateThreadTeamId;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND index_name = 'idx_threads_channel_id_last_reply_at'
		INTO CreateIndex;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Threads'
		AND table_schema = DATABASE()
		AND index_name = 'idx_threads_channel_id'
		INTO DropIndex;

	IF ChangeParticipants THEN
		SET ChangeParticipantsQuery = 'MODIFY COLUMN Participants JSON';
	END IF;

	IF DropDeleteAt THEN
		SET DropDeleteAtQuery = 'DROP COLUMN DeleteAt';
	END IF;

	IF CreateThreadDeleteAt THEN
		SET CreateThreadDeleteAtQuery = 'ADD COLUMN ThreadDeleteAt bigint(20)';
	END IF;

	IF DropTeamId THEN
		SET DropTeamIdQuery = 'DROP COLUMN TeamId';
	END IF;

	IF CreateThreadTeamId THEN
		SET CreateThreadTeamIdQuery = 'ADD COLUMN ThreadTeamId varchar(26) DEFAULT NULL';
	END IF;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_threads_channel_id_last_reply_at (ChannelId, LastReplyAt)';
	END IF;

	IF DropIndex THEN
		SET DropIndexQuery = 'DROP INDEX idx_threads_channel_id';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ChangeParticipantsQuery, DropDeleteAtQuery, CreateThreadDeleteAtQuery, DropTeamIdQuery, CreateThreadTeamIdQuery, CreateIndexQuery, DropIndexQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Threads ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

	UPDATE Threads, Posts
		SET Threads.ThreadDeleteAt = Posts.DeleteAt
		WHERE Posts.Id = Threads.PostId
		AND Threads.ThreadDeleteAt IS NULL;

	UPDATE Threads, Channels
		SET Threads.ThreadTeamId = Channels.TeamId
		WHERE Channels.Id = Threads.ChannelId
		AND Threads.ThreadTeamId IS NULL;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateThreads procedure starting.') AS DEBUG;
CALL MigrateThreads();
SELECT CONCAT('-- ', NOW(), ' MigrateThreads procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateThreads;

/* ==> mysql/000064_upgrade_status_v6.0.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateStatus ()
BEGIN
	-- 'CREATE INDEX idx_status_status_dndendtime ON Status(Status, DNDEndTime);'
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	-- 'DROP INDEX idx_status_status ON Status;',
	DECLARE DropIndex BOOLEAN;
	DECLARE DropIndexQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Status'
		AND table_schema = DATABASE()
		AND index_name = 'idx_status_status_dndendtime'
		INTO CreateIndex;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Status'
		AND table_schema = DATABASE()
		AND index_name = 'idx_status_status'
		INTO DropIndex;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_status_status_dndendtime (Status, DNDEndTime)';
	END IF;

	IF DropIndex THEN
		SET DropIndexQuery = 'DROP INDEX idx_status_status';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', CreateIndexQuery, DropIndexQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Status ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateStatus procedure starting.') AS DEBUG;
CALL MigrateStatus ();
SELECT CONCAT('-- ', NOW(), ' MigrateStatus procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateStatus;

/* ==> mysql/000065_upgrade_groupchannels_v6.0.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateGroupChannels ()
BEGIN
	-- 'CREATE INDEX idx_groupchannels_schemeadmin ON GroupChannels(SchemeAdmin);'
	DECLARE CreateIndex BOOLEAN;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'GroupChannels'
		AND table_schema = DATABASE()
		AND index_name = 'idx_groupchannels_schemeadmin'
		INTO CreateIndex;

	IF CreateIndex THEN
		CREATE INDEX idx_groupchannels_schemeadmin ON GroupChannels(SchemeAdmin);
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateGroupChannels procedure starting.') AS DEBUG;
CALL MigrateGroupChannels ();
SELECT CONCAT('-- ', NOW(), ' MigrateGroupChannels procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateGroupChannels;

/* ==> mysql/000066_upgrade_posts_v6.0.up.sql <== */
/* ==> mysql/000080_posts_createat_id.up.sql <== */
/* ==> mysql/000095_remove_posts_parentid.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigratePosts ()
BEGIN
	-- DROP COLUMN ParentId
	DECLARE DropParentId BOOLEAN;
	DECLARE DropParentIdQuery TEXT DEFAULT NULL;

	-- MODIFY COLUMN FileIds
	DECLARE ModifyFileIds BOOLEAN;
	DECLARE ModifyFileIdsQuery TEXT DEFAULT NULL;

	-- MODIFY COLUMN Props
	DECLARE ModifyProps BOOLEAN;
	DECLARE ModifyPropsQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_posts_root_id_delete_at ON Posts(RootId, DeleteAt);'
	DECLARE CreateIndexRootId BOOLEAN;
	DECLARE CreateIndexRootIdQuery TEXT DEFAULT NULL;

	-- 'DROP INDEX idx_posts_root_id ON Posts;',
	DECLARE DropIndex BOOLEAN;
	DECLARE DropIndexQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_posts_create_at_id on Posts(CreateAt, Id) LOCK=NONE;'
	DECLARE CreateIndexCreateAt BOOLEAN;
	DECLARE CreateIndexCreateAtQuery TEXT DEFAULT NULL;

	-- Condition to control whether to update the RootId column.
	DECLARE UpdateRootId BOOLEAN;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_NAME = 'Posts'
		AND table_schema = DATABASE()
		AND COLUMN_NAME = 'ParentId'
		INTO DropParentId;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Posts'
		AND table_schema = DATABASE()
		AND column_name = 'FileIds'
		AND LOWER(column_type) != 'text'
		INTO ModifyFileIds;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Posts'
		AND table_schema = DATABASE()
		AND column_name = 'Props'
		AND LOWER(column_type) != 'json'
		INTO ModifyProps;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Posts'
		AND table_schema = DATABASE()
		AND index_name = 'idx_posts_root_id_delete_at'
		INTO CreateIndexRootId;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Posts'
		AND table_schema = DATABASE()
		AND index_name = 'idx_posts_root_id'
		INTO DropIndex;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Posts'
		AND table_schema = DATABASE()
		AND index_name = 'idx_posts_create_at_id'
		INTO CreateIndexCreateAt;

	IF DropParentId THEN
		SET DropParentIdQuery = 'DROP COLUMN ParentId';
		SELECT COUNT(*) FROM Posts WHERE RootId != ParentId INTO UpdateRootId;
		IF UpdateRootId THEN
			UPDATE Posts SET RootId = ParentId WHERE RootId = '' AND RootId != ParentId;
		END IF;
	END IF;

	IF ModifyFileIds THEN
		SET ModifyFileIdsQuery = 'MODIFY COLUMN FileIds text';
	END IF;

	IF ModifyProps THEN
		SET ModifyPropsQuery = 'MODIFY COLUMN Props JSON';
	END IF;

	IF CreateIndexRootId THEN
		SET CreateIndexRootIdQuery = 'ADD INDEX idx_posts_root_id_delete_at (RootId, DeleteAt)';
	END IF;

	IF DropIndex THEN
		SET DropIndexQuery = 'DROP INDEX idx_posts_root_id';
	END IF;

	IF CreateIndexCreateAt THEN
		SET CreateIndexCreateAtQuery = 'ADD INDEX idx_posts_create_at_id (CreateAt, Id)';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', DropParentIdQuery, ModifyFileIdsQuery, ModifyPropsQuery, CreateIndexRootIdQuery, DropIndexQuery, CreateIndexCreateAtQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Posts ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigratePosts procedure starting.') AS DEBUG;
CALL MigratePosts ();
SELECT CONCAT('-- ', NOW(), ' MigratePosts procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigratePosts;

/* ==> mysql/000068_upgrade_teammembers_v6.1.up.sql <== */
/* ==> mysql/000092_add_createat_to_teammembers.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateTeamMembers ()
BEGIN
	-- 'ALTER TABLE TeamMembers MODIFY COLUMN Roles text;',
	DECLARE ModifyRoles BOOLEAN;
	DECLARE ModifyRolesQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE TeamMembers ADD COLUMN CreateAt bigint DEFAULT 0;',
	DECLARE AddCreateAt BOOLEAN;
	DECLARE AddCreateAtQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_teammembers_createat ON TeamMembers(CreateAt);'
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'TeamMembers'
		AND table_schema = DATABASE()
		AND column_name = 'Roles'
		AND LOWER(column_type) != 'text'
		INTO ModifyRoles;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'TeamMembers'
		AND table_schema = DATABASE()
		AND column_name = 'CreateAt'
		INTO AddCreateAt;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'TeamMembers'
		AND table_schema = DATABASE()
		AND index_name = 'idx_teammembers_createat'
		INTO CreateIndex;

	IF ModifyRoles THEN
		SET ModifyRolesQuery = 'MODIFY COLUMN Roles text';
	END IF;

	IF AddCreateAt THEN
		SET AddCreateAtQuery = 'ADD COLUMN CreateAt bigint DEFAULT 0';
	END IF;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_teammembers_createat (CreateAt)';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', ModifyRolesQuery, AddCreateAtQuery, CreateIndexQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE TeamMembers ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateTeamMembers procedure starting.') AS DEBUG;
CALL MigrateTeamMembers ();
SELECT CONCAT('-- ', NOW(), ' MigrateTeamMembers procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateTeamMembers;

/* ==> mysql/000072_upgrade_schemes_v6.3.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateSchemes ()
BEGIN
	-- 'ALTER TABLE Schemes ADD COLUMN DefaultPlaybookAdminRole VARCHAR(64) DEFAULT "";'
	DECLARE AddDefaultPlaybookAdminRole BOOLEAN;
	DECLARE AddDefaultPlaybookAdminRoleQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Schemes ADD COLUMN DefaultPlaybookMemberRole VARCHAR(64) DEFAULT "";'
	DECLARE AddDefaultPlaybookMemberRole BOOLEAN;
	DECLARE AddDefaultPlaybookMemberRoleQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Schemes ADD COLUMN DefaultRunAdminRole VARCHAR(64) DEFAULT "";'
	DECLARE AddDefaultRunAdminRole BOOLEAN;
	DECLARE AddDefaultRunAdminRoleQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Schemes ADD COLUMN DefaultRunMemberRole VARCHAR(64) DEFAULT "";'
	DECLARE AddDefaultRunMemberRole BOOLEAN;
	DECLARE AddDefaultRunMemberRoleQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Schemes'
		AND table_schema = DATABASE()
		AND column_name = 'DefaultPlaybookAdminRole'
		INTO AddDefaultPlaybookAdminRole;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Schemes'
		AND table_schema = DATABASE()
		AND column_name = 'DefaultPlaybookMemberRole'
		INTO AddDefaultPlaybookMemberRole;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Schemes'
		AND table_schema = DATABASE()
		AND column_name = 'DefaultRunAdminRole'
		INTO AddDefaultRunAdminRole;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Schemes'
		AND table_schema = DATABASE()
		AND column_name = 'DefaultRunMemberRole'
		INTO AddDefaultRunMemberRole;

	IF AddDefaultPlaybookAdminRole THEN
		SET AddDefaultPlaybookAdminRoleQuery = 'ADD COLUMN DefaultPlaybookAdminRole VARCHAR(64) DEFAULT ""';
	END IF;

	IF AddDefaultPlaybookMemberRole THEN
		SET AddDefaultPlaybookMemberRoleQuery = 'ADD COLUMN DefaultPlaybookMemberRole VARCHAR(64) DEFAULT ""';
	END IF;

	IF AddDefaultRunAdminRole THEN
		SET AddDefaultRunAdminRoleQuery = 'ADD COLUMN DefaultRunAdminRole VARCHAR(64) DEFAULT ""';
	END IF;

	IF AddDefaultRunMemberRole THEN
		SET AddDefaultRunMemberRoleQuery = 'ADD COLUMN DefaultRunMemberRole VARCHAR(64) DEFAULT ""';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', AddDefaultPlaybookAdminRoleQuery, AddDefaultPlaybookMemberRoleQuery, AddDefaultRunAdminRoleQuery, AddDefaultRunMemberRoleQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Schemes ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateSchemes procedure starting.') AS DEBUG;
CALL MigrateSchemes ();
SELECT CONCAT('-- ', NOW(), ' MigrateSchemes procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateSchemes;

/* ==> mysql/000073_upgrade_plugin_key_value_store_v6.3.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigratePluginKeyValueStore ()
BEGIN
	-- 'ALTER TABLE PluginKeyValueStore MODIFY COLUMN PKey varchar(150);',
	DECLARE ModifyPKey BOOLEAN;

	SELECT COUNT(*) FROM Information_Schema.Columns
		WHERE table_name = 'PluginKeyValueStore'
		AND table_schema = DATABASE()
		AND column_name = 'PKey'
		AND LOWER(column_type) != 'varchar(150)'
		INTO ModifyPKey;

	IF ModifyPKey THEN
		ALTER TABLE PluginKeyValueStore MODIFY COLUMN PKey varchar(150);
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigratePluginKeyValueStore procedure starting.') AS DEBUG;
CALL MigratePluginKeyValueStore ();
SELECT CONCAT('-- ', NOW(), ' MigratePluginKeyValueStore procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigratePluginKeyValueStore;

/* ==> mysql/000078_create_oauth_mattermost_app_id.up.sql <== */
/* ==> mysql/000082_upgrade_oauth_mattermost_app_id.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateOAuthApps ()
BEGIN
	-- 'ALTER TABLE OAuthApps ADD COLUMN MattermostAppID varchar(32);'
	DECLARE AddMattermostAppID BOOLEAN;
	DECLARE AddMattermostAppIDQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'OAuthApps'
		AND table_schema = DATABASE()
		AND column_name = 'MattermostAppID'
		INTO AddMattermostAppID;

	IF AddMattermostAppID THEN
		SET AddMattermostAppIDQuery = 'ADD COLUMN MattermostAppID varchar(32) NOT NULL DEFAULT ""';
		SET @query = CONCAT('ALTER TABLE OAuthApps ', CONCAT_WS(', ', AddMattermostAppIDQuery));
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

	IF AddMattermostAppID THEN
		UPDATE OAuthApps SET MattermostAppID = "" WHERE MattermostAppID IS NULL;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateOAuthApps procedure starting.') AS DEBUG;
CALL MigrateOAuthApps ();
SELECT CONCAT('-- ', NOW(), ' MigrateOAuthApps procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateOAuthApps;

/* ==> mysql/000079_usergroups_displayname_index.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateUserGroups ()
BEGIN
	-- 'CREATE INDEX idx_usergroups_displayname ON UserGroups(DisplayName);'
	DECLARE CreateIndex BOOLEAN;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'UserGroups'
		AND table_schema = DATABASE()
		AND index_name = 'idx_usergroups_displayname'
		INTO CreateIndex;

	IF CreateIndex THEN
		CREATE INDEX idx_usergroups_displayname ON UserGroups(DisplayName);
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateUserGroups procedure starting.') AS DEBUG;
CALL MigrateUserGroups ();
SELECT CONCAT('-- ', NOW(), ' MigrateUserGroups procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateUserGroups;

/* ==> mysql/000081_threads_deleteat.up.sql <== */
-- Replaced by 000083_threads_threaddeleteat.up.sql

/* ==> mysql/000084_recent_searches.up.sql <== */
CREATE TABLE IF NOT EXISTS RecentSearches (
	UserId CHAR(26),
	SearchPointer int,
	Query json,
	CreateAt bigint NOT NULL,
	PRIMARY KEY (UserId, SearchPointer)
);

/* ==> mysql/000085_fileinfo_add_archived_column.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateFileInfo ()
BEGIN
	-- 'ALTER TABLE FileInfo ADD COLUMN Archived boolean NOT NULL DEFAULT false;'
	DECLARE AddArchived BOOLEAN;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'FileInfo'
		AND table_schema = DATABASE()
		AND column_name = 'Archived'
		INTO AddArchived;

	IF AddArchived THEN
		ALTER TABLE FileInfo ADD COLUMN Archived boolean NOT NULL DEFAULT false;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateFileInfo procedure starting.') AS DEBUG;
CALL MigrateFileInfo ();
SELECT CONCAT('-- ', NOW(), ' MigrateFileInfo procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateFileInfo;

/* ==> mysql/000086_add_cloud_limits_archived.up.sql <== */
/* ==> mysql/000090_create_enums.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateTeams ()
BEGIN
	-- 'ALTER TABLE Teams ADD COLUMN CloudLimitsArchived BOOLEAN NOT NULL DEFAULT FALSE;',
	DECLARE AddCloudLimitsArchived BOOLEAN;
	DECLARE AddCloudLimitsArchivedQuery TEXT DEFAULT NULL;

	-- 'ALTER TABLE Teams MODIFY COLUMN Type ENUM("I", "O");',
	DECLARE ModifyType BOOLEAN;
	DECLARE ModifyTypeQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
		INTO AddCloudLimitsArchived;

	SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'Type'
		AND REPLACE(LOWER(column_type), '"', "'") != "enum('i','o')"
		INTO ModifyType;

	IF AddCloudLimitsArchived THEN
		SET AddCloudLimitsArchivedQuery = 'ADD COLUMN CloudLimitsArchived BOOLEAN NOT NULL DEFAULT FALSE';
	END IF;

	IF ModifyType THEN
		SET ModifyTypeQuery = 'MODIFY COLUMN Type ENUM("I", "O")';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', AddCloudLimitsArchivedQuery, ModifyTypeQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Teams ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateTeams procedure starting.') AS DEBUG;
CALL MigrateTeams ();
SELECT CONCAT('-- ', NOW(), ' MigrateTeams procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateTeams;

/* ==> mysql/000087_sidebar_categories_index.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateSidebarCategories ()
BEGIN
	-- 'CREATE INDEX idx_sidebarcategories_userid_teamid on SidebarCategories(UserId, TeamId) LOCK=NONE;'
	DECLARE CreateIndex BOOLEAN;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'SidebarCategories'
		AND table_schema = DATABASE()
		AND index_name = 'idx_sidebarcategories_userid_teamid'
		INTO CreateIndex;

	IF CreateIndex THEN
		CREATE INDEX idx_sidebarcategories_userid_teamid on SidebarCategories(UserId, TeamId) LOCK=NONE;
	END IF;
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateSidebarCategories procedure starting.') AS DEBUG;
CALL MigrateSidebarCategories ();
SELECT CONCAT('-- ', NOW(), ' MigrateSidebarCategories procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateSidebarCategories;

/* ==> mysql/000088_remaining_migrations.up.sql <== */
DROP TABLE IF EXISTS JobStatuses;
DROP TABLE IF EXISTS PasswordRecovery;

/* ==> mysql/000089_add-channelid-to-reaction.up.sql <== */
DELIMITER //
CREATE PROCEDURE MigrateReactions ()
BEGIN
	-- 'ALTER TABLE Reactions ADD COLUMN ChannelId varchar(26) NOT NULL DEFAULT "";',
	DECLARE AddChannelId BOOLEAN;
	DECLARE AddChannelIdQuery TEXT DEFAULT NULL;

	-- 'CREATE INDEX idx_reactions_channel_id ON Reactions(ChannelId);'
	DECLARE CreateIndex BOOLEAN;
	DECLARE CreateIndexQuery TEXT DEFAULT NULL;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Reactions'
		AND table_schema = DATABASE()
		AND column_name = 'ChannelId'
		INTO AddChannelId;

	SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
		WHERE table_name = 'Reactions'
		AND table_schema = DATABASE()
		AND index_name = 'idx_reactions_channel_id'
		INTO CreateIndex;

	IF AddChannelId THEN
		SET AddChannelIdQuery = 'ADD COLUMN ChannelId varchar(26) NOT NULL DEFAULT ""';
	END IF;

	IF CreateIndex THEN
		SET CreateIndexQuery = 'ADD INDEX idx_reactions_channel_id (ChannelId)';
	END IF;

	SET @alterQuery = CONCAT_WS(', ', AddChannelIdQuery, CreateIndexQuery);
	IF @alterQuery <> '' THEN
	    SET @query = CONCAT('ALTER TABLE Reactions ', @alterQuery);
		PREPARE stmt FROM @query;
		EXECUTE stmt;
		DEALLOCATE PREPARE stmt;
	END IF;

	UPDATE Reactions SET ChannelId = COALESCE((select ChannelId from Posts where Posts.Id = Reactions.PostId), '') WHERE ChannelId="";
END//
DELIMITER ;
SELECT CONCAT('-- ', NOW(), ' MigrateReactions procedure starting.') AS DEBUG;
CALL MigrateReactions ();
SELECT CONCAT('-- ', NOW(), ' MigrateReactions procedure finished.') AS DEBUG;
DROP PROCEDURE IF EXISTS MigrateReactions;

/* ==> mysql/000091_create_post_reminder.up.sql <== */
CREATE TABLE IF NOT EXISTS PostReminders (
	PostId varchar(26) NOT NULL,
	UserId varchar(26) NOT NULL,
	TargetTime bigint,
	INDEX idx_postreminders_targettime (TargetTime),
	PRIMARY KEY (PostId, UserId)
);

/* ==> mysql/000093_notify_admin.up.sql <== */
CREATE TABLE IF NOT EXISTS NotifyAdmin (
	UserId varchar(26) NOT NULL,
	CreateAt bigint(20) DEFAULT NULL,
	RequiredPlan varchar(26) NOT NULL,
	RequiredFeature varchar(100) NOT NULL,
	Trial BOOLEAN NOT NULL,
	PRIMARY KEY (UserId, RequiredFeature, RequiredPlan)
);

/* ==> mysql/000094_threads_teamid.up.sql <== */
-- Replaced by 000096_threads_threadteamid.up.sql

/* ==> mysql/000097_create_posts_priority.up.sql <== */
CREATE TABLE IF NOT EXISTS PostsPriority (
	PostId varchar(26) NOT NULL,
	ChannelId varchar(26) NOT NULL,
	Priority varchar(32) NOT NULL,
	RequestedAck tinyint(1),
	PersistentNotifications tinyint(1),
	PRIMARY KEY (PostId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==> mysql/000098_create_post_acknowledgements.up.sql <== */
CREATE TABLE IF NOT EXISTS PostAcknowledgements (
	PostId varchar(26) NOT NULL,
	UserId varchar(26) NOT NULL,
	AcknowledgedAt bigint(20) DEFAULT NULL,
	PRIMARY KEY (PostId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==> mysql/000099_create_drafts.up.sql <== */
/* ==> mysql/000100_add_draft_priority_column.up.sql <== */
CREATE TABLE IF NOT EXISTS Drafts (
	CreateAt bigint(20) DEFAULT NULL,
	UpdateAt bigint(20) DEFAULT NULL,
	DeleteAt bigint(20) DEFAULT NULL,
	UserId varchar(26) NOT NULL,
	ChannelId varchar(26) NOT NULL,
	RootId varchar(26) DEFAULT '',
	Message text,
	Props text,
	FileIds text,
	Priority text,
	PRIMARY KEY (UserId, ChannelId, RootId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==> mysql/000101_create_true_up_review_history.up.sql <== */
CREATE TABLE IF NOT EXISTS TrueUpReviewHistory (
	DueDate bigint(20),
	Completed boolean,
	PRIMARY KEY (DueDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
