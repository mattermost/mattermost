// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/db"
	"github.com/mattermost/mattermost-server/v6/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/searchtest"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
)

type storeType struct {
	Name        string
	SqlSettings *model.SqlSettings
	SqlStore    *SqlStore
	Store       store.Store
}

var storeTypes []*storeType

func newStoreType(name, driver string) *storeType {
	return &storeType{
		Name:        name,
		SqlSettings: storetest.MakeSqlSettings(driver, false),
	}
}

func StoreTest(t *testing.T, f func(*testing.T, store.Store)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, st.Store)
		})
	}
}

func StoreTestWithSearchTestEngine(t *testing.T, f func(*testing.T, store.Store, *searchtest.SearchTestEngine)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()

	for _, st := range storeTypes {
		st := st
		searchTestEngine := &searchtest.SearchTestEngine{
			Driver: *st.SqlSettings.DriverName,
		}

		t.Run(st.Name, func(t *testing.T) { f(t, st.Store, searchTestEngine) })
	}
}

func StoreTestWithSqlStore(t *testing.T, f func(*testing.T, store.Store, storetest.SqlStore)) {
	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	for _, st := range storeTypes {
		st := st
		t.Run(st.Name, func(t *testing.T) {
			if testing.Short() {
				t.SkipNow()
			}
			f(t, st.Store, &StoreTestWrapper{st.SqlStore})
		})
	}
}

func initStores() {
	if testing.Short() {
		return
	}
	// In CI, we already run the entire test suite for both mysql and postgres in parallel.
	// So we just run the tests for the current database set.
	if os.Getenv("IS_CI") == "true" {
		switch os.Getenv("MM_SQLSETTINGS_DRIVERNAME") {
		case "mysql":
			storeTypes = append(storeTypes, newStoreType("MySQL", model.DatabaseDriverMysql))
		case "postgres":
			storeTypes = append(storeTypes, newStoreType("PostgreSQL", model.DatabaseDriverPostgres))
		}
	} else {
		storeTypes = append(storeTypes,
			newStoreType("MySQL", model.DatabaseDriverMysql),
			newStoreType("PostgreSQL", model.DatabaseDriverPostgres),
		)
	}

	defer func() {
		if err := recover(); err != nil {
			tearDownStores()
			panic(err)
		}
	}()
	var wg sync.WaitGroup
	for _, st := range storeTypes {
		st := st
		wg.Add(1)
		go func() {
			defer wg.Done()
			st.SqlStore = New(*st.SqlSettings, nil)
			st.Store = st.SqlStore
			st.Store.DropAllTables()
			st.Store.MarkSystemRanUnitTests()
		}()
	}
	wg.Wait()
}

var tearDownStoresOnce sync.Once

func tearDownStores() {
	if testing.Short() {
		return
	}
	tearDownStoresOnce.Do(func() {
		var wg sync.WaitGroup
		wg.Add(len(storeTypes))
		for _, st := range storeTypes {
			st := st
			go func() {
				if st.Store != nil {
					st.Store.Close()
				}
				if st.SqlSettings != nil {
					storetest.CleanupSqlSettings(st.SqlSettings)
				}
				wg.Done()
			}()
		}
		wg.Wait()
	})
}

// This test was used to consistently reproduce the race
// before the fix in MM-28397.
// Keeping it here to help avoiding future regressions.
func TestStoreLicenseRace(t *testing.T) {
	settings := makeSqlSettings(model.DatabaseDriverPostgres)
	store := New(*settings, nil)
	defer func() {
		store.Close()
		storetest.CleanupSqlSettings(settings)
	}()

	wg := sync.WaitGroup{}
	wg.Add(3)

	go func() {
		store.UpdateLicense(&model.License{})
		wg.Done()
	}()

	go func() {
		store.GetReplicaX()
		wg.Done()
	}()

	go func() {
		store.GetSearchReplicaX()
		wg.Done()
	}()

	wg.Wait()
}

