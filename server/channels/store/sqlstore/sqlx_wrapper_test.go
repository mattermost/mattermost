// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestSqlX(t *testing.T) {
	t.Run("NamedQuery", func(t *testing.T) {
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
