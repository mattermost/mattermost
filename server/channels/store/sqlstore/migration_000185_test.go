// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
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

func TestMigration000185(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.up.sql")
	downSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.down.sql")

	// Insert a group simulating pre-migration CPA state.
	groupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", groupID, "custom_profile_attributes")
	require.NoError(t, err)

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyValues WHERE GroupID = ?", groupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyFields WHERE GroupID = ?", groupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyGroups WHERE ID = ?", groupID)      //nolint:errcheck
	})

	now := model.GetMillis()

	// Insert active fields with old format (no ObjectType, no permissions).
	// fieldID1 and fieldID2 are non-managed; fieldID3 is admin-managed.
	fieldID1 := model.NewId()
	fieldID2 := model.NewId()
	fieldID3 := model.NewId()
	for _, f := range []struct {
		id    string
		name  string
		ftype string
		attrs string
	}{
		{fieldID1, "Text Field", "text", `{"visibility":"always","sort_order":1}`},
		{fieldID2, "Select Field", "select", `{"options":[{"id":"opt1","name":"Option 1"}]}`},
		{fieldID3, "Admin Managed Field", "text", `{"visibility":"always","sort_order":3,"managed":"admin"}`},
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
	assert.Equal(t, "access_control", groupName)

	// Verify: all fields (including soft-deleted) have new metadata.
	// Non-managed fields get PermissionValues = 'member'.
	// Admin-managed fields get PermissionValues = 'sysadmin'.
	for _, tc := range []struct {
		id                       string
		label                    string
		expectedPermissionValues string
	}{
		{fieldID1, "non-managed text field", "member"},
		{fieldID2, "non-managed select field", "member"},
		{fieldID3, "admin-managed field", "sysadmin"},
		{deletedFieldID, "soft-deleted non-managed field", "member"},
	} {
		var f struct {
			ObjectType        string         `db:"objecttype"`
			TargetType        string         `db:"targettype"`
			PermissionField   sql.NullString `db:"permissionfield"`
			PermissionValues  sql.NullString `db:"permissionvalues"`
			PermissionOptions sql.NullString `db:"permissionoptions"`
		}
		require.NoError(t, master.Get(&f, "SELECT ObjectType, TargetType, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", tc.id))
		assert.Equal(t, "user", f.ObjectType, "%s ObjectType", tc.label)
		assert.Equal(t, "system", f.TargetType, "%s TargetType", tc.label)
		assert.True(t, f.PermissionField.Valid, "%s PermissionField should be set", tc.label)
		assert.Equal(t, "sysadmin", f.PermissionField.String, "%s PermissionField", tc.label)
		assert.True(t, f.PermissionValues.Valid, "%s PermissionValues should be set", tc.label)
		assert.Equal(t, tc.expectedPermissionValues, f.PermissionValues.String, "%s PermissionValues", tc.label)
		assert.True(t, f.PermissionOptions.Valid, "%s PermissionOptions should be set", tc.label)
		assert.Equal(t, "sysadmin", f.PermissionOptions.String, "%s PermissionOptions", tc.label)
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
	assert.Contains(t, viewDef, "pf.objecttype", "view definition should filter by pf.ObjectType")

	// Verify: materialized view contains expected data after refresh.
	_, err = master.ExecNoTimeout("REFRESH MATERIALIZED VIEW AttributeView")
	require.NoError(t, err, "refreshing AttributeView should succeed")

	var viewRow struct {
		GroupID    string `db:"groupid"`
		TargetID   string `db:"targetid"`
		TargetType string `db:"targettype"`
		Attributes []byte `db:"attributes"`
	}
	err = master.Get(&viewRow, "SELECT GroupID, TargetID, TargetType, Attributes FROM AttributeView WHERE TargetID = ?", targetUserID)
	require.NoError(t, err, "AttributeView should contain a row for the target user")
	assert.Equal(t, groupID, viewRow.GroupID)
	assert.Equal(t, targetUserID, viewRow.TargetID)
	assert.Equal(t, "user", viewRow.TargetType)

	// The text field value "hello" should appear under the field name "Text Field".
	var attrs map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(viewRow.Attributes, &attrs))
	assert.JSONEq(t, `"hello"`, string(attrs["Text Field"]), "text field value should be materialized")

	// ---- Run DOWN migration ----
	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")

	// Verify: group name reverted.
	require.NoError(t, master.Get(&groupName, "SELECT Name FROM PropertyGroups WHERE ID = ?", groupID))
	assert.Equal(t, "custom_profile_attributes", groupName)

	// Verify: fields reverted.
	for _, fid := range []string{fieldID1, fieldID2, fieldID3, deletedFieldID} {
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

func TestMigration000185DownPreservesNonUserFields(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.up.sql")
	downSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.down.sql")

	groupID := model.NewId()
	_, err = master.Exec("INSERT INTO PropertyGroups (ID, Name) VALUES (?, ?)", groupID, "custom_profile_attributes")
	require.NoError(t, err)

	t.Cleanup(func() {
		master.Exec("DELETE FROM PropertyFields WHERE GroupID = ?", groupID) //nolint:errcheck
		master.Exec("DELETE FROM PropertyGroups WHERE ID = ?", groupID)      //nolint:errcheck
	})

	now := model.GetMillis()

	// Insert a legacy user field that the up migration will touch.
	userFieldID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt, Protected)
		VALUES (?, ?, 'Legacy User Field', 'text', '{}'::jsonb, '', '', '', ?, ?, 0, false)`,
		userFieldID, groupID, now, now,
	)
	require.NoError(t, err)

	// Run UP migration — legacy user field gets ObjectType='user', TargetType='system'.
	_, err = master.ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should succeed")

	// Simulate a post-migration channel-scoped field created via the
	// generic property API against the (now renamed) access_control
	// group.
	channelFieldID := model.NewId()
	channelTargetID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, PermissionField, PermissionValues, PermissionOptions, CreateAt, UpdateAt, DeleteAt, Protected)
		VALUES (?, ?, 'Channel Classification', 'select', '{}'::jsonb, ?, 'channel', 'channel', 'sysadmin', 'member', 'sysadmin', ?, ?, 0, false)`,
		channelFieldID, groupID, channelTargetID, now, now,
	)
	require.NoError(t, err)

	// Run DOWN migration — must revert only user/system fields, not the channel one.
	_, err = master.ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")

	// The original user field reverts to legacy metadata.
	var userField struct {
		ObjectType        string         `db:"objecttype"`
		TargetType        string         `db:"targettype"`
		PermissionField   sql.NullString `db:"permissionfield"`
		PermissionValues  sql.NullString `db:"permissionvalues"`
		PermissionOptions sql.NullString `db:"permissionoptions"`
	}
	require.NoError(t, master.Get(&userField, "SELECT ObjectType, TargetType, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", userFieldID))
	assert.Equal(t, "", userField.ObjectType, "user field ObjectType should revert")
	assert.Equal(t, "", userField.TargetType, "user field TargetType should revert")
	assert.False(t, userField.PermissionField.Valid, "user field PermissionField should be NULL")

	// The post-migration channel field keeps its PSAv2 metadata intact.
	var channelField struct {
		ObjectType        string         `db:"objecttype"`
		TargetType        string         `db:"targettype"`
		TargetID          string         `db:"targetid"`
		PermissionField   sql.NullString `db:"permissionfield"`
		PermissionValues  sql.NullString `db:"permissionvalues"`
		PermissionOptions sql.NullString `db:"permissionoptions"`
	}
	require.NoError(t, master.Get(&channelField, "SELECT ObjectType, TargetType, TargetID, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = ?", channelFieldID))
	assert.Equal(t, "channel", channelField.ObjectType, "channel field ObjectType must survive rollback")
	assert.Equal(t, "channel", channelField.TargetType, "channel field TargetType must survive rollback")
	assert.Equal(t, channelTargetID, channelField.TargetID, "channel field TargetID must survive rollback")
	assert.True(t, channelField.PermissionField.Valid, "channel field PermissionField must survive rollback")
	assert.Equal(t, "sysadmin", channelField.PermissionField.String)
	assert.True(t, channelField.PermissionValues.Valid)
	assert.Equal(t, "member", channelField.PermissionValues.String)
	assert.True(t, channelField.PermissionOptions.Valid)
	assert.Equal(t, "sysadmin", channelField.PermissionOptions.String)
}

func TestMigration000185NoOpOnFreshDB(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	master := store.GetMaster()

	upSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.up.sql")
	downSQL := readMigrationSQL(t, "000176_migrate_cpa_to_access_control.down.sql")

	// On a fresh database with no CPA group, both up and down should be
	// safe no-ops (the UPDATE statements match zero rows).
	_, err = master.ExecNoTimeout(upSQL)
	assert.NoError(t, err, "up migration should be a safe no-op on fresh DB")

	// Even with no CPA data, the view should be (re)created.
	var viewExists bool
	require.NoError(t, master.Get(&viewExists, "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'attributeview')"))
	assert.True(t, viewExists, "AttributeView should exist after up migration on fresh DB")

	_, err = master.ExecNoTimeout(downSQL)
	assert.NoError(t, err, "down migration should be a safe no-op on fresh DB")
}