func TestGetReplica(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		Description                string
		DataSourceReplicaNum       int
		DataSourceSearchReplicaNum int
	}{
		{
			"no replicas",
			0,
			0,
		},
		{
			"one source replica",
			1,
			0,
		},
		{
			"multiple source replicas",
			3,
			0,
		},
		{
			"one source search replica",
			0,
			1,
		},
		{
			"multiple source search replicas",
			0,
			3,
		},
		{
			"one source replica, one source search replica",
			1,
			1,
		},
		{
			"one source replica, multiple source search replicas",
			1,
			3,
		},
		{
			"multiple source replica, one source search replica",
			3,
			1,
		},
		{
			"multiple source replica, multiple source search replicas",
			3,
			3,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description+" with license", func(t *testing.T) {

			settings := makeSqlSettings(model.DatabaseDriverPostgres)
			dataSourceReplicas := []string{}
			dataSourceSearchReplicas := []string{}
			for i := 0; i < testCase.DataSourceReplicaNum; i++ {
				dataSourceReplicas = append(dataSourceReplicas, *settings.DataSource)
			}
			for i := 0; i < testCase.DataSourceSearchReplicaNum; i++ {
				dataSourceSearchReplicas = append(dataSourceSearchReplicas, *settings.DataSource)
			}

			settings.DataSourceReplicas = dataSourceReplicas
			settings.DataSourceSearchReplicas = dataSourceSearchReplicas
			store := New(*settings, nil)
			defer func() {
				store.Close()
				storetest.CleanupSqlSettings(settings)
			}()

			store.UpdateLicense(&model.License{})

			replicas := make(map[*sqlxDBWrapper]bool)
			for i := 0; i < 5; i++ {
				replicas[store.GetReplicaX()] = true
			}

			searchReplicas := make(map[*sqlxDBWrapper]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[store.GetSearchReplicaX()] = true
			}

			if testCase.DataSourceReplicaNum > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, testCase.DataSourceReplicaNum)

				for replica := range replicas {
					assert.NotSame(t, store.GetMasterX(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Same(t, store.GetMasterX(), replica)
				}
			}

			if testCase.DataSourceSearchReplicaNum > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, testCase.DataSourceSearchReplicaNum)

				for searchReplica := range searchReplicas {
					assert.NotSame(t, store.GetMasterX(), searchReplica)
					for replica := range replicas {
						assert.NotSame(t, searchReplica, replica)
					}
				}
			} else if testCase.DataSourceReplicaNum > 0 {
				assert.Equal(t, len(replicas), len(searchReplicas))
				for k := range replicas {
					assert.True(t, searchReplicas[k])
				}
			} else if testCase.DataSourceReplicaNum == 0 && assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMasterX(), searchReplica)
				}
			}
		})

		t.Run(testCase.Description+" without license", func(t *testing.T) {

			settings := makeSqlSettings(model.DatabaseDriverPostgres)
			dataSourceReplicas := []string{}
			dataSourceSearchReplicas := []string{}
			for i := 0; i < testCase.DataSourceReplicaNum; i++ {
				dataSourceReplicas = append(dataSourceReplicas, *settings.DataSource)
			}
			for i := 0; i < testCase.DataSourceSearchReplicaNum; i++ {
				dataSourceSearchReplicas = append(dataSourceSearchReplicas, *settings.DataSource)
			}

			settings.DataSourceReplicas = dataSourceReplicas
			settings.DataSourceSearchReplicas = dataSourceSearchReplicas
			store := New(*settings, nil)
			defer func() {
				store.Close()
				storetest.CleanupSqlSettings(settings)
			}()

			replicas := make(map[*sqlxDBWrapper]bool)
			for i := 0; i < 5; i++ {
				replicas[store.GetReplicaX()] = true
			}

			searchReplicas := make(map[*sqlxDBWrapper]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[store.GetSearchReplicaX()] = true
			}

			if testCase.DataSourceReplicaNum > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, 1)

				for replica := range replicas {
					assert.Same(t, store.GetMasterX(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Same(t, store.GetMasterX(), replica)
				}
			}

			if testCase.DataSourceSearchReplicaNum > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, 1)

				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMasterX(), searchReplica)
				}

			} else if testCase.DataSourceReplicaNum > 0 {
				assert.Equal(t, len(replicas), len(searchReplicas))
				for k := range replicas {
					assert.True(t, searchReplicas[k])
				}
			} else if assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMasterX(), searchReplica)
				}
			}
		})
	}
}

