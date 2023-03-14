// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	"github.com/mattermost/mattermost-server/v6/server/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/server/channels/store/storetest"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
	"github.com/mgdelacroix/foundation"
	"github.com/stretchr/testify/require"
)

type storeType struct {
	Name   string
	Store  store.Store
	Logger *mlog.Logger
}

func newStoreType(t *testing.T, name string, driver string, skipMigrations bool) *storeType {
	settings := storetest.MakeSqlSettings(driver, false)
	require.NotNil(t, settings.DataSource)
	connectionString := *settings.DataSource

	logger := mlog.CreateConsoleTestLogger(false, mlog.LvlDebug)

	sqlDB, err := sql.Open(driver, connectionString)
	require.NoError(t, err)
	err = sqlDB.Ping()
	require.NoError(t, err)

	storeParams := Params{
		DBType:           driver,
		ConnectionString: connectionString,
		SkipMigrations:   skipMigrations,
		TablePrefix:      "focalboard_",
		Logger:           logger,
		DB:               sqlDB,
		IsPlugin:         false, // ToDo: to be removed
	}
	store, err := New(storeParams)
	require.NoError(t, err)

	return &storeType{name, store, logger}
}

func RunStoreTests(t *testing.T, f func(*testing.T, store.Store)) {
	var storeTypes []*storeType

	storeTypes = append(storeTypes,
		newStoreType(t, "PostgreSQL", model.PostgresDBType, true),
		newStoreType(t, "MySQL", model.MysqlDBType, true),
	)

	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			f(t, st.Store)
		})
		require.NoError(t, st.Store.Shutdown())
		require.NoError(t, st.Logger.Shutdown())
	}
}

func RunStoreTestsWithSqlStore(t *testing.T, f func(*testing.T, *SQLStore)) {
	var storeTypes []*storeType

	storeTypes = append(storeTypes,
		newStoreType(t, "PostgreSQL", model.PostgresDBType, true),
		newStoreType(t, "MySQL", model.MysqlDBType, true),
	)

	for _, st := range storeTypes {
		st := st
		sqlstore := st.Store.(*SQLStore)
		t.Run(st.Name, func(t *testing.T) {
			f(t, sqlstore)
		})
		require.NoError(t, st.Store.Shutdown())
		require.NoError(t, st.Logger.Shutdown())
	}
}

func RunStoreTestsWithFoundation(t *testing.T, f func(*testing.T, *foundation.Foundation)) {
	var storeTypes []*storeType

	storeTypes = append(storeTypes,
		newStoreType(t, "PostgreSQL", model.PostgresDBType, false),
		newStoreType(t, "MySQL", model.MysqlDBType, false),
	)

	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			sqlstore := st.Store.(*SQLStore)
			f(t, foundation.New(t, NewBoardsMigrator(sqlstore)))
		})
		require.NoError(t, st.Store.Shutdown())
		require.NoError(t, st.Logger.Shutdown())
	}
}
