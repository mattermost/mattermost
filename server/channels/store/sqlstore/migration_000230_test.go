// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func healthFindingsTableExists(t *testing.T, store *SqlStore, tableName string) bool {
	t.Helper()

	var exists bool
	err := store.GetMaster().Get(&exists, "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1)", tableName)
	require.NoError(t, err)
	return exists
}

func healthFindingsIndexExists(t *testing.T, store *SqlStore, indexName string) bool {
	t.Helper()

	var exists bool
	err := store.GetMaster().Get(&exists, "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = $1)", indexName)
	require.NoError(t, err)
	return exists
}

func newHealthFindingsMigrationStore(t *testing.T) *SqlStore {
	t.Helper()

	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	t.Cleanup(func() { store.Close() })

	return store
}

func TestMigration000230(t *testing.T) {
	store := newHealthFindingsMigrationStore(t)

	require.True(t, healthFindingsTableExists(t, store, "healthfindings"))

	_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000230_create_health_findings.down.sql"))
	require.NoError(t, err)
	assert.False(t, healthFindingsTableExists(t, store, "healthfindings"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000230_create_health_findings.up.sql"))
	require.NoError(t, err)
	assert.True(t, healthFindingsTableExists(t, store, "healthfindings"))
}

func TestMigration000231(t *testing.T) {
	store := newHealthFindingsMigrationStore(t)

	require.True(t, healthFindingsIndexExists(t, store, "idx_healthfindings_lastseenat"))

	// CONCURRENTLY cannot run inside a transaction; ExecNoTimeout runs unwrapped.
	_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000231_create_healthfindings_lastseenat_index.down.sql"))
	require.NoError(t, err)
	assert.False(t, healthFindingsIndexExists(t, store, "idx_healthfindings_lastseenat"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000231_create_healthfindings_lastseenat_index.up.sql"))
	require.NoError(t, err)
	assert.True(t, healthFindingsIndexExists(t, store, "idx_healthfindings_lastseenat"))

	// IF NOT EXISTS makes a second up a safe no-op.
	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000231_create_healthfindings_lastseenat_index.up.sql"))
	require.NoError(t, err)
	assert.True(t, healthFindingsIndexExists(t, store, "idx_healthfindings_lastseenat"))
}