func TestGetDbVersion(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	for _, driver := range testDrivers {
		t.Run("Should return db version for "+driver, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(driver)
			store := New(*settings, nil)

			version, err := store.GetDbVersion(false)
			require.NoError(t, err)
			require.Regexp(t, regexp.MustCompile(`\d+\.\d+(\.\d+)?`), version)
		})
	}
}

func TestEnsureMinimumDBVersion(t *testing.T) {
	tests := []struct {
		driver string
		ver    string
		ok     bool
		err    string
	}{
		{
			driver: model.DatabaseDriverPostgres,
			ver:    "100001",
			ok:     true,
			err:    "",
		},
		{
			driver: model.DatabaseDriverPostgres,
			ver:    "90603",
			ok:     false,
			err:    "minimum Postgres version requirements not met",
		},
		{
			driver: model.DatabaseDriverPostgres,
			ver:    "12.34.1",
			ok:     false,
			err:    "cannot parse DB version",
		},
		{
			driver: model.DatabaseDriverMysql,
			ver:    "10.4.5-MariaDB",
			ok:     true,
			err:    "",
		},
		{
			driver: model.DatabaseDriverMysql,
			ver:    "5.6.99-test",
			ok:     false,
			err:    "minimum MySQL version requirements not met",
		},
		{
			driver: model.DatabaseDriverMysql,
			ver:    "34-55.12",
			ok:     false,
			err:    "cannot parse MySQL DB version",
		},
		{
			driver: model.DatabaseDriverMysql,
			ver:    "8.0.0-log",
			ok:     true,
			err:    "",
		},
	}

	pg := model.DatabaseDriverPostgres
	pgSettings := &model.SqlSettings{
		DriverName: &pg,
	}
	my := model.DatabaseDriverMysql
	mySettings := &model.SqlSettings{
		DriverName: &my,
	}
	for _, tc := range tests {
		store := &SqlStore{}
		switch tc.driver {
		case pg:
			store.settings = pgSettings
		case my:
			store.settings = mySettings
		}
		ok, err := store.ensureMinimumDBVersion(tc.ver)
		assert.Equal(t, tc.ok, ok)
		if tc.err != "" {
			assert.Contains(t, err.Error(), tc.err)
		}
	}
}

func TestIsBinaryParamEnabled(t *testing.T) {
	tests := []struct {
		store    SqlStore
		expected bool
	}{
		{
			store: SqlStore{
				settings: &model.SqlSettings{
					DriverName: model.NewString(model.DatabaseDriverPostgres),
					DataSource: model.NewString("postgres://mmuser:mostest@localhost/loadtest?sslmode=disable\u0026binary_parameters=yes"),
				},
			},
			expected: true,
		},
		{
			store: SqlStore{
				settings: &model.SqlSettings{
					DriverName: model.NewString(model.DatabaseDriverMysql),
					DataSource: model.NewString("postgres://mmuser:mostest@localhost/loadtest?sslmode=disable\u0026binary_parameters=yes"),
				},
			},
			expected: false,
		},
		{
			store: SqlStore{
				settings: &model.SqlSettings{
					DriverName: model.NewString(model.DatabaseDriverPostgres),
					DataSource: model.NewString("postgres://mmuser:mostest@localhost/loadtest?sslmode=disable&binary_parameters=yes"),
				},
			},
			expected: true,
		},
		{
			store: SqlStore{
				settings: &model.SqlSettings{
					DriverName: model.NewString(model.DatabaseDriverPostgres),
					DataSource: model.NewString("postgres://mmuser:mostest@localhost/loadtest?sslmode=disable"),
				},
			},
			expected: false,
		},
	}

	for i := range tests {
		ok, err := tests[i].store.computeBinaryParam()
		require.NoError(t, err)
		assert.Equal(t, tests[i].expected, ok)
	}

}

