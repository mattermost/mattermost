// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"io"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	plugindriver "github.com/mattermost/mattermost/server/public/shared/driver"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestConnCreateTimeout(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	*th.App.Config().SqlSettings.QueryTimeout = 0

	d := NewDriverImpl(th.Server)
	_, err := d.Conn(true)
	require.Error(t, err)
}

func TestShutdownPluginConns(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	d := NewDriverImpl(th.Server)
	_, err := d.ConnWithPluginID(true, "plugin1")
	require.NoError(t, err)
	_, err = d.ConnWithPluginID(true, "plugin2")
	require.NoError(t, err)
	_, err = d.ConnWithPluginID(true, "plugin1")
	require.NoError(t, err)

	require.Len(t, d.connMap, 3)
	d.ShutdownConns("plugin1")
	require.Len(t, d.connMap, 1)
	d.ShutdownConns("plugin2")
	require.Len(t, d.connMap, 0)
}

func TestPluginDriverQueryTimeout(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SqlSettings.QueryTimeout = 1
	})

	const sleep = "SELECT pg_sleep(5)"
	const maxElapsed = 4 * time.Second

	// openPluginDB returns a *sql.DB as a plugin sees it: the plugin-side driver
	// on top of DriverImpl, minus the RPC hop. A single connection forces the
	// follow-up query onto the connection whose query timed out.
	openPluginDB := func(t *testing.T) (*DriverImpl, *sql.DB) {
		t.Helper()
		d := NewDriverImpl(th.Server)
		db := sql.OpenDB(plugindriver.NewConnector(d, true))
		db.SetMaxOpenConns(1)
		t.Cleanup(func() { require.NoError(t, db.Close()) })
		return d, db
	}

	cases := map[string]func(t *testing.T, db *sql.DB) error{
		"Query": func(t *testing.T, db *sql.DB) error {
			rows, err := db.Query(sleep)
			if err == nil {
				require.NoError(t, rows.Close())
			}
			return err
		},
		"Exec": func(t *testing.T, db *sql.DB) error {
			_, err := db.Exec(sleep)
			return err
		},
		"prepared Query": func(t *testing.T, db *sql.DB) error {
			stmt, err := db.Prepare(sleep)
			require.NoError(t, err)
			defer stmt.Close()
			rows, err := stmt.Query()
			if err == nil {
				require.NoError(t, rows.Close())
			}
			return err
		},
		"prepared Exec": func(t *testing.T, db *sql.DB) error {
			stmt, err := db.Prepare(sleep)
			require.NoError(t, err)
			defer stmt.Close()
			_, err = stmt.Exec()
			return err
		},
		"Exec in transaction": func(t *testing.T, db *sql.DB) error {
			tx, err := db.Begin()
			require.NoError(t, err)
			defer func() { _ = tx.Rollback() }()
			_, err = tx.Exec(sleep)
			return err
		},
	}

	for name, run := range cases {
		t.Run(name, func(t *testing.T) {
			_, db := openPluginDB(t)

			start := time.Now()
			err := run(t, db)
			require.Error(t, err)
			assert.Less(t, time.Since(start), maxElapsed)

			var one int
			require.NoError(t, db.QueryRow("SELECT 1").Scan(&one), "plugin should recover a usable connection after a timed out query")
			assert.Equal(t, 1, one)
		})
	}

	t.Run("rows read within the timeout", func(t *testing.T) {
		d, db := openPluginDB(t)

		rows, err := db.Query("SELECT generate_series(1, 3)")
		require.NoError(t, err)
		var got []int
		for rows.Next() {
			var n int
			require.NoError(t, rows.Scan(&n))
			got = append(got, n)
		}
		require.NoError(t, rows.Err())
		require.NoError(t, rows.Close())

		assert.Equal(t, []int{1, 2, 3}, got)
		assert.Empty(t, d.rowsMap)
	})

	t.Run("result set read past the timeout is cut off", func(t *testing.T) {
		_, db := openPluginDB(t)

		rows, err := db.Query("SELECT generate_series(1, 3)")
		require.NoError(t, err)
		defer rows.Close()
		require.True(t, rows.Next())

		time.Sleep(1500 * time.Millisecond)
		for rows.Next() {
		}
		require.Error(t, rows.Err())
	})

	t.Run("transaction outlives the timeout", func(t *testing.T) {
		_, db := openPluginDB(t)

		tx, err := db.Begin()
		require.NoError(t, err)
		_, err = tx.Exec("SELECT 1")
		require.NoError(t, err)
		time.Sleep(1500 * time.Millisecond)
		_, err = tx.Exec("SELECT 1")
		require.NoError(t, err)
		require.NoError(t, tx.Commit())
	})

	t.Run("timeout is logged with the plugin id", func(t *testing.T) {
		d := NewDriverImpl(th.Server)
		connID, err := d.ConnWithPluginID(true, "slow-plugin")
		require.NoError(t, err)
		t.Cleanup(func() { d.ShutdownConns("slow-plugin") })

		_, err = d.ConnExec(connID, sleep, nil)
		require.Error(t, err)

		require.NoError(t, th.TestLogger.Flush())
		var pluginIDs []string
		dec := json.NewDecoder(th.LogBuffer)
		for {
			var entry struct {
				Level    string `json:"level"`
				Msg      string `json:"msg"`
				PluginID string `json:"plugin_id"`
			}
			if err := dec.Decode(&entry); err == io.EOF {
				break
			} else {
				require.NoError(t, err)
			}
			if entry.Level == mlog.LvlWarn.Name && entry.Msg == "Plugin database operation exceeded the query timeout and was cancelled" {
				pluginIDs = append(pluginIDs, entry.PluginID)
			}
		}
		assert.Contains(t, pluginIDs, "slow-plugin")
	})

	t.Run("no connections leak", func(t *testing.T) {
		d := NewDriverImpl(th.Server)
		db := sql.OpenDB(plugindriver.NewConnector(d, true))
		_, err := db.Exec(sleep)
		require.Error(t, err)
		require.NoError(t, db.Close())
		assert.Empty(t, d.connMap)
	})
}

