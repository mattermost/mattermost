package pluginapi_test

import (
	"database/sql"
	"testing"

	pluginapi "github.com/mattermost/mattermost-plugin-api"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"

	_ "github.com/proullon/ramsql/driver"
	"github.com/stretchr/testify/require"
)

func TestStore(t *testing.T) {
	t.Run("no license, empty config", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		store := pluginapi.NewClient(api).Store

		api.On("GetLicense").Return(nil)
		api.On("GetUnsanitizedConfig").Return(&model.Config{})
		db, err := store.GetMasterDB()
		require.Error(t, err)
		require.Nil(t, db)

		require.NoError(t, store.Close())
	})

	t.Run("master db singleton", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestStore-master-db")
		require.NoError(t, err)
		defer db.Close()

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestStore-master-db"),
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetLicense").Return(&model.License{})
		api.On("GetUnsanitizedConfig").Return(config)

		store := pluginapi.NewClient(api).Store

		db1, err := store.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, db1)

		db2, err := store.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, db2)

		require.Same(t, db1, db2)
		require.NoError(t, store.Close())
	})

	t.Run("master db", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestStore-master-db")
		require.NoError(t, err)
		defer db.Close()

		_, err = db.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)
		_, err = db.Exec("INSERT INTO test (id) VALUES (2);")
		require.NoError(t, err)

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestStore-master-db"),
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		store := pluginapi.NewClient(api).Store
		api.On("GetLicense").Return(&model.License{})

		api.On("GetUnsanitizedConfig").Return(config)
		masterDB, err := store.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, masterDB)

		var id int
		err = masterDB.QueryRow("SELECT id FROM test").Scan(&id)
		require.NoError(t, err)
		require.Equal(t, 2, id)

		// No replica is set up, should fallback to master
		replicaDB, err := store.GetReplicaDB()
		require.NoError(t, err)
		require.Same(t, replicaDB, masterDB)

		require.NoError(t, store.Close())
	})

	t.Run("replica db singleton", func(t *testing.T) {
		db, err := sql.Open("ramsql", "TestStore-master-db")
		require.NoError(t, err)
		defer db.Close()

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestStore-master-db"),
				DataSourceReplicas:          []string{"TestStore-master-db"},
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		api.On("GetLicense").Return(&model.License{})
		api.On("GetUnsanitizedConfig").Return(config)

		store := pluginapi.NewClient(api).Store

		db1, err := store.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, db1)

		db2, err := store.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, db2)

		require.Same(t, db1, db2)
		require.NoError(t, store.Close())
	})

	t.Run("replica db", func(t *testing.T) {
		masterDB, err := sql.Open("ramsql", "TestStore-replica-db-1")
		require.NoError(t, err)
		defer masterDB.Close()

		_, err = masterDB.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)

		replicaDB, err := sql.Open("ramsql", "TestStore-replica-db-2")
		require.NoError(t, err)
		defer masterDB.Close()

		_, err = replicaDB.Exec("CREATE TABLE test (id INT);")
		require.NoError(t, err)
		_, err = replicaDB.Exec("INSERT INTO test (id) VALUES (3);")
		require.NoError(t, err)

		config := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName:                  model.NewString("ramsql"),
				DataSource:                  model.NewString("TestStore-replica-db-1"),
				DataSourceReplicas:          []string{"TestStore-replica-db-2"},
				ConnMaxLifetimeMilliseconds: model.NewInt(2),
			},
		}

		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		store := pluginapi.NewClient(api).Store

		api.On("GetLicense").Return(&model.License{})
		api.On("GetUnsanitizedConfig").Return(config)
		storeMasterDB, err := store.GetMasterDB()
		require.NoError(t, err)
		require.NotNil(t, storeMasterDB)

		var count int
		err = storeMasterDB.QueryRow("SELECT COUNT(*) FROM test").Scan(&count)
		require.NoError(t, err)
		require.Equal(t, 0, count)

		storeReplicaDB, err := store.GetReplicaDB()
		require.NoError(t, err)
		require.NotNil(t, storeReplicaDB)

		var id int
		err = storeReplicaDB.QueryRow("SELECT id FROM test").Scan(&id)
		require.NoError(t, err)
		require.Equal(t, 3, id)

		require.NoError(t, store.Close())
	})
}
