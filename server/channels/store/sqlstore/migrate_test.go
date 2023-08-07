// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpAndDownMigrations(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	for _, driver := range testDrivers {
		t.Run("Should be reversible for "+driver, func(t *testing.T) {
			settings, err := makeSqlSettings(driver)
			if err != nil {
				t.Skip(err)
			}

			store, err := New(*settings, nil)
			require.NoError(t, err)
			defer store.Close()

			err = store.migrate(migrationsDirectionDown, false)
			assert.NoError(t, err, "downing migrations should not error")
		})
	}
}