func TestGetAllConns(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		Description                string
		DataSourceReplicaNum       int
		DataSourceSearchReplicaNum int
		ExpectedNumConnections     int
	}{
		{
			"no replicas",
			0,
			0,
			1,
		},
		{
			"one source replica",
			1,
			0,
			2,
		},
		{
			"multiple source replicas",
			3,
			0,
			4,
		},
		{
			"one source search replica",
			0,
			1,
			1,
		},
		{
			"multiple source search replicas",
			0,
			3,
			1,
		},
		{
			"one source replica, one source search replica",
			1,
			1,
			2,
		},
		{
			"one source replica, multiple source search replicas",
			1,
			3,
			2,
		},
		{
			"multiple source replica, one source search replica",
			3,
			1,
			4,
		},
		{
			"multiple source replica, multiple source search replicas",
			3,
			3,
			4,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(model.DatabaseDriverPostgres)
			dataSourceReplicas := []string{}
			dataSourceSearchReplicas := []string{}
			for i := 0; i < testCase.DataSourceReplicaNum; i++ {
				dataSourceReplicas = append(dataSourceReplicas, *settings.DataSource)
			}
			for i := 0; i < testCase.DataSourceSearchReplicaNum; i++ {
				dataSourceSearchReplicas = append(dataSourceSearchReplicas, *settings.DataSource)
			}

			settings.DataSourceReplicas = dataSourceReplicas
			settings.DataSourceSearchReplicas = dataSourceSearchReplicas
			store := New(*settings, nil)
			defer func() {
				store.Close()
				storetest.CleanupSqlSettings(settings)
			}()

			assert.Len(t, store.GetAllConns(), testCase.ExpectedNumConnections)
		})
	}
}

func TestIsDuplicate(t *testing.T) {
	testErrors := map[error]bool{
		&pq.Error{Code: "42P06"}:                          false,
		&pq.Error{Code: PGDupTableErrorCode}:              true,
		&mysql.MySQLError{Number: uint16(1000)}:           false,
		&mysql.MySQLError{Number: MySQLDupTableErrorCode}: true,
		errors.New("Random error"):                        false,
	}

	for err, expected := range testErrors {
		t.Run(fmt.Sprintf("Should return %t for %s", expected, err.Error()), func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, expected, IsDuplicate(err))
		})
	}
}

func TestVersionString(t *testing.T) {
	versions := []struct {
		input  int
		driver string
		output string
	}{
		{
			input:  100000,
			driver: model.DatabaseDriverPostgres,
			output: "10.0",
		},
		{
			input:  90603,
			driver: model.DatabaseDriverPostgres,
			output: "9.603",
		},
		{
			input:  120005,
			driver: model.DatabaseDriverPostgres,
			output: "12.5",
		},
		{
			input:  5708,
			driver: model.DatabaseDriverMysql,
			output: "5.7.8",
		},
		{
			input:  8000,
			driver: model.DatabaseDriverMysql,
			output: "8.0.0",
		},
	}

	for _, v := range versions {
		out := versionString(v.input, v.driver)
		assert.Equal(t, v.output, out)
	}
}

func TestReplicaLagQuery(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	for _, driver := range testDrivers {
		settings := makeSqlSettings(driver)
		var query string
		var tableName string
		// Just any random query which returns a row in (string, int) format.
		switch driver {
		case model.DatabaseDriverPostgres:
			query = `SELECT relname, count(relname) FROM pg_class WHERE relname='posts' GROUP BY relname`
			tableName = "posts"
		case model.DatabaseDriverMysql:
			query = `SELECT table_name, count(table_name) FROM information_schema.tables WHERE table_name='Posts' and table_schema=Database() GROUP BY table_name`
			tableName = "Posts"
		}

		settings.ReplicaLagSettings = []*model.ReplicaLagSettings{{
			DataSource:       model.NewString(*settings.DataSource),
			QueryAbsoluteLag: model.NewString(query),
			QueryTimeLag:     model.NewString(query),
		}}

		mockMetrics := &mocks.MetricsInterface{}
		defer mockMetrics.AssertExpectations(t)
		mockMetrics.On("SetReplicaLagAbsolute", tableName, float64(1))
		mockMetrics.On("SetReplicaLagTime", tableName, float64(1))

		store := &SqlStore{
			rrCounter: 0,
			srCounter: 0,
			settings:  settings,
			metrics:   mockMetrics,
		}

		store.initConnection()
		store.stores.post = newSqlPostStore(store, mockMetrics)
		err := store.migrate(migrationsDirectionUp, false)
		require.NoError(t, err)

		defer store.Close()

		err = store.ReplicaLagAbs()
		require.NoError(t, err)
		err = store.ReplicaLagTime()
		require.NoError(t, err)
	}
}

