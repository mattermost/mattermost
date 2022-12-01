// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
)

func TestUpAndDownMigrations(t *testing.T) {
	testDrivers := []string{
		model.DatabaseDriverPostgres,
		model.DatabaseDriverMysql,
	}

	for _, driver := range testDrivers {
		t.Run("Should be reversible for "+driver, func(t *testing.T) {
			settings := makeSqlSettings(driver)
			store := New(*settings, nil)
			defer store.Close()

			err := store.migrate(migrationsDirectionDown, false)
			assert.NoError(t, err, "downing migrations should not error")
		})
	}
}
