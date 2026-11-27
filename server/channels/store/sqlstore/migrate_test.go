// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"cmp"
	"encoding/json"
	"fmt"
	"slices"
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

func TestMigrateWithPlanVerification(t *testing.T) {
	if enableFullyParallelTests {
		t.Parallel()
	}

	logger := mlog.CreateConsoleTestLogger(t)
	const markerTable = "plan_verification_marker"
	markerSQL := []byte("CREATE TABLE " + markerTable + " (id int);")

	setup := func(t *testing.T) (*SqlStore, *Migrator, *models.Plan) {
		t.Helper()
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}
		t.Cleanup(func() { storetest.CleanupSqlSettings(settings) })

		store, err := New(*settings, logger, nil)
		require.NoError(t, err)
		t.Cleanup(store.Close)

		migrator, err := NewMigrator(*settings, logger, false)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, migrator.Close()) })

		down, err := migrator.engine.Diff(models.Down)
		require.NoError(t, err)
		latest := slices.MaxFunc(down, func(a, b *models.Migration) int { return cmp.Compare(a.Version, b.Version) })

		plan, err := migrator.engine.GeneratePlan([]*models.Migration{latest}, false)
		require.NoError(t, err)
		require.Len(t, plan.Migrations, 1)
		require.Len(t, plan.RevertMigrations, 1)

		return store, migrator, plan
	}

	schemaVersion := func(t *testing.T, store *SqlStore) int {
		t.Helper()
		version, err := store.GetDBSchemaVersion()
		require.NoError(t, err)
		return version
	}

	markerExists := func(t *testing.T, store *SqlStore) bool {
		t.Helper()
		exists, err := store.tableExists(markerTable)
		require.NoError(t, err)
		return exists
	}

	requireRejected := func(t *testing.T, store *SqlStore, migrator *Migrator, plan *models.Plan) {
		t.Helper()
		before := schemaVersion(t, store)
		err := migrator.MigrateWithPlan(plan, false)
		require.ErrorIs(t, err, ErrUntrustedMigrationPlan)
		assert.False(t, markerExists(t, store), "no SQL from a rejected plan may run")
		assert.Equal(t, before, schemaVersion(t, store), "a rejected plan must not change the schema")
	}

	t.Run("applies a saved down plan built from the embedded migrations", func(t *testing.T) {
		store, migrator, plan := setup(t)
		before := schemaVersion(t, store)

		saved, err := json.Marshal(plan)
		require.NoError(t, err)
		var loaded models.Plan
		require.NoError(t, json.Unmarshal(saved, &loaded))

		require.NoError(t, migrator.MigrateWithPlan(&loaded, false))
		assert.Less(t, schemaVersion(t, store), before)
	})

	t.Run("applies a generated up plan", func(t *testing.T) {
		settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
		if err != nil {
			t.Skip(err)
		}
		t.Cleanup(func() { storetest.CleanupSqlSettings(settings) })

		store, err := New(*settings, logger, nil, SkipMigrations())
		require.NoError(t, err)
		t.Cleanup(store.Close)

		migrator, err := NewMigrator(*settings, logger, false)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, migrator.Close()) })

		plan, err := migrator.GeneratePlan(true)
		require.NoError(t, err)
		require.NotEmpty(t, plan.Migrations)
		require.NotEmpty(t, plan.RevertMigrations)

		require.NoError(t, migrator.MigrateWithPlan(plan, false))
		assert.Equal(t, int(plan.Migrations[len(plan.Migrations)-1].Version), schemaVersion(t, store))
	})

	t.Run("rejects an embedded migration whose fields were changed", func(t *testing.T) {
		for name, tamper := range map[string]func(m *models.Migration){
			"body":      func(m *models.Migration) { m.Bytes = markerSQL },
			"version":   func(m *models.Migration) { m.Version-- },
			"name":      func(m *models.Migration) { m.Name += "_other" },
			"direction": func(m *models.Migration) { m.Direction = models.Up },
		} {
			t.Run(name, func(t *testing.T) {
				store, migrator, plan := setup(t)
				tamper(plan.Migrations[0])
				requireRejected(t, store, migrator, plan)
			})
		}
	})

	t.Run("rejects a tampered revert migration", func(t *testing.T) {
		store, migrator, plan := setup(t)
		plan.RevertMigrations[0].Bytes = markerSQL
		requireRejected(t, store, migrator, plan)
	})

	t.Run("rejects an empty migration entry", func(t *testing.T) {
		store, migrator, plan := setup(t)
		plan.RevertMigrations = append(plan.RevertMigrations, nil)
		requireRejected(t, store, migrator, plan)
	})

	unknownMigration := func(version uint32, name string) *models.Migration {
		return &models.Migration{
			Bytes:     markerSQL,
			Name:      name,
			RawName:   fmt.Sprintf("%06d_%s.down.sql", version, name),
			Version:   version,
			Direction: models.Down,
		}
	}

	t.Run("rejects an applied migration under a file name that is not embedded", func(t *testing.T) {
		store, migrator, plan := setup(t)
		renamed := unknownMigration(plan.Migrations[0].Version, plan.Migrations[0].Name)
		renamed.RawName = "renamed_" + plan.Migrations[0].RawName

		plan.Migrations = []*models.Migration{renamed}
		requireRejected(t, store, migrator, plan)
	})

	t.Run("rejects a newer unknown migration that is not applied", func(t *testing.T) {
		store, migrator, plan := setup(t)
		plan.Migrations = []*models.Migration{unknownMigration(plan.Migrations[0].Version+1, "future")}
		plan.RevertMigrations = nil
		requireRejected(t, store, migrator, plan)
	})

	t.Run("applies a newer applied migration unknown to this binary", func(t *testing.T) {
		store, migrator, plan := setup(t)
		latestEmbedded := schemaVersion(t, store)
		future := unknownMigration(uint32(latestEmbedded)+1, "future")
		_, err := store.GetMaster().Exec("INSERT INTO db_migrations (Version, Name) VALUES ($1, $2)", future.Version, future.Name)
		require.NoError(t, err)

		plan.Migrations = []*models.Migration{future}
		plan.RevertMigrations = nil
		require.NoError(t, migrator.MigrateWithPlan(plan, false))
		assert.True(t, markerExists(t, store))
		assert.Equal(t, latestEmbedded, schemaVersion(t, store))
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
