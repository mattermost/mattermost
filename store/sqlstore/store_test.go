// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"os"
	"regexp"
	"sync"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/mattermost/gorp"
	_ "github.com/mattn/go-sqlite3"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/searchtest"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
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
		SqlSettings: storetest.MakeSqlSettings(driver),
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
			f(t, st.Store, st.SqlStore)
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
			storeTypes = append(storeTypes, newStoreType("MySQL", model.DATABASE_DRIVER_MYSQL))
		case "postgres":
			storeTypes = append(storeTypes, newStoreType("PostgreSQL", model.DATABASE_DRIVER_POSTGRES))
		}
	} else {
		storeTypes = append(storeTypes, newStoreType("MySQL", model.DATABASE_DRIVER_MYSQL),
			newStoreType("PostgreSQL", model.DATABASE_DRIVER_POSTGRES))
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
	settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
	settings.DataSourceReplicas = []string{":memory:"}
	settings.DataSourceSearchReplicas = []string{":memory:"}
	store := New(*settings, nil)

	wg := sync.WaitGroup{}
	wg.Add(3)

	go func() {
		store.UpdateLicense(&model.License{})
		wg.Done()
	}()

	go func() {
		store.GetReplica()
		wg.Done()
	}()

	go func() {
		store.GetSearchReplica()
		wg.Done()
	}()

	wg.Wait()
}

func TestGetReplica(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		Description              string
		DataSourceReplicas       []string
		DataSourceSearchReplicas []string
	}{
		{
			"no replicas",
			[]string{},
			[]string{},
		},
		{
			"one source replica",
			[]string{":memory:"},
			[]string{},
		},
		{
			"multiple source replicas",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{},
		},
		{
			"one source search replica",
			[]string{},
			[]string{":memory:"},
		},
		{
			"multiple source search replicas",
			[]string{},
			[]string{":memory:", ":memory:", ":memory:"},
		},
		{
			"one source replica, one source search replica",
			[]string{":memory:"},
			[]string{":memory:"},
		},
		{
			"one source replica, multiple source search replicas",
			[]string{":memory:"},
			[]string{":memory:", ":memory:", ":memory:"},
		},
		{
			"multiple source replica, one source search replica",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{":memory:"},
		},
		{
			"multiple source replica, multiple source search replicas",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{":memory:", ":memory:", ":memory:"},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description+" with license", func(t *testing.T) {
			t.Parallel()

			settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
			settings.DataSourceReplicas = testCase.DataSourceReplicas
			settings.DataSourceSearchReplicas = testCase.DataSourceSearchReplicas
			store := New(*settings, nil)
			store.UpdateLicense(&model.License{})

			replicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				replicas[store.GetReplica()] = true
			}

			searchReplicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[store.GetSearchReplica()] = true
			}

			if len(testCase.DataSourceReplicas) > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, len(testCase.DataSourceReplicas))

				for replica := range replicas {
					assert.NotSame(t, store.GetMaster(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Same(t, store.GetMaster(), replica)
				}
			}

			if len(testCase.DataSourceSearchReplicas) > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, len(testCase.DataSourceSearchReplicas))

				for searchReplica := range searchReplicas {
					assert.NotSame(t, store.GetMaster(), searchReplica)
					for replica := range replicas {
						assert.NotSame(t, searchReplica, replica)
					}
				}
			} else if len(testCase.DataSourceReplicas) > 0 {
				assert.Equal(t, len(replicas), len(searchReplicas))
				for k := range replicas {
					assert.True(t, searchReplicas[k])
				}
			} else if len(testCase.DataSourceReplicas) == 0 && assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMaster(), searchReplica)
				}
			}
		})

		t.Run(testCase.Description+" without license", func(t *testing.T) {
			t.Parallel()

			settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
			settings.DataSourceReplicas = testCase.DataSourceReplicas
			settings.DataSourceSearchReplicas = testCase.DataSourceSearchReplicas
			store := New(*settings, nil)

			replicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				replicas[store.GetReplica()] = true
			}

			searchReplicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[store.GetSearchReplica()] = true
			}

			if len(testCase.DataSourceReplicas) > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, 1)

				for replica := range replicas {
					assert.Same(t, store.GetMaster(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Same(t, store.GetMaster(), replica)
				}
			}

			if len(testCase.DataSourceSearchReplicas) > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, 1)

				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMaster(), searchReplica)
				}

			} else if len(testCase.DataSourceReplicas) > 0 {
				assert.Equal(t, len(replicas), len(searchReplicas))
				for k := range replicas {
					assert.True(t, searchReplicas[k])
				}
			} else if assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Same(t, store.GetMaster(), searchReplica)
				}
			}
		})
	}
}

