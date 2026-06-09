// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpAndDownMigrations(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	testDrivers := []string{
		model.DatabaseDriverPostgres,
	}

	for _, driver := range testDrivers {
		t.Run("Should be reversible for "+driver, func(t *testing.T) {
			settings, err := makeSqlSettings(driver)
			if err != nil {
				t.Skip(err)
			}

			store, err := New(*settings, logger, nil)
			require.NoError(t, err)
			defer store.Close()

			err = store.migrate(migrationsDirectionDown, false, true)
			assert.NoError(t, err, "downing migrations should not error")
		})
	}
}

// TestMigratorPreMigrate exercises the exported entry point invoked by the
// `mattermost db migrate` CLI. The handler exists so cloud upgrades, which
// bypass sqlstore.New(), still apply the pre-migration fixes that ship with
// each release.
func TestMigratorPreMigrate(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	logger := mlog.CreateConsoleTestLogger(t)
	const markerName = "renumber_roles_schemeid_migrations"

	t.Run("dry-run does not write the completion marker", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}

		// New() runs preMigration() during startup; clear the marker afterwards
		// so we can observe whether PreMigrate(true) writes it.
		store, err := New(*settings, logger, nil)
		require.NoError(t, err)
		defer store.Close()
		_, err = store.GetMaster().Exec("DELETE FROM Systems WHERE Name = $1", markerName)
		require.NoError(t, err)

		migrator, err := NewMigrator(*settings, logger, true)
		require.NoError(t, err)
		defer migrator.Close()

		require.NoError(t, migrator.PreMigrate(true))

		done, err := store.isPreMigrationComplete(markerName)
		require.NoError(t, err)
		assert.False(t, done, "dry-run must not run pre-migrations or set the marker")
	})

	t.Run("non-dry-run runs pre-migrations and marks them complete", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}

		store, err := New(*settings, logger, nil)
		require.NoError(t, err)
		defer store.Close()
		_, err = store.GetMaster().Exec("DELETE FROM Systems WHERE Name = $1", markerName)
		require.NoError(t, err)

		migrator, err := NewMigrator(*settings, logger, false)
		require.NoError(t, err)
		defer migrator.Close()

		require.NoError(t, migrator.PreMigrate(false))

		done, err := store.isPreMigrationComplete(markerName)
		require.NoError(t, err)
		assert.True(t, done, "PreMigrate should set the completion marker on a non-dry-run")
	})

	t.Run("idempotent across repeated calls", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}

		store, err := New(*settings, logger, nil)
		require.NoError(t, err)
		defer store.Close()

		migrator, err := NewMigrator(*settings, logger, false)
		require.NoError(t, err)
		defer migrator.Close()

		require.NoError(t, migrator.PreMigrate(false))
		require.NoError(t, migrator.PreMigrate(false), "second invocation must be a safe no-op")
	})
}
