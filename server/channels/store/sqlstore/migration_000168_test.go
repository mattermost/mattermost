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
	"github.com/mattermost/mattermost/server/v8/channels/db"
)

func readMigrationSQL(t *testing.T, filename string) string {
	t.Helper()
	data, err := db.Assets().ReadFile("migrations/postgres/" + filename)
	require.NoError(t, err, "failed to read migration file %s", filename)
	return string(data)
}

func TestMigration000168(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000168_migrate_cpa_to_protected_attributes.up.sql")
	downSQL := readMigrationSQL(t, "000168_migrate_cpa_to_protected_attributes.down.sql")

	// Insert a group simulating pre-migration CPA state.
	groupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", groupID, "custom_profile_attributes")
	require.NoError(t, err)

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyValues WHERE GroupID = ?", groupID)  //nolint:errcheck
		master.Exec("DELETE FROM PropertyFields WHERE GroupID = ?", groupID)  //nolint:errcheck
		master.Exec("DELETE FROM PropertyGroups WHERE ID = ?", groupID)       //nolint:errcheck
	})

	now := model.GetMillis()

	// Insert two active fields with old format (no ObjectType, no permissions).
	fieldID1 := model.NewId()
	fieldID2 := model.NewId()
	for _, f := range []struct {
		id    string
		name  string
		ftype string
		attrs string
	}{
		{fieldID1, "Text Field", "text", `{"visibility":"always","sort_order":1}`},
		{fieldID2, "Select Field", "select", `{"options":[{"id":"opt1","name":"Option 1"}]}`},
	} {
		_, err = master.Exec(
			`INSERT INTO PropertyFields
				(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, Protected)
			VALUES (?, ?, ?, ?, ?::jsonb, '', '', '', ?, ?, 0, false)`,
			f.id, groupID, f.name, f.ftype, f.attrs, now, now,
		)
		require.NoError(t, err, "inserting field %s", f.name)
	}

	// Insert a soft-deleted field to verify all fields are migrated.
	deletedFieldID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, Protected)
		VALUES (?, ?, 'Deleted Field', 'text', '{}'::jsonb, '', '', '', ?, ?, ?, false)`,
		deletedFieldID, groupID, now, now, now,
	)
	require.NoError(t, err)

	// Insert a property value.
	valueID := model.NewId()
	targetUserID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyValues
			(ID, TargetID, TargetType, GroupID, FieldID, Value, CreateAt, UpdateAt, DeleteAt)
		VALUES (?, ?, 'user', ?, ?, '"hello"'::jsonb, ?, ?, 0)`,
		valueID, targetUserID, groupID, fieldID1, now, now,
	)
	require.NoError(t, err)

	// ---- Run UP migration ----
	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should succeed")

	// Verify: group renamed.
	var groupName string
	require.NoError(t, master.Get(&groupName, "SELECT Name FROM PropertyGroups WHERE ID = ?", groupID))
	assert.Equal(t, "protected_attributes", groupName)

	// Verify: all fields (including soft-deleted) have new metadata.
	for _, fid := range []string{fieldID1, fieldID2, deletedFieldID} {
		var f struct {
			ObjectType        string         `db:"objecttype"`
			TargetType        string         `db:"targettype"`
			PermissionField   sql.NullString `db:"permissionfield"`
			PermissionValues  sql.NullString `db:"permissionvalues"`
			PermissionOptions sql.NullString `db:"permissionoptions"`
		}
		require.NoError(t, master.Get(&f, "SELECT ObjectType, TargetType, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", fid))
		assert.Equal(t, "user", f.ObjectType, "field %s ObjectType", fid)
		assert.Equal(t, "system", f.TargetType, "field %s TargetType", fid)
		assert.True(t, f.PermissionField.Valid, "field %s PermissionField should be set", fid)
		assert.Equal(t, "sysadmin", f.PermissionField.String, "field %s PermissionField", fid)
		assert.True(t, f.PermissionValues.Valid, "field %s PermissionValues should be set", fid)
		assert.Equal(t, "sysadmin", f.PermissionValues.String, "field %s PermissionValues", fid)
		assert.True(t, f.PermissionOptions.Valid, "field %s PermissionOptions should be set", fid)
		assert.Equal(t, "sysadmin", f.PermissionOptions.String, "field %s PermissionOptions", fid)
	}

	// Verify: property value is unchanged (GroupID still references the same ID).
	var val struct {
		GroupID    string `db:"groupid"`
		TargetID   string `db:"targetid"`
		TargetType string `db:"targettype"`
	}
	require.NoError(t, master.Get(&val, "SELECT GroupID, TargetID, TargetType FROM PropertyValues WHERE ID = ?", valueID))
	assert.Equal(t, groupID, val.GroupID, "value GroupID should be unchanged")
	assert.Equal(t, targetUserID, val.TargetID, "value TargetID should be unchanged")
	assert.Equal(t, "user", val.TargetType, "value TargetType should be unchanged")

	// Verify: AttributeView exists and includes the ObjectType filter (user-type fields only).
	var viewDef string
	err = master.Get(&viewDef, "SELECT definition FROM pg_matviews WHERE matviewname = 'attributeview'")
	require.NoError(t, err, "AttributeView should exist")
	assert.Contains(t, viewDef, "user", "view definition should filter by ObjectType")

	// ---- Run DOWN migration ----
	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")

	// Verify: group name reverted.
	require.NoError(t, master.Get(&groupName, "SELECT Name FROM PropertyGroups WHERE ID = ?", groupID))
	assert.Equal(t, "custom_profile_attributes", groupName)

	// Verify: fields reverted.
	for _, fid := range []string{fieldID1, fieldID2, deletedFieldID} {
		var f struct {
			ObjectType        string         `db:"objecttype"`
			TargetType        string         `db:"targettype"`
			PermissionField   sql.NullString `db:"permissionfield"`
			PermissionValues  sql.NullString `db:"permissionvalues"`
			PermissionOptions sql.NullString `db:"permissionoptions"`
		}
		require.NoError(t, master.Get(&f, "SELECT ObjectType, TargetType, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", fid))
		assert.Equal(t, "", f.ObjectType, "field %s ObjectType should revert", fid)
		assert.Equal(t, "", f.TargetType, "field %s TargetType should revert", fid)
		assert.False(t, f.PermissionField.Valid, "field %s PermissionField should be NULL", fid)
		assert.False(t, f.PermissionValues.Valid, "field %s PermissionValues should be NULL", fid)
		assert.False(t, f.PermissionOptions.Valid, "field %s PermissionOptions should be NULL", fid)
	}

	// Verify: value still unchanged after down migration.
	require.NoError(t, master.Get(&val, "SELECT GroupID, TargetID, TargetType FROM PropertyValues WHERE ID = ?", valueID))
	assert.Equal(t, groupID, val.GroupID, "value GroupID should remain unchanged after down")
}

func TestMigration000168NoOpOnFreshDB(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000168_migrate_cpa_to_protected_attributes.up.sql")
	downSQL := readMigrationSQL(t, "000168_migrate_cpa_to_protected_attributes.down.sql")

	// On a fresh database with no CPA group, both up and down should be
	// safe no-ops (the UPDATE statements match zero rows).
	_, err = master.ExecNoTimeout(upSQL)
	assert.NoError(t, err, "up migration should be a safe no-op on fresh DB")

	_, err = master.ExecNoTimeout(downSQL)
	assert.NoError(t, err, "down migration should be a safe no-op on fresh DB")
}