func TestGetDbVersion(t *testing.T) {
	testDrivers := []string{
		model.DATABASE_DRIVER_POSTGRES,
		model.DATABASE_DRIVER_MYSQL,
		model.DATABASE_DRIVER_SQLITE,
	}

	for _, driver := range testDrivers {
		t.Run("Should return db version for "+driver, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(driver)
			store := New(*settings, nil)

			version, err := store.GetDbVersion(false)
			require.Nil(t, err)
			require.Regexp(t, regexp.MustCompile(`\d+\.\d+(\.\d+)?`), version)
		})
	}
}

func TestGetAllConns(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		Description              string
		DataSourceReplicas       []string
		DataSourceSearchReplicas []string
		ExpectedNumConnections   int
	}{
		{
			"no replicas",
			[]string{},
			[]string{},
			1,
		},
		{
			"one source replica",
			[]string{":memory:"},
			[]string{},
			2,
		},
		{
			"multiple source replicas",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{},
			4,
		},
		{
			"one source search replica",
			[]string{},
			[]string{":memory:"},
			1,
		},
		{
			"multiple source search replicas",
			[]string{},
			[]string{":memory:", ":memory:", ":memory:"},
			1,
		},
		{
			"one source replica, one source search replica",
			[]string{":memory:"},
			[]string{":memory:"},
			2,
		},
		{
			"one source replica, multiple source search replicas",
			[]string{":memory:"},
			[]string{":memory:", ":memory:", ":memory:"},
			2,
		},
		{
			"multiple source replica, one source search replica",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{":memory:"},
			4,
		},
		{
			"multiple source replica, multiple source search replicas",
			[]string{":memory:", ":memory:", ":memory:"},
			[]string{":memory:", ":memory:", ":memory:"},
			4,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()
			settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
			settings.DataSourceReplicas = testCase.DataSourceReplicas
			settings.DataSourceSearchReplicas = testCase.DataSourceSearchReplicas
			store := New(*settings, nil)

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
		output string
	}{
		{
			input:  100000,
			output: "10.0",
		},
		{
			input:  90603,
			output: "9.603",
		},
		{
			input:  120005,
			output: "12.5",
		},
	}

	for _, v := range versions {
		out := VersionString(v.input)
		assert.Equal(t, v.output, out)
	}
}

func makeSqlSettings(driver string) *model.SqlSettings {
	switch driver {
	case model.DATABASE_DRIVER_POSTGRES:
		return storetest.MakeSqlSettings(driver)
	case model.DATABASE_DRIVER_MYSQL:
		return storetest.MakeSqlSettings(driver)
	case model.DATABASE_DRIVER_SQLITE:
		return makeSqliteSettings()
	}

	return nil
}

func makeSqliteSettings() *model.SqlSettings {
	driverName := model.DATABASE_DRIVER_SQLITE
	dataSource := ":memory:"
	maxIdleConns := 1
	connMaxLifetimeMilliseconds := 3600000
	connMaxIdleTimeMilliseconds := 300000
	maxOpenConns := 1
	queryTimeout := 5

	return &model.SqlSettings{
		DriverName:                  &driverName,
		DataSource:                  &dataSource,
		MaxIdleConns:                &maxIdleConns,
		ConnMaxLifetimeMilliseconds: &connMaxLifetimeMilliseconds,
		ConnMaxIdleTimeMilliseconds: &connMaxIdleTimeMilliseconds,
		MaxOpenConns:                &maxOpenConns,
		QueryTimeout:                &queryTimeout,
	}
}
