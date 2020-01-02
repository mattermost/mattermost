// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore_test

import (
	"testing"

	"github.com/mattermost/gorp"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

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
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			driverName := model.DATABASE_DRIVER_SQLITE
			dataSource := ":memory:"
			maxIdleConns := 1
			connMaxLifetimeMilliseconds := 3600000
			maxOpenConns := 1
			queryTimeout := 5

			settings := model.SqlSettings{
				DriverName:                  &driverName,
				DataSource:                  &dataSource,
				MaxIdleConns:                &maxIdleConns,
				ConnMaxLifetimeMilliseconds: &connMaxLifetimeMilliseconds,
				MaxOpenConns:                &maxOpenConns,
				QueryTimeout:                &queryTimeout,
				DataSourceReplicas:          testCase.DataSourceReplicas,
				DataSourceSearchReplicas:    testCase.DataSourceSearchReplicas,
			}
			supplier := sqlstore.NewSqlSupplier(settings, nil)

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

			driverName := model.DATABASE_DRIVER_SQLITE
			dataSource := ":memory:"
			maxIdleConns := 1
			connMaxLifetimeMilliseconds := 3600000
			maxOpenConns := 1
			queryTimeout := 5

			settings := model.SqlSettings{
				DriverName:                  &driverName,
				DataSource:                  &dataSource,
				MaxIdleConns:                &maxIdleConns,
				ConnMaxLifetimeMilliseconds: &connMaxLifetimeMilliseconds,
				MaxOpenConns:                &maxOpenConns,
				QueryTimeout:                &queryTimeout,
				DataSourceReplicas:          testCase.DataSourceReplicas,
				DataSourceSearchReplicas:    testCase.DataSourceSearchReplicas,
			}
			supplier := sqlstore.NewSqlSupplier(settings, nil)

			assert.Len(t, supplier.GetAllConns(), testCase.ExpectedNumConnections)
		})
	}
}
