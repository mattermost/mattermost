// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestSqlX(t *testing.T) {
	t.Run("NamedQuery", func(t *testing.T) {
		testDrivers := []string{
			model.DatabaseDriverPostgres,
			model.DatabaseDriverMysql,
		}

		for _, driver := range testDrivers {
			settings, err := makeSqlSettings(driver)
			if err != nil {
				continue
			}
			*settings.QueryTimeout = 1
			store := &SqlStore{
				rrCounter:   0,
				srCounter:   0,
				settings:    settings,
				logger:      mlog.CreateConsoleTestLogger(t),
				quitMonitor: make(chan struct{}),
				wgMonitor:   &sync.WaitGroup{},
			}

			require.NoError(t, store.initConnection())

			defer store.Close()

			tx, err := store.GetMaster().Beginx()
			require.NoError(t, err)

			var query string
			if store.DriverName() == model.DatabaseDriverMysql {
				query = `SELECT SLEEP(:Timeout);`
			} else if store.DriverName() == model.DatabaseDriverPostgres {
				query = `SELECT pg_sleep(:timeout);`
			}
			arg := struct{ Timeout int }{Timeout: 2}
			_, err = tx.NamedQuery(query, arg)
			require.Equal(t, context.DeadlineExceeded, err)
			require.NoError(t, tx.Commit())
		}
	})

	t.Run("NamedParse", func(t *testing.T) {
		queries := []struct {
			in  string
			out string
		}{
			{
				in:  `SELECT pg_sleep(:Timeout)`,
				out: `SELECT pg_sleep(:timeout)`,
			},
			{
				in: `SELECT u.Username FROM Bots
			LIMIT
			    :Limit
			OFFSET
			    :Offset`,
				out: `SELECT u.Username FROM Bots
			LIMIT
			    :limit
			OFFSET
			    :offset`,
			},
			{
				in:  `UPDATE OAuthAccessData SET Token =:Token`,
				out: `UPDATE OAuthAccessData SET Token =:token`,
			},
		}
		for _, q := range queries {
			out := namedParamRegex.ReplaceAllStringFunc(q.in, strings.ToLower)
			assert.Equal(t, q.out, out)
		}
	})
}

func TestSqlxSelect(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}
	for _, driver := range testDrivers {
		t.Run(driver, func(t *testing.T) {
			settings, err := makeSqlSettings(driver)
			if err != nil {
				t.Skip(err)
			}
			*settings.QueryTimeout = 1
			store := &SqlStore{
				rrCounter:   0,
				srCounter:   0,
				settings:    settings,
				logger:      mlog.CreateConsoleTestLogger(t),
				quitMonitor: make(chan struct{}),
				wgMonitor:   &sync.WaitGroup{},
			}

			require.NoError(t, store.initConnection())
			defer store.Close()

			t.Run("SelectCtx", func(t *testing.T) {
				var result []string
				err := store.GetMaster().SelectCtx(context.Background(), &result, "SELECT 'test' AS col")
				require.NoError(t, err)
				require.Equal(t, []string{"test"}, result)

				// Test timeout
				ctx, cancel := context.WithTimeout(context.Background(), 1)
				defer cancel()
				var query string
				if driver == model.DatabaseDriverMysql {
					query = "SELECT SLEEP(2)"
				} else {
					query = "SELECT pg_sleep(2)"
				}
				err = store.GetMaster().SelectCtx(ctx, &result, query)
				require.Error(t, err)
				require.Equal(t, context.DeadlineExceeded, err)
			})

			t.Run("SelectBuilderCtx", func(t *testing.T) {
				var result []string
				builder := store.getQueryBuilder().
					Select("'test' AS col")
				err := store.GetMaster().SelectBuilderCtx(context.Background(), &result, builder)
				require.NoError(t, err)
				require.Equal(t, []string{"test"}, result)

				// Test timeout
				ctx, cancel := context.WithTimeout(context.Background(), 1)
				defer cancel()
				if driver == model.DatabaseDriverMysql {
					builder = store.getQueryBuilder().
						Select("SLEEP(2)")
				} else {
					builder = store.getQueryBuilder().
						Select("pg_sleep(2)")
				}
				err = store.GetMaster().SelectBuilderCtx(ctx, &result, builder)
				require.Error(t, err)
				require.Equal(t, context.DeadlineExceeded, err)
			})
		})
	}
}
