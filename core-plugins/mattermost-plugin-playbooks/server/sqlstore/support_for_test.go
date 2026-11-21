// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/blang/semver"
	"github.com/golang/mock/gomock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	mock_app "github.com/mattermost/mattermost-plugin-playbooks/server/app/mocks"
)

func setupTestDB(t testing.TB) *sqlx.DB {
	t.Helper()

	driverName := model.DatabaseDriverPostgres
	sqlSettings := storetest.MakeSqlSettings(driverName)

	origDB, err := sql.Open(*sqlSettings.DriverName, *sqlSettings.DataSource)
	require.NoError(t, err)

	db := sqlx.NewDb(origDB, driverName)

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
	if driverName != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", driverName)
	}

	builder := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

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

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	// NOTE: for this and the other tables below, this is a now out-of-date schema, which doesn't
	//       reflect any of the changes past v5.0. If the test code requires a new column, you will
	//       need to update these tables accordingly.
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
}

func setupChannelMemberHistoryTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.channelmemberhistory (
			channelid character varying(26) NOT NULL,
			userid character varying(26) NOT NULL,
			jointime bigint NOT NULL,
			leavetime bigint
		);
	`)
	require.NoError(t, err)
}

func setupTeamMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
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
}

func setupChannelMembersTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
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
}

func setupChannelsTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
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
}

func setupPostsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
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
}

func setupTeamsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
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
}

func setupRolesTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
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
}

func setupSchemesTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-6.0.sql
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
}

func setupBotsTable(t testing.TB, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// This is completely handmade
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS public.bots (
			userid character varying(26) NOT NULL PRIMARY KEY,
			description character varying(1024),
		    ownerid character varying(190)
		);
	`)
	require.NoError(t, err)
}

func setupKVStoreTable(t *testing.T, db *sqlx.DB) {
	t.Helper()

	if db.DriverName() != model.DatabaseDriverPostgres {
		t.Fatalf("unsupported database driver: %s, only PostgreSQL is supported", db.DriverName())
	}

	// Statements copied from mattermost-server/scripts/mattermost-postgresql-5.0.sql
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
