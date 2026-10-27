// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigration000236(t *testing.T) {
	store := newMigrationTestStore(t)

	require.True(t, migrationTableExists(t, store, "boteventsubscriptions"))

	_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000236_create_bot_event_subscriptions.down.sql"))
	require.NoError(t, err)
	assert.False(t, migrationTableExists(t, store, "boteventsubscriptions"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000236_create_bot_event_subscriptions.up.sql"))
	require.NoError(t, err)
	assert.True(t, migrationTableExists(t, store, "boteventsubscriptions"))

	// IF NOT EXISTS makes a second up a safe no-op.
	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000236_create_bot_event_subscriptions.up.sql"))
	require.NoError(t, err)
}

func TestMigration000237(t *testing.T) {
	store := newMigrationTestStore(t)

	require.True(t, migrationTableExists(t, store, "botevents"))

	_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000237_create_bot_events.down.sql"))
	require.NoError(t, err)
	assert.False(t, migrationTableExists(t, store, "botevents"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000237_create_bot_events.up.sql"))
	require.NoError(t, err)
	assert.True(t, migrationTableExists(t, store, "botevents"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000237_create_bot_events.up.sql"))
	require.NoError(t, err)
}

func TestMigration000238(t *testing.T) {
	store := newMigrationTestStore(t)

	require.True(t, migrationIndexExists(t, store, "idx_botevents_createat"))

	// CONCURRENTLY cannot run inside a transaction; ExecNoTimeout runs unwrapped.
	_, err := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000238_create_botevents_createat_index.down.sql"))
	require.NoError(t, err)
	assert.False(t, migrationIndexExists(t, store, "idx_botevents_createat"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000238_create_botevents_createat_index.up.sql"))
	require.NoError(t, err)
	assert.True(t, migrationIndexExists(t, store, "idx_botevents_createat"))

	_, err = store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000238_create_botevents_createat_index.up.sql"))
	require.NoError(t, err)
}
