// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestMigration000229 verifies that the permission_level enum accepts 'everyone'.
// The model already accepts 'everyone' on the three legacy columns, so a v2 request
// carrying it is reachable, and the column write would otherwise surface a raw
// pq enum error as a 500.
func TestMigration000229(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	groupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", groupID, "test_everyone_group")
	require.NoError(t, err)

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyFields WHERE GroupID = ?", groupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyGroups WHERE ID = ?", groupID)      //nolint:errcheck
	})

	now := model.GetMillis()
	fieldID := model.NewId()

	// Test INSERT with 'everyone'
	_, err = master.Exec(
		`INSERT INTO PropertyFields
		(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, PermissionField, PermissionValues, PermissionOptions)
		VALUES (?, ?, ?, 'text', '{}'::jsonb, '', 'system', 'user', ?, ?, ?, ?, ?, ?)`,
		fieldID, groupID, "test_field", now, now, 0, "everyone", "everyone", "everyone",
	)
	require.NoError(t, err, "inserting field with 'everyone' should succeed")

	var row struct {
		PermissionField   sql.NullString `db:"permissionfield"`
		PermissionValues  sql.NullString `db:"permissionvalues"`
		PermissionOptions sql.NullString `db:"permissionoptions"`
	}
	require.NoError(t, master.Get(&row, "SELECT PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", fieldID))
	assert.True(t, row.PermissionField.Valid)
	assert.Equal(t, "everyone", row.PermissionField.String)
	assert.True(t, row.PermissionValues.Valid)
	assert.Equal(t, "everyone", row.PermissionValues.String)
	assert.True(t, row.PermissionOptions.Valid)
	assert.Equal(t, "everyone", row.PermissionOptions.String)

	// Test UPDATE to 'everyone'
	fieldID2 := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
		(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, PermissionValues)
		VALUES (?, ?, ?, 'text', '{}'::jsonb, '', 'system', 'user', ?, ?, ?, ?)`,
		fieldID2, groupID, "test_field_update", now, now, 0, "member",
	)
	require.NoError(t, err)

	_, err = master.Exec("UPDATE PropertyFields SET PermissionValues = ? WHERE ID = ?", "everyone", fieldID2)
	require.NoError(t, err, "updating PermissionValues to 'everyone' should succeed")

	var row2 struct {
		PermissionValues sql.NullString `db:"permissionvalues"`
	}
	require.NoError(t, master.Get(&row2, "SELECT PermissionValues FROM PropertyFields WHERE ID = ?", fieldID2))
	assert.True(t, row2.PermissionValues.Valid)
	assert.Equal(t, "everyone", row2.PermissionValues.String)
}