func TestShutdownPluginConnsReleasesObjects(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	d := NewDriverImpl(th.Server)
	connID, err := d.ConnWithPluginID(true, "plugin1")
	require.NoError(t, err)
	otherConnID, err := d.ConnWithPluginID(true, "plugin2")
	require.NoError(t, err)
	t.Cleanup(func() { d.ShutdownConns("plugin2") })

	txID, err := d.Tx(connID, driver.TxOptions{})
	require.NoError(t, err)
	_, err = d.Stmt(connID, "SELECT 1")
	require.NoError(t, err)
	_, err = d.ConnQuery(connID, "SELECT 1", nil)
	require.NoError(t, err)
	_, err = d.ConnQuery(otherConnID, "SELECT 1", nil)
	require.NoError(t, err)

	d.ShutdownConns("plugin1")

	assert.Len(t, d.connMap, 1)
	assert.Empty(t, d.txMap)
	assert.Empty(t, d.stMap)
	assert.Len(t, d.rowsMap, 1)
	assert.ErrorIs(t, d.TxCommit(txID), driver.ErrBadConn)
}

func TestPluginDriverConnRelease(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.SqlSettings.QueryTimeout = 10
	})

	// Streams one wide row (larger than Postgres's send buffer, so it is flushed
	// immediately) every 100ms for 10s, so closing it early has rows left to drain.
	const streaming = "SELECT repeat('x', 16384), pg_sleep(0.1) FROM generate_series(1, 100)"

	t.Run("ShutdownConns does not wait on open result sets or block other plugins", func(t *testing.T) {
		d := NewDriverImpl(th.Server)
		connID, err := d.ConnWithPluginID(true, "plugin1")
		require.NoError(t, err)
		otherConnID, err := d.ConnWithPluginID(true, "plugin2")
		require.NoError(t, err)
		t.Cleanup(func() { d.ShutdownConns("plugin2") })

		start := time.Now()
		_, err = d.ConnQuery(connID, streaming, nil)
		require.NoError(t, err)
		require.Less(t, time.Since(start), time.Second, "query should start streaming immediately")

		done := make(chan time.Duration)
		go func() {
			start := time.Now()
			d.ShutdownConns("plugin1")
			done <- time.Since(start)
		}()

		start = time.Now()
		require.NoError(t, d.ConnPing(otherConnID))
		assert.Less(t, time.Since(start), 2*time.Second)
		assert.Less(t, <-done, 5*time.Second)
		assert.Empty(t, d.rowsMap)
	})

	t.Run("ConnClose releases objects left open on the connection", func(t *testing.T) {
		d := NewDriverImpl(th.Server)
		connID, err := d.ConnWithPluginID(true, "plugin")
		require.NoError(t, err)

		_, err = d.Tx(connID, driver.TxOptions{})
		require.NoError(t, err)
		_, err = d.Stmt(connID, "SELECT 1")
		require.NoError(t, err)
		_, err = d.ConnQuery(connID, streaming, nil)
		require.NoError(t, err)

		start := time.Now()
		require.NoError(t, d.ConnClose(connID))
		assert.Less(t, time.Since(start), 5*time.Second)
		assert.Empty(t, d.connMap)
		assert.Empty(t, d.rowsMap)
		assert.Empty(t, d.stMap)
		assert.Empty(t, d.txMap)
	})
}

func TestPluginDriverUnknownIDs(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	d := NewDriverImpl(th.Server)

	const id = "unknown"
	assert.ErrorIs(t, d.ConnPing(id), driver.ErrBadConn)
	assert.ErrorIs(t, d.ConnClose(id), driver.ErrBadConn)
	assert.ErrorIs(t, d.TxCommit(id), driver.ErrBadConn)
	assert.ErrorIs(t, d.TxRollback(id), driver.ErrBadConn)
	assert.ErrorIs(t, d.StmtClose(id), driver.ErrBadConn)
	assert.Equal(t, -1, d.StmtNumInput(id))
	_, err := d.StmtQuery(id, nil)
	assert.ErrorIs(t, err, driver.ErrBadConn)
	_, err = d.StmtExec(id, nil)
	assert.ErrorIs(t, err, driver.ErrBadConn)
	assert.Nil(t, d.RowsColumns(id))
	assert.ErrorIs(t, d.RowsClose(id), driver.ErrBadConn)
	assert.ErrorIs(t, d.RowsNext(id, nil), driver.ErrBadConn)
	assert.False(t, d.RowsHasNextResultSet(id))
	assert.ErrorIs(t, d.RowsNextResultSet(id), driver.ErrBadConn)
	assert.Empty(t, d.RowsColumnTypeDatabaseTypeName(id, 0))
	_, _, ok := d.RowsColumnTypePrecisionScale(id, 0)
	assert.False(t, ok)
}
