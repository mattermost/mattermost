/* ==> mysql/000077_upgrade_users_v6.5.up.sql <== */

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'AcceptedServiceTermsId'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN AcceptedServiceTermsId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000078_create_oauth_mattermost_app_id.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'MattermostAppID'
    ) > 0,
	'SELECT 1',
    'ALTER TABLE OAuthApps ADD COLUMN MattermostAppID varchar(32);'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000079_usergroups_displayname_index.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'UserGroups'
        AND table_schema = DATABASE()
        AND index_name = 'idx_usergroups_displayname'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_usergroups_displayname ON UserGroups(DisplayName);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000080_posts_createat_id.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND index_name = 'idx_posts_create_at_id'
    ) > 0,
    'SELECT 1;',
    'CREATE INDEX idx_posts_create_at_id on Posts(CreateAt, Id) LOCK=NONE;'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000081_threads_deleteat.up.sql <== */
-- Replaced by 000083_threads_threaddeleteat.up.sql

/* ==> mysql/000082_upgrade_oauth_mattermost_app_id.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'MattermostAppID'
    ) > 0,
    'UPDATE OAuthApps SET MattermostAppID = "" WHERE MattermostAppID IS NULL;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'OAuthApps'
        AND table_schema = DATABASE()
        AND column_name = 'MattermostAppID'
    ) > 0,
    'ALTER TABLE OAuthApps MODIFY MattermostAppID varchar(32) NOT NULL DEFAULT "";',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000083_threads_threaddeleteat.up.sql <== */
-- Drop any existing DeleteAt column from 000081_threads_deleteat.up.sql
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'DeleteAt'
    ) > 0,
    'ALTER TABLE Threads DROP COLUMN DeleteAt;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'ThreadDeleteAt'
    ),
    'ALTER TABLE Threads ADD COLUMN ThreadDeleteAt bigint(20);',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Threads, Posts
SET Threads.ThreadDeleteAt = Posts.DeleteAt
WHERE Posts.Id = Threads.PostId
AND Threads.ThreadDeleteAt IS NULL;

/* ==> mysql/000084_recent_searches.up.sql <== */
CREATE TABLE IF NOT EXISTS RecentSearches (
    UserId CHAR(26),
    SearchPointer int,
    Query json,
    CreateAt bigint NOT NULL,
    PRIMARY KEY (UserId, SearchPointer)
);
/* ==> mysql/000085_fileinfo_add_archived_column.up.sql <== */

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'FileInfo'
        AND table_schema = DATABASE()
        AND column_name = 'Archived'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE FileInfo ADD COLUMN Archived boolean NOT NULL DEFAULT false;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000086_add_cloud_limits_archived.up.sql <== */
SET @preparedStatement = (SELECT IF(
	NOT EXISTS(
		SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
		WHERE table_name = 'Teams'
		AND table_schema = DATABASE()
		AND column_name = 'CloudLimitsArchived'
	),
	'ALTER TABLE Teams ADD COLUMN CloudLimitsArchived BOOLEAN NOT NULL DEFAULT FALSE;',
	'SELECT 1'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

/* ==> mysql/000087_sidebar_categories_index.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'SidebarCategories'
        AND table_schema = DATABASE()
        AND index_name = 'idx_sidebarcategories_userid_teamid'
    ) > 0,
    'SELECT 1;',
    'CREATE INDEX idx_sidebarcategories_userid_teamid on SidebarCategories(UserId, TeamId) LOCK=NONE;'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000088_remaining_migrations.up.sql <== */
DROP TABLE IF EXISTS JobStatuses;

DROP TABLE IF EXISTS PasswordRecovery;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'ThemeProps'
    ) > 0,
    'INSERT INTO Preferences(UserId, Category, Name, Value) SELECT Id, \'\', \'\', ThemeProps FROM Users WHERE Users.ThemeProps != \'null\'',
    'SELECT 1'
));

PREPARE migrateTheme FROM @preparedStatement;
EXECUTE migrateTheme;
DEALLOCATE PREPARE migrateTheme;

-- We have to do this twice because the prepared statement doesn't support multiple SQL queries
-- in a single string.

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Users'
        AND table_schema = DATABASE()
        AND column_name = 'ThemeProps'
    ) > 0,
    'ALTER TABLE Users DROP COLUMN ThemeProps',
    'SELECT 1'
));

PREPARE migrateTheme FROM @preparedStatement;
EXECUTE migrateTheme;
DEALLOCATE PREPARE migrateTheme;

/* ==> mysql/000089_add-channelid-to-reaction.up.sql <== */
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND column_name = 'ChannelId'
    ),
    'ALTER TABLE Reactions ADD COLUMN ChannelId varchar(26) NOT NULL DEFAULT "";',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;


UPDATE Reactions SET ChannelId = COALESCE((select ChannelId from Posts where Posts.Id = Reactions.PostId), '') WHERE ChannelId="";


SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Reactions'
        AND table_schema = DATABASE()
        AND index_name = 'idx_reactions_channel_id'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_reactions_channel_id ON Reactions(ChannelId);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

/* ==> mysql/000090_create_enums.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Channels'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("D", "O", "G", "P")'
    ) > 0,
    'ALTER TABLE Channels MODIFY COLUMN Type ENUM("D", "O", "G", "P");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Teams'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("I", "O")'
    ) > 0,
    'ALTER TABLE Teams MODIFY COLUMN Type ENUM("I", "O");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'UploadSessions'
        AND table_schema = DATABASE()
        AND column_name = 'Type'
        AND column_type != 'ENUM("attachment", "import")'
    ) > 0,
    'ALTER TABLE UploadSessions MODIFY COLUMN Type ENUM("attachment", "import");',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
/* ==> mysql/000091_create_post_reminder.up.sql <== */
CREATE TABLE IF NOT EXISTS PostReminders (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    TargetTime bigint,
    PRIMARY KEY (PostId, UserId)
);

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'PostReminders'
        AND table_schema = DATABASE()
        AND index_name = 'idx_postreminders_targettime'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_postreminders_targettime ON PostReminders(TargetTime);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;
/* ==> mysql/000092_add_createat_to_teammembers.up.sql <== */
SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND column_name = 'CreateAt'
    ),
    'ALTER TABLE TeamMembers ADD COLUMN CreateAt bigint DEFAULT 0;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'TeamMembers'
        AND table_schema = DATABASE()
        AND index_name = 'idx_teammembers_create_at'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_teammembers_createat ON TeamMembers(CreateAt);'
));

PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

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

/* ==> mysql/000095_remove_posts_parentid.up.sql <== */
-- While upgrading from 5.x to 6.x with manual queries, there is a chance that this
-- migration is skipped. In that case, we need to make sure that the column is dropped.

SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Posts'
        AND table_schema = DATABASE()
        AND column_name = 'ParentId'
    ) > 0,
    'ALTER TABLE Posts DROP COLUMN ParentId;',
    'SELECT 1'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000096_threads_threadteamid.up.sql <== */
-- Drop any existing TeamId column from 000094_threads_teamid.up.sql
SET @preparedStatement = (SELECT IF(
    EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'TeamId'
    ) > 0,
    'ALTER TABLE Threads DROP COLUMN TeamId;',
    'SELECT 1;'
));

PREPARE removeColumnIfExists FROM @preparedStatement;
EXECUTE removeColumnIfExists;
DEALLOCATE PREPARE removeColumnIfExists;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Threads'
        AND table_schema = DATABASE()
        AND column_name = 'ThreadTeamId'
    ),
    'ALTER TABLE Threads ADD COLUMN ThreadTeamId varchar(26) DEFAULT NULL;',
    'SELECT 1;'
));

PREPARE addColumnIfNotExists FROM @preparedStatement;
EXECUTE addColumnIfNotExists;
DEALLOCATE PREPARE addColumnIfNotExists;

UPDATE Threads, Channels
SET Threads.ThreadTeamId = Channels.TeamId
WHERE Channels.Id = Threads.ChannelId
AND Threads.ThreadTeamId IS NULL;

/* ==> mysql/000097_create_posts_priority.up.sql <== */
CREATE TABLE IF NOT EXISTS PostsPriority (
    PostId varchar(26) NOT NULL,
    ChannelId varchar(26) NOT NULL,
    Priority varchar(32) NOT NULL,
    RequestedAck tinyint(1),
    PersistentNotifications tinyint(1),
    PRIMARY KEY (PostId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @preparedStatement = (SELECT IF(
    NOT EXISTS(
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'ChannelMembers'
        AND table_schema = DATABASE()
        AND column_name = 'UrgentMentionCount'
    ),
    'ALTER TABLE ChannelMembers ADD COLUMN UrgentMentionCount bigint(20);',
    'SELECT 1;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

/* ==> mysql/000098_create_post_acknowledgements.up.sql <== */
CREATE TABLE IF NOT EXISTS PostAcknowledgements (
    PostId varchar(26) NOT NULL,
    UserId varchar(26) NOT NULL,
    AcknowledgedAt bigint(20) DEFAULT NULL,
    PRIMARY KEY (PostId, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==> mysql/000099_create_drafts.up.sql <== */
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
    PRIMARY KEY (UserId, ChannelId, RootId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ==> mysql/000100_add_draft_priority_column.up.sql <== */
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_name = 'Drafts'
        AND table_schema = DATABASE()
        AND column_name = 'Priority'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE Drafts ADD COLUMN Priority text;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

/* ==> mysql/000101_create_true_up_review_history.up.sql <== */
CREATE TABLE IF NOT EXISTS TrueUpReviewHistory (
	DueDate bigint(20),
	Completed boolean,
    PRIMARY KEY (DueDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
