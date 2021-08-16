// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestSqlX(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	for _, driver := range testDrivers {
		settings := makeSqlSettings(driver)
		*settings.QueryTimeout = 1
		store := &SqlStore{
			rrCounter: 0,
			srCounter: 0,
			settings:  settings,
		}

		store.initConnection()

		defer store.Close()

		tx, err := store.GetMasterX().Beginx()
		require.NoError(t, err)

		var query string
		if store.DriverName() == model.DatabaseDriverMysql {
			query = `SELECT SLEEP(:Timeout);`
		} else if store.DriverName() == model.DatabaseDriverPostgres {
			query = `SELECT pg_sleep(:timeout);`
		}
		arg := struct{ Timeout int }{Timeout: 2}
		_, err = tx.NamedQuery(query, arg)
		require.True(t, err == context.DeadlineExceeded)
		require.NoError(t, tx.Commit())
	}
}
