// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/blang/semver"
	mock_app "github.com/mattermost/mattermost-server/v6/server/playbooks/server/app/mocks"

	sq "github.com/Masterminds/squirrel"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store/storetest"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/stretchr/testify/require"
)

var driverNames = []string{model.DatabaseDriverPostgres, model.DatabaseDriverMysql}

func setupTestDB(t testing.TB, driverName string) *sqlx.DB {
	t.Helper()

	sqlSettings := storetest.MakeSqlSettings(driverName, false)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)
	if driverName == model.DatabaseDriverMysql {
		db.MapperFunc(func(s string) string { return s })
	}

	t.Cleanup(func() {
		err := db.Close()
		require.NoError(t, err)
		storetest.CleanupSqlSettings(sqlSettings)
	})

	return db
}

func setupTables(t *testing.T, db *sqlx.DB) *SQLStore {
	t.Helper()

	mockCtrl := gomock.NewController(t)
	scheduler := mock_app.NewMockJobOnceScheduler(mockCtrl)

	driverName := db.DriverName()

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	if driverName == model.DatabaseDriverPostgres {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	sqlStore := &SQLStore{
		db,
		builder,
		scheduler,
	}

	setupChannelsTable(t, db)
	setupPostsTable(t, db)
	setupBotsTable(t, db)
	setupChannelMembersTable(t, db)
	setupKVStoreTable(t, db)
	setupUsersTable(t, db)
	setupTeamsTable(t, db)
	setupRolesTable(t, db)
	setupSchemesTable(t, db)
	setupTeamMembersTable(t, db)

	return sqlStore
}

func setupSQLStore(t *testing.T, db *sqlx.DB) *SQLStore {
	sqlStore := setupTables(t, db)

	err := sqlStore.RunMigrations()
	require.NoError(t, err)

	return sqlStore
}

func setupUsersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	// NOTE: for this and the other tables below, this is a now out-of-date schema, which doesn't
	//       reflect any of the changes past v5.0. If the test code requires a new column, you will
	//       need to update these tables accordingly.
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.users (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				username character varying(64),
				password character varying(128),
				authdata character varying(128),
				authservice character varying(32),
				email character varying(128),
				emailverified boolean,
				nickname character varying(64),
				firstname character varying(64),
				lastname character varying(64),
				"position" character varying(128),
				roles character varying(256),
				allowmarketing boolean,
				props character varying(4000),
				notifyprops character varying(2000),
				lastpasswordupdate bigint,
				lastpictureupdate bigint,
				failedattempts integer,
				locale character varying(5),
				timezone character varying(256),
				mfaactive boolean,
				mfasecret character varying(128),
				PRIMARY KEY (Id)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Users (
				Id varchar(26) NOT NULL,
				CreateAt bigint(20) DEFAULT NULL,
				UpdateAt bigint(20) DEFAULT NULL,
				DeleteAt bigint(20) DEFAULT NULL,
				Username varchar(64) DEFAULT NULL,
				Password varchar(128) DEFAULT NULL,
				AuthData varchar(128) DEFAULT NULL,
				AuthService varchar(32) DEFAULT NULL,
				Email varchar(128) DEFAULT NULL,
				EmailVerified tinyint(1) DEFAULT NULL,
				Nickname varchar(64) DEFAULT NULL,
				FirstName varchar(64) DEFAULT NULL,
				LastName varchar(64) DEFAULT NULL,
				Position varchar(128) DEFAULT NULL,
				Roles text,
				AllowMarketing tinyint(1) DEFAULT NULL,
				Props text,
				NotifyProps text,
				LastPasswordUpdate bigint(20) DEFAULT NULL,
				LastPictureUpdate bigint(20) DEFAULT NULL,
				FailedAttempts int(11) DEFAULT NULL,
				Locale varchar(5) DEFAULT NULL,
				Timezone text,
				MfaActive tinyint(1) DEFAULT NULL,
				MfaSecret varchar(128) DEFAULT NULL,
				PRIMARY KEY (Id),
				UNIQUE KEY Username (Username),
				UNIQUE KEY AuthData (AuthData),
				UNIQUE KEY Email (Email),
				KEY idx_users_email (Email),
				KEY idx_users_update_at (UpdateAt),
				KEY idx_users_create_at (CreateAt),
				KEY idx_users_delete_at (DeleteAt),
				FULLTEXT KEY idx_users_all_txt (Username,FirstName,LastName,Nickname,Email),
				FULLTEXT KEY idx_users_all_no_full_name_txt (Username,Nickname,Email),
				FULLTEXT KEY idx_users_names_txt (Username,FirstName,LastName,Nickname),
				FULLTEXT KEY idx_users_names_no_full_name_txt (Username,Nickname)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelMemberHistoryTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmemberhistory (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				jointime bigint NOT NULL,
				leavetime bigint
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMemberHistory (
				ChannelId varchar(26) NOT NULL,
				UserId varchar(26) NOT NULL,
				JoinTime bigint(20) NOT NULL,
				LeaveTime bigint(20) DEFAULT NULL,
				PRIMARY KEY (ChannelId,UserId,JoinTime)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupTeamMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.teammembers (
				teamid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				deleteat bigint,
				schemeuser boolean,
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS TeamMembers (
			  TeamId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (TeamId,UserId),
			  KEY idx_teammembers_team_id (TeamId),
			  KEY idx_teammembers_user_id (UserId),
			  KEY idx_teammembers_delete_at (DeleteAt)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channelmembers (
				channelid character varying(26) NOT NULL,
				userid character varying(26) NOT NULL,
				roles character varying(64),
				lastviewedat bigint,
				msgcount bigint,
				mentioncount bigint,
				notifyprops character varying(2000),
				lastupdateat bigint,
				schemeuser boolean,
				PRIMARY KEY (ChannelId,UserId),
				schemeadmin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS ChannelMembers (
			  ChannelId varchar(26) NOT NULL,
			  UserId varchar(26) NOT NULL,
			  Roles varchar(64) DEFAULT NULL,
			  LastViewedAt bigint(20) DEFAULT NULL,
			  MsgCount bigint(20) DEFAULT NULL,
			  MentionCount bigint(20) DEFAULT NULL,
			  NotifyProps text,
			  LastUpdateAt bigint(20) DEFAULT NULL,
			  SchemeUser tinyint(4) DEFAULT NULL,
			  SchemeAdmin tinyint(4) DEFAULT NULL,
			  PRIMARY KEY (ChannelId,UserId),
			  KEY idx_channelmembers_channel_id (ChannelId),
			  KEY idx_channelmembers_user_id (UserId)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupChannelsTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.channels (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				deleteat bigint,
				teamid character varying(26),
				type character varying(1),
				displayname character varying(64),
				name character varying(64),
				header character varying(1024),
				purpose character varying(250),
				lastpostat bigint,
				totalmsgcount bigint,
				extraupdateat bigint,
				creatorid character varying(26),
				PRIMARY KEY (Id),
				schemeid character varying(26)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Channels (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  TeamId varchar(26) DEFAULT NULL,
			  Type varchar(1) DEFAULT NULL,
			  DisplayName varchar(64) DEFAULT NULL,
			  Name varchar(64) DEFAULT NULL,
			  Header text,
			  Purpose varchar(250) DEFAULT NULL,
			  LastPostAt bigint(20) DEFAULT NULL,
			  TotalMsgCount bigint(20) DEFAULT NULL,
			  ExtraUpdateAt bigint(20) DEFAULT NULL,
			  CreatorId varchar(26) DEFAULT NULL,
			  SchemeId varchar(26) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name,TeamId),
			  KEY idx_channels_team_id (TeamId),
			  KEY idx_channels_name (Name),
			  KEY idx_channels_update_at (UpdateAt),
			  KEY idx_channels_create_at (CreateAt),
			  KEY idx_channels_delete_at (DeleteAt),
			  FULLTEXT KEY idx_channels_txt (Name,DisplayName)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupPostsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.posts (
				id character varying(26) NOT NULL,
				createat bigint,
				updateat bigint,
				editat bigint,
				deleteat bigint,
				ispinned boolean,
				userid character varying(26),
				channelid character varying(26),
				rootid character varying(26),
				parentid character varying(26),
				originalid character varying(26),
				message character varying(65535),
				type character varying(26),
				props character varying(8000),
				hashtags character varying(1000),
				filenames character varying(4000),
				fileids character varying(150),
				PRIMARY KEY (Id),
				hasreactions boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Posts (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  EditAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  IsPinned tinyint(1) DEFAULT NULL,
			  UserId varchar(26) DEFAULT NULL,
			  ChannelId varchar(26) DEFAULT NULL,
			  RootId varchar(26) DEFAULT NULL,
			  ParentId varchar(26) DEFAULT NULL,
			  OriginalId varchar(26) DEFAULT NULL,
			  Message text,
			  Type varchar(26) DEFAULT NULL,
			  Props text,
			  Hashtags text,
			  Filenames text,
			  FileIds varchar(150) DEFAULT NULL,
			  HasReactions tinyint(1) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  KEY idx_posts_update_at (UpdateAt),
			  KEY idx_posts_create_at (CreateAt),
			  KEY idx_posts_delete_at (DeleteAt),
			  KEY idx_posts_channel_id (ChannelId),
			  KEY idx_posts_root_id (RootId),
			  KEY idx_posts_user_id (UserId),
			  KEY idx_posts_is_pinned (IsPinned),
			  KEY idx_posts_channel_id_update_at (ChannelId,UpdateAt),
			  KEY idx_posts_channel_id_delete_at_create_at (ChannelId,DeleteAt,CreateAt),
			  FULLTEXT KEY idx_posts_message_txt (Message),
			  FULLTEXT KEY idx_posts_hashtags_txt (Hashtags)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupTeamsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.teams (
				id character varying(26) NOT NULL,
				PRIMARY KEY (Id),
				createat bigint,
				updateat bigint,
				deleteat bigint,
				displayname character varying(64),
				name character varying(64),
				description character varying(255),
				email character varying(128),
				type character varying(255),
				companyname character varying(64),
				alloweddomains character varying(1000),
				inviteid character varying(32),
				schemeid character varying(26),
				allowopeninvite boolean,
				lastteamiconupdate bigint,
				groupconstrained boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-6.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Teams (
			  Id varchar(26) NOT NULL,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  DisplayName varchar(64) DEFAULT NULL,
			  Name varchar(64) DEFAULT NULL,
			  Description varchar(255) DEFAULT NULL,
			  Email varchar(128) DEFAULT NULL,
			  Type varchar(255) DEFAULT NULL,
			  CompanyName varchar(64) DEFAULT NULL,
			  AllowedDomains text,
			  InviteId varchar(32) DEFAULT NULL,
			  SchemeId varchar(26) DEFAULT NULL,
			  AllowOpenInvite tinyint(1) DEFAULT NULL,
			  LastTeamIconUpdate bigint(20) DEFAULT NULL,
			  GroupConstrained tinyint(1) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name),
			  KEY idx_teams_invite_id (InviteId),
			  KEY idx_teams_update_at (UpdateAt),
			  KEY idx_teams_create_at (CreateAt),
			  KEY idx_teams_delete_at (DeleteAt),
			  KEY idx_teams_scheme_id (SchemeId)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupRolesTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.roles (
				id character varying(26) NOT NULL,
				PRIMARY KEY (Id),
				name character varying(64),
				displayname character varying(128),
				description character varying(1024),
				createat bigint,
				updateat bigint,
				deleteat bigint,
				permissions text,
				schememanaged boolean,
				builtin boolean
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-6.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Roles (
			  Id varchar(26) NOT NULL,
			  Name varchar(64) DEFAULT NULL,
			  DisplayName varchar(128) DEFAULT NULL,
			  Description text,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  Permissions text,
			  SchemeManaged tinyint(1) DEFAULT NULL,
			  BuiltIn tinyint(1) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupSchemesTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.schemes (
				id character varying(26) NOT NULL,
				PRIMARY KEY (Id),
				name character varying(64),
				displayname character varying(128),
				description character varying(1024),
				createat bigint,
				updateat bigint,
				deleteat bigint,
				scope character varying(32),
				defaultteamadminrole character varying(64),
				defaultteamuserrole character varying(64),
				defaultchanneladminrole character varying(64),
				defaultchanneluserrole character varying(64),
				defaultteamguestrole character varying(64),
				defaultchannelguestrole character varying(64),
				defaultplaybookadminrole character varying(64),
				defaultplaybookmemberrole character varying(64),
				defaultrunadminrole character varying(64),
				defaultrunmemberrole character varying(64)
			);
		`)
		require.NoError(t, err)

		return
	}

	// Statements copied from mattermost-server/scripts/mattermost-mysql-6.0.sql
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Schemes (
			  Id varchar(26) NOT NULL,
			  Name varchar(64) DEFAULT NULL,
			  DisplayName varchar(128) DEFAULT NULL,
			  Description text,
			  CreateAt bigint(20) DEFAULT NULL,
			  UpdateAt bigint(20) DEFAULT NULL,
			  DeleteAt bigint(20) DEFAULT NULL,
			  Scope varchar(32) DEFAULT NULL,
			  DefaultTeamAdminRole varchar(64) DEFAULT NULL,
			  DefaultTeamUserRole varchar(64) DEFAULT NULL,
			  DefaultChannelAdminRole varchar(64) DEFAULT NULL,
			  DefaultChannelUserRole varchar(64) DEFAULT NULL,
			  DefaultTeamGuestRole varchar(64) DEFAULT NULL,
			  DefaultChannelGuestRole varchar(64) DEFAULT NULL,
			  DefaultPlaybookAdminRole varchar(64) DEFAULT NULL,
			  DefaultPlaybookMemberRole varchar(64) DEFAULT NULL,
			  DefaultRunAdminRole varchar(64) DEFAULT NULL,
			  DefaultRunMemberRole varchar(64) DEFAULT NULL,
			  PRIMARY KEY (Id),
			  UNIQUE KEY Name (Name),
			  KEY idx_schemes_channel_guest_role (DefaultChannelGuestRole),
			  KEY idx_schemes_channel_user_role (DefaultChannelUserRole),
			  KEY idx_schemes_channel_admin_role (DefaultChannelAdminRole)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupBotsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	// This is completely handmade
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.bots (
				userid character varying(26) NOT NULL PRIMARY KEY,
				description character varying(1024),
			    ownerid character varying(190)
			);
		`)
		require.NoError(t, err)

		return
	}

	// handmade
	_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS Bots (
				UserId varchar(26) NOT NULL PRIMARY KEY,
				Description varchar(1024),
			    OwnerId varchar(190)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
	require.NoError(t, err)
}

func setupKVStoreTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	if db.DriverName() == model.DatabaseDriverPostgres {
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS public.pluginkeyvaluestore (
				pluginid character varying(190) NOT NULL,
				pkey character varying(50) NOT NULL,
				pvalue bytea,
				expireat bigint,
				PRIMARY KEY (PluginId,PKey)
			);
		`)
		require.NoError(t, err)
	} else {
		// Statements copied from mattermost-server/scripts/mattermost-mysql-5.0.sql
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS PluginKeyValueStore (
			  PluginId varchar(190) NOT NULL,
			  PKey varchar(50) NOT NULL,
			  PValue mediumblob,
			  ExpireAt bigint(20) DEFAULT NULL,
			  PRIMARY KEY (PluginId,PKey)
		  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		`)
		require.NoError(t, err)
	}

}

type userInfo struct {
	ID   string
	Name string
}

func addUsers(t *testing.T, store *SQLStore, users []userInfo) {
	t.Helper()

	insertBuilder := store.builder.Insert("Users").Columns("ID", "Username")

	for _, u := range users {
		insertBuilder = insertBuilder.Values(u.ID, u.Name)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addBots(t *testing.T, store *SQLStore, bots []userInfo) {
	t.Helper()

	insertBuilder := store.builder.Insert("Bots").Columns("UserId", "Description")

	for _, u := range bots {
		insertBuilder = insertBuilder.Values(u.ID, u.Name)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToTeam(t *testing.T, store *SQLStore, users []userInfo, teamID string) {
	t.Helper()

	insertBuilder := store.builder.Insert("TeamMembers").Columns("TeamId", "UserId", "DeleteAt")

	for _, u := range users {
		insertBuilder = insertBuilder.Values(teamID, u.ID, 0)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToChannels(t *testing.T, store *SQLStore, users []userInfo, channelIDs []string) {
	t.Helper()

	insertBuilder := store.builder.Insert("ChannelMembers").Columns("ChannelId", "UserId")

	for _, u := range users {
		for _, c := range channelIDs {
			insertBuilder = insertBuilder.Values(c, u.ID)
		}
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func addUsersToRuns(t *testing.T, store *SQLStore, users []userInfo, runIDs []string) {
	t.Helper()

	insertBuilder := store.builder.Insert("IR_Run_Participants").Columns("IncidentID", "UserId", "IsParticipant", "IsFollower")

	for _, u := range users {
		for _, runID := range runIDs {
			insertBuilder = insertBuilder.Values(runID, u.ID, true, false)
		}
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func createChannels(t testing.TB, store *SQLStore, channels []model.Channel) {
	t.Helper()

	insertBuilder := store.builder.Insert("Channels").Columns("Id", "DisplayName", "Type", "CreateAt", "DeleteAt", "Name")

	for _, channel := range channels {
		insertBuilder = insertBuilder.Values(channel.Id, channel.DisplayName, channel.Type, channel.CreateAt, channel.DeleteAt, channel.Name)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func createTeams(t testing.TB, store *SQLStore, teams []model.Team) {
	t.Helper()

	insertBuilder := store.builder.Insert("Teams").Columns("Id", "Name")

	for _, team := range teams {
		insertBuilder = insertBuilder.Values(team.Id, team.Name)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func createPlaybookRunChannel(t testing.TB, store *SQLStore, playbookRun *app.PlaybookRun) {
	t.Helper()

	if playbookRun.CreateAt == 0 {
		playbookRun.CreateAt = model.GetMillis()
	}

	insertBuilder := store.builder.Insert("Channels").Columns("Id", "DisplayName", "CreateAt", "DeleteAt").Values(playbookRun.ChannelID, playbookRun.Name, playbookRun.CreateAt, 0)

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func makeAdmin(t *testing.T, store *SQLStore, user userInfo) {
	t.Helper()

	updateBuilder := store.builder.
		Update("Users").
		Where(sq.Eq{"Id": user.ID}).
		Set("Roles", "role1 role2 system_admin role3")

	_, err := store.execBuilder(store.db, updateBuilder)
	require.NoError(t, err)
}

func savePosts(t testing.TB, store *SQLStore, posts []*model.Post) {
	t.Helper()

	insertBuilder := store.builder.Insert("Posts").Columns("Id", "CreateAt", "DeleteAt")

	for _, p := range posts {
		insertBuilder = insertBuilder.Values(p.Id, p.CreateAt, p.DeleteAt)
	}

	_, err := store.execBuilder(store.db, insertBuilder)
	require.NoError(t, err)
}

func migrateUpTo(t *testing.T, store *SQLStore, lastExpectedVersion semver.Version) {
	t.Helper()

	for _, migration := range migrations {
		if migration.toVersion.GT(lastExpectedVersion) {
			break
		}

		err := store.migrate(migration)
		require.NoError(t, err)

		currentSchemaVersion, err := store.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, migration.toVersion)
	}

	currentSchemaVersion, err := store.GetCurrentVersion()
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, lastExpectedVersion)
}

func migrateFrom(t *testing.T, store *SQLStore, firstExpectedVersion semver.Version) {
	t.Helper()

	currentSchemaVersion, err := store.GetCurrentVersion()
	require.NoError(t, err)
	require.Equal(t, currentSchemaVersion, firstExpectedVersion)

	for _, migration := range migrations {
		if migration.toVersion.LE(firstExpectedVersion) {
			continue
		}

		err := store.migrate(migration)
		require.NoError(t, err)

		currentSchemaVersion, err := store.GetCurrentVersion()
		require.NoError(t, err)
		require.Equal(t, currentSchemaVersion, migration.toVersion)
	}
}
