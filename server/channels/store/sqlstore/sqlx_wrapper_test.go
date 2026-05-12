// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql/driver"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// requireQueryTimeout asserts that err represents a query-timeout cancellation.
// Three error shapes are possible depending on timing in the pq driver:
//   - context.DeadlineExceeded — context fires before the query reaches the server.
//   - pq.Error{Code:"57014"} — PostgreSQL cancels the in-flight query and returns
//     "canceling statement due to user request" on the original connection.
//   - driver.ErrBadConn — pq's watchCancel goroutine sets cn.err on the client side
//     before the query loop reads the server's 57014 response; pq short-circuits and
//     returns this sentinel rather than the server error.
func requireQueryTimeout(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var pqErr *pq.Error
	switch {
	case errors.As(err, &pqErr):
		require.Equal(t, pq.ErrorCode("57014"), pqErr.Code)
	case errors.Is(err, driver.ErrBadConn):
		// client-side short-circuit; see comment above
	default:
		require.ErrorIs(t, err, context.DeadlineExceeded)
	}
}

func TestSqlX(t *testing.T) {
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

func makeStoreWithTimeout(t *testing.T, driver string, queryTimeout time.Duration) *SqlStore {
	t.Helper()
	settings, err := makeSqlSettings(driver)
	if err != nil {
		t.Skip(err)
	}
	*settings.QueryTimeout = int(queryTimeout.Seconds())
	store := &SqlStore{
		settings:    settings,
		logger:      mlog.CreateConsoleTestLogger(t),
		quitMonitor: make(chan struct{}),
		wgMonitor:   &sync.WaitGroup{},
	}
	require.NoError(t, store.initConnection())
	t.Cleanup(store.Close)
	return store
}

func TestSqlxQuery(t *testing.T) {
	store := makeStoreWithTimeout(t, model.DatabaseDriverPostgres, 1*time.Second)

	t.Run("db/happy", func(t *testing.T) {
		rows, err := store.GetMaster().Query("SELECT 1")
		require.NoError(t, err)
		defer rows.Close()
		require.True(t, rows.Next())
		var v int
		require.NoError(t, rows.Scan(&v))
		require.Equal(t, 1, v)
	})

	t.Run("db/timeout", func(t *testing.T) {
		_, err := store.GetMaster().Query("SELECT pg_sleep(2)")
		requireQueryTimeout(t, err)
	})

	t.Run("tx/happy", func(t *testing.T) {
		tx, err := store.GetMaster().Begin()
		require.NoError(t, err)
		defer func() { assert.NoError(t, tx.Rollback()) }()
		rows, err := tx.Query("SELECT 1")
		require.NoError(t, err)
		defer rows.Close()
		require.True(t, rows.Next())
		var v int
		require.NoError(t, rows.Scan(&v))
		require.Equal(t, 1, v)
	})

	t.Run("tx/timeout", func(t *testing.T) {
		tx, err := store.GetMaster().Begin()
		require.NoError(t, err)
		_, err = tx.Query("SELECT pg_sleep(2)")
		require.Error(t, tx.Rollback()) // connection is dead after timeout
		requireQueryTimeout(t, err)
	})
}

func TestSqlxQueryRow(t *testing.T) {
	store := makeStoreWithTimeout(t, model.DatabaseDriverPostgres, 1*time.Second)

	t.Run("db/happy", func(t *testing.T) {
		var v int
		require.NoError(t, store.GetMaster().QueryRow("SELECT 1").Scan(&v))
		require.Equal(t, 1, v)
	})

	t.Run("db/timeout", func(t *testing.T) {
		var v int
		err := store.GetMaster().QueryRow("SELECT 1 FROM (SELECT pg_sleep(2)) s").Scan(&v)
		requireQueryTimeout(t, err)
	})

	t.Run("tx/happy", func(t *testing.T) {
		tx, err := store.GetMaster().Begin()
		require.NoError(t, err)
		defer func() { assert.NoError(t, tx.Rollback()) }()
		var v int
		require.NoError(t, tx.QueryRow("SELECT 1").Scan(&v))
		require.Equal(t, 1, v)
	})

	t.Run("tx/timeout", func(t *testing.T) {
		tx, err := store.GetMaster().Begin()
		require.NoError(t, err)
		var v int
		err = tx.QueryRow("SELECT 1 FROM (SELECT pg_sleep(2)) s").Scan(&v)
		require.Error(t, tx.Rollback()) // connection is dead after timeout
		requireQueryTimeout(t, err)
	})
}

func TestSqlxSelect(t *testing.T) {
	store := makeStoreWithTimeout(t, model.DatabaseDriverPostgres, 1*time.Second)

	t.Run("SelectCtx", func(t *testing.T) {
		var result []string
		err := store.GetMaster().SelectContext(context.Background(), &result, "SELECT 'test' AS col")
		require.NoError(t, err)
		require.Equal(t, []string{"test"}, result)

		// Test timeout
		ctx, cancel := context.WithTimeout(context.Background(), 1)
		defer cancel()
		query := "SELECT pg_sleep(2)"
		err = store.GetMaster().SelectContext(ctx, &result, query)
		requireQueryTimeout(t, err)
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
		builder = store.getQueryBuilder().
			Select("pg_sleep(2)")
		err = store.GetMaster().SelectBuilderCtx(ctx, &result, builder)
		requireQueryTimeout(t, err)
	})
}
