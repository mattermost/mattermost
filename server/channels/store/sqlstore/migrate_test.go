// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/morph/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const postgresSchemaObjectsQuery = `
SELECT pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid)
  FROM pg_catalog.pg_depend d
 WHERE d.refclassid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
   AND d.refobjid = pg_catalog.current_schema()::pg_catalog.regnamespace
   AND d.deptype = 'n'
 ORDER BY 1`

// postgresSchemaObjects returns stable descriptions of objects that belong to
// the current PostgreSQL schema. Use it to list all tables, indexes, and other
// schema objects in the database.
func postgresSchemaObjects(t *testing.T, store *SqlStore) []string {
	t.Helper()

	var objects []string
	require.NoError(t, store.GetMaster().Select(&objects, postgresSchemaObjectsQuery))
	return objects
}

func TestUpAndDownMigrations(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	t.Run("store", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}
		t.Cleanup(func() {
			storetest.CleanupSqlSettings(settings)
		})

		store, err := New(*settings, logger, nil)
		require.NoError(t, err)
		t.Cleanup(func() {
			store.Close()
		})

		err = store.migrate(migrationsDirectionDown, false, true)
		assert.NoError(t, err, "downing migrations should not error")
	})

	t.Run("manual morph application", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}
		t.Cleanup(func() {
			storetest.CleanupSqlSettings(settings)
		})

		store, err := New(*settings, logger, nil, SkipMigrations())
		require.NoError(t, err)
		t.Cleanup(func() {
			store.Close()
		})

		engine, err := store.initMorph(false, true)
		require.NoError(t, err)
		t.Cleanup(func() {
			require.NoError(t, engine.Close())
		})

		pending, err := engine.Diff(models.Up)
		require.NoError(t, err)
		require.NotEmpty(t, pending)
		initialSchema := postgresSchemaObjects(t, store)

		applied, err := engine.Apply(-1)
		require.NoError(t, err, "applying migrations should not error")
		require.Equal(t, len(pending), applied)

		rolledBack, err := engine.ApplyDown(-1)
		require.NoError(t, err, "downing migrations should not error")
		require.Equal(t, applied, rolledBack)

		var migrationCount int
		require.NoError(t, store.GetMaster().Get(&migrationCount, "SELECT COUNT(*) FROM db_migrations"))
		assert.Zero(t, migrationCount, "all migration records should be removed")
		assert.Equal(t, initialSchema, postgresSchemaObjects(t, store),
			"schema differs after rollback; a down migration may not fully reverse its corresponding up migration")
	})
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

	t.Run("runs pre-migrations and marks them complete", func(t *testing.T) {
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

		require.NoError(t, migrator.PreMigrate())

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

		require.NoError(t, migrator.PreMigrate())
		require.NoError(t, migrator.PreMigrate(), "second invocation must be a safe no-op")
	})
}
