// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore_test

import (
	"fmt"
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
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

// This test was used to consistently reproduce the race
// before the fix in MM-28397.
// Keeping it here to help avoiding future regressions.
func TestSupplierLicenseRace(t *testing.T) {
	settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
	settings.DataSourceReplicas = []string{":memory:"}
	settings.DataSourceSearchReplicas = []string{":memory:"}
	supplier := sqlstore.NewSqlSupplier(*settings, nil)

	wg := sync.WaitGroup{}
	wg.Add(3)

	go func() {
		supplier.UpdateLicense(&model.License{})
		wg.Done()
	}()

	go func() {
		supplier.GetReplica()
		wg.Done()
	}()

	go func() {
		supplier.GetSearchReplica()
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
			supplier := sqlstore.NewSqlSupplier(*settings, nil)
			supplier.UpdateLicense(&model.License{})

			replicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				replicas[supplier.GetReplica()] = true
			}

			searchReplicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[supplier.GetSearchReplica()] = true
			}

			if len(testCase.DataSourceReplicas) > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, len(testCase.DataSourceReplicas))

				for replica := range replicas {
					assert.NotEqual(t, supplier.GetMaster(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Equal(t, supplier.GetMaster(), replica)
				}
			}

			if len(testCase.DataSourceSearchReplicas) > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, len(testCase.DataSourceSearchReplicas))

				for searchReplica := range searchReplicas {
					assert.NotEqual(t, supplier.GetMaster(), searchReplica)
					for replica := range replicas {
						assert.NotEqual(t, searchReplica, replica)
					}
				}

			} else if len(testCase.DataSourceReplicas) > 0 {
				// If no search replicas were defined, but replicas were, ensure they are equal.
				assert.Equal(t, replicas, searchReplicas)

			} else if assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Equal(t, supplier.GetMaster(), searchReplica)
				}
			}
		})

		t.Run(testCase.Description+" without license", func(t *testing.T) {
			t.Parallel()

			settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
			settings.DataSourceReplicas = testCase.DataSourceReplicas
			settings.DataSourceSearchReplicas = testCase.DataSourceSearchReplicas
			supplier := sqlstore.NewSqlSupplier(*settings, nil)

			replicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				replicas[supplier.GetReplica()] = true
			}

			searchReplicas := make(map[*gorp.DbMap]bool)
			for i := 0; i < 5; i++ {
				searchReplicas[supplier.GetSearchReplica()] = true
			}

			if len(testCase.DataSourceReplicas) > 0 {
				// If replicas were defined, ensure none are the master.
				assert.Len(t, replicas, 1)

				for replica := range replicas {
					assert.Same(t, supplier.GetMaster(), replica)
				}

			} else if assert.Len(t, replicas, 1) {
				// Otherwise ensure the replicas contains only the master.
				for replica := range replicas {
					assert.Equal(t, supplier.GetMaster(), replica)
				}
			}

			if len(testCase.DataSourceSearchReplicas) > 0 {
				// If search replicas were defined, ensure none are the master nor the replicas.
				assert.Len(t, searchReplicas, 1)

				for searchReplica := range searchReplicas {
					assert.Same(t, supplier.GetMaster(), searchReplica)
				}

			} else if len(testCase.DataSourceReplicas) > 0 {
				// If no search replicas were defined, but replicas were, ensure they are equal.
				assert.Equal(t, replicas, searchReplicas)

			} else if assert.Len(t, searchReplicas, 1) {
				// Otherwise ensure the search replicas contains the master.
				for searchReplica := range searchReplicas {
					assert.Equal(t, supplier.GetMaster(), searchReplica)
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
			supplier := sqlstore.NewSqlSupplier(*settings, nil)

			version, err := supplier.GetDbVersion()
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
			supplier := sqlstore.NewSqlSupplier(*settings, nil)

			assert.Len(t, supplier.GetAllConns(), testCase.ExpectedNumConnections)
		})
	}
}

func TestGetColumnInfo(t *testing.T) {
	t.Run("Should return column info for mysql", func(t *testing.T) {
		settings := makeSqlSettings(model.DATABASE_DRIVER_MYSQL)
		supplier := sqlstore.NewSqlSupplier(*settings, nil)

		info, err := supplier.GetColumnInfo("Systems", "Name")
		require.NoError(t, err)
		require.Equal(t, info.DataType, "varchar")
		require.Equal(t, info.CharMaximumLength, 64)
	})
	t.Run("Should return column info for postgresql", func(t *testing.T) {
		settings := makeSqlSettings(model.DATABASE_DRIVER_POSTGRES)
		supplier := sqlstore.NewSqlSupplier(*settings, nil)

		info, err := supplier.GetColumnInfo("Systems", "Name")
		require.NoError(t, err)
		require.Equal(t, info.DataType, "character varying")
		require.Equal(t, info.CharMaximumLength, 64)
	})
	t.Run("Should return error if the column/table doesn't exists", func(t *testing.T) {
		settings := makeSqlSettings(model.DATABASE_DRIVER_POSTGRES)
		supplier := sqlstore.NewSqlSupplier(*settings, nil)

		_, err := supplier.GetColumnInfo("Unknown", "Type")
		require.Error(t, err)
		require.Contains(t, err.Error(), "no rows in result set")
	})
	t.Run("Should return error for other drivers", func(t *testing.T) {
		settings := makeSqlSettings(model.DATABASE_DRIVER_SQLITE)
		supplier := sqlstore.NewSqlSupplier(*settings, nil)

		_, err := supplier.GetColumnInfo("Systems", "Type")
		require.Error(t, err)
	})
}

func TestIsDuplicate(t *testing.T) {
	testErrors := map[error]bool{
		&pq.Error{Code: "42P06"}:                                       false,
		&pq.Error{Code: sqlstore.PG_DUP_TABLE_ERROR_CODE}:              true,
		&mysql.MySQLError{Number: uint16(1000)}:                        false,
		&mysql.MySQLError{Number: sqlstore.MYSQL_DUP_TABLE_ERROR_CODE}: true,
		errors.New("Random error"):                                     false,
	}

	for err, expected := range testErrors {
		t.Run(fmt.Sprintf("Should return %t for %s", expected, err.Error()), func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, expected, sqlstore.IsDuplicate(err))
		})
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
	maxOpenConns := 1
	queryTimeout := 5

	return &model.SqlSettings{
		DriverName:                  &driverName,
		DataSource:                  &dataSource,
		MaxIdleConns:                &maxIdleConns,
		ConnMaxLifetimeMilliseconds: &connMaxLifetimeMilliseconds,
		MaxOpenConns:                &maxOpenConns,
		QueryTimeout:                &queryTimeout,
	}
}
