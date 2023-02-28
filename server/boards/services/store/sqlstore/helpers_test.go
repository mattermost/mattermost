package sqlstore

import (
	"database/sql"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/services/store"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func SetupTests(t *testing.T) (store.Store, func()) {
	origUnitTesting := os.Getenv("FOCALBOARD_UNIT_TESTING")
	os.Setenv("FOCALBOARD_UNIT_TESTING", "1")

	dbType, connectionString, err := PrepareNewTestDatabase()
	require.NoError(t, err)

	logger := mlog.CreateConsoleTestLogger(false, mlog.LvlDebug)

	sqlDB, err := sql.Open(dbType, connectionString)
	require.NoError(t, err)
	err = sqlDB.Ping()
	require.NoError(t, err)

	storeParams := Params{
		DBType:           dbType,
		ConnectionString: connectionString,
		TablePrefix:      "test_",
		Logger:           logger,
		DB:               sqlDB,
		IsPlugin:         false,
	}
	store, err := New(storeParams)
	require.NoError(t, err)

	tearDown := func() {
		defer func() { _ = logger.Shutdown() }()
		err = store.Shutdown()
		require.Nil(t, err)
		if err = os.Remove(connectionString); err == nil {
			logger.Debug("Removed test database", mlog.String("file", connectionString))
		}
		os.Setenv("FOCALBOARD_UNIT_TESTING", origUnitTesting)
	}

	return store, tearDown
}
