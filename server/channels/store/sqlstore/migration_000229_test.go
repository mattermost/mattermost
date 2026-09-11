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

func permissionLevelHasValue(t *testing.T, s *SqlStore, label string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count, `
		SELECT COUNT(*)
		FROM pg_enum e
		JOIN pg_type ty ON ty.oid = e.enumtypid
		WHERE ty.typname = 'permission_level' AND e.enumlabel = $1`, label)
	require.NoError(t, err)
	return count > 0
}

func TestMigration000229(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000229 is already in effect.
	require.True(t, permissionLevelHasValue(t, store, "everyone"))

	t.Run("the down migration keeps the enum value", func(t *testing.T) {
		_, dErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000229_add_everyone_to_permission_level.down.sql"))
		require.NoError(t, dErr, "down migration should succeed")
		assert.True(t, permissionLevelHasValue(t, store, "everyone"),
			"the down migration is a no-op, so 'everyone' must survive it")

		// And re-applying the up migration on top is harmless.
		_, uErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000229_add_everyone_to_permission_level.up.sql"))
		require.NoError(t, uErr, "up migration should be re-appliable")
		assert.True(t, permissionLevelHasValue(t, store, "everyone"))
	})
}