func makeSqlSettings(driver string) *model.SqlSettings {
	switch driver {
	case model.DatabaseDriverPostgres:
		return storetest.MakeSqlSettings(driver, false)
	case model.DatabaseDriverMysql:
		return storetest.MakeSqlSettings(driver, false)
	}

	return nil
}

func TestExecNoTimeout(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		sqlStore := ss.(*SqlStore)
		var query string
		timeout := sqlStore.masterX.queryTimeout
		sqlStore.masterX.queryTimeout = 1
		defer func() {
			sqlStore.masterX.queryTimeout = timeout
		}()
		if sqlStore.DriverName() == model.DatabaseDriverMysql {
			query = `SELECT SLEEP(2);`
		} else if sqlStore.DriverName() == model.DatabaseDriverPostgres {
			query = `SELECT pg_sleep(2);`
		}
		_, err := sqlStore.GetMasterX().ExecNoTimeout(query)
		require.NoError(t, err)
	})
}

func TestMySQLReadTimeout(t *testing.T) {
	settings := makeSqlSettings(model.DatabaseDriverMysql)
	dataSource := *settings.DataSource
	config, err := mysql.ParseDSN(dataSource)
	require.NoError(t, err)

	config.ReadTimeout = 1 * time.Second
	dataSource = config.FormatDSN()
	settings.DataSource = &dataSource

	store := &SqlStore{
		settings: settings,
	}
	store.initConnection()
	defer store.Close()

	_, err = store.GetMasterX().ExecNoTimeout(`SELECT SLEEP(3)`)
	require.NoError(t, err)
}

func TestGetDBSchemaVersion(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	assets := db.Assets()

	for _, driver := range testDrivers {
		t.Run("Should return latest version number of applied migrations for "+driver, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(driver)
			store := New(*settings, nil)

			assetsList, err := assets.ReadDir(filepath.Join("migrations", driver))
			require.NoError(t, err)

			var assetNamesForDriver []string
			for _, entry := range assetsList {
				assetNamesForDriver = append(assetNamesForDriver, entry.Name())
			}
			sort.Strings(assetNamesForDriver)

			require.NotEmpty(t, assetNamesForDriver)
			lastMigration := assetNamesForDriver[len(assetNamesForDriver)-1]
			expectedVersion := strings.Split(lastMigration, "_")[0]

			version, err := store.GetDBSchemaVersion()
			require.NoError(t, err)
			require.Equal(t, expectedVersion, fmt.Sprintf("%06d", version))
		})
	}
}

func TestGetAppliedMigrations(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	assets := db.Assets()

	for _, driver := range testDrivers {
		t.Run("Should return db applied migrations for "+driver, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(driver)
			store := New(*settings, nil)

			assetsList, err := assets.ReadDir(filepath.Join("migrations", driver))
			require.NoError(t, err)

			var migrationsFromFiles []model.AppliedMigration
			for _, entry := range assetsList {
				if strings.HasSuffix(entry.Name(), ".up.sql") {
					versionString := strings.Split(entry.Name(), "_")[0]
					version, vErr := strconv.Atoi(versionString)
					require.NoError(t, vErr)

					name := strings.TrimSuffix(strings.TrimLeft(entry.Name(), versionString+"_"), ".up.sql")

					migrationsFromFiles = append(migrationsFromFiles, model.AppliedMigration{
						Version: version,
						Name:    name,
					})
				}
			}

			require.NotEmpty(t, migrationsFromFiles)

			migrations, err := store.GetAppliedMigrations()
			require.NoError(t, err)
			require.ElementsMatch(t, migrationsFromFiles, migrations)
		})
	}
}
