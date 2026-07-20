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

func TestMigration000194(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000194_add_type_id_index_to_access_control_policies.up.sql")
	downSQL := readMigrationSQL(t, "000194_add_type_id_index_to_access_control_policies.down.sql")

	indexExists := func() bool {
		var exists bool
		require.NoError(t, master.Get(&exists, "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_access_control_policies_type_id')"))
		return exists
	}

	// CONCURRENTLY cannot run inside a transaction; ExecNoTimeout runs unwrapped.
	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should succeed")
	assert.True(t, indexExists(), "index should exist after up migration")

	// IF NOT EXISTS makes a second up a safe no-op.
	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should be idempotent")
	assert.True(t, indexExists())

	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")
	assert.False(t, indexExists(), "index should be gone after down migration")

	// IF EXISTS makes a second down a safe no-op.
	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should be idempotent")
}
