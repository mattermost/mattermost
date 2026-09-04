// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
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

// 000176 still ships PermissionField/PermissionValues/PermissionOptions assignments.
// Those columns are gone; these statements are the half of that migration that
// still applies against the current schema.
const cpaToAccessControlUpSQL = `
UPDATE PropertyFields
SET ObjectType = 'user',
    TargetType = 'system'
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes');

UPDATE PropertyGroups
SET Name    = 'access_control',
    Version = 2
WHERE Name = 'custom_profile_attributes';
`

const cpaToAccessControlDownSQL = `
UPDATE PropertyGroups
SET Name    = 'custom_profile_attributes',
    Version = 1
WHERE Name = 'access_control';

UPDATE PropertyFields
SET ObjectType = '',
    TargetType = ''
WHERE GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'custom_profile_attributes')
  AND ObjectType = 'user'
  AND TargetType = 'system';
`

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

	// Insert active fields with old format (no ObjectType).
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
				(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt)
			VALUES (?, ?, ?, ?, ?::jsonb, '', '', '', ?, ?, 0)`,
			f.id, groupID, f.name, f.ftype, f.attrs, now, now,
		)
		require.NoError(t, err, "inserting field %s", f.name)
	}

	// Insert a soft-deleted field to verify all fields are migrated.
	deletedFieldID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt)
		VALUES (?, ?, 'Deleted Field', 'text', '{}'::jsonb, '', '', '', ?, ?, ?)`,
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
	_, err = master.ExecNoTimeout(cpaToAccessControlUpSQL)
	require.NoError(t, err, "up migration should succeed")

	// Verify: group renamed.
	var groupName string
	require.NoError(t, master.Get(&groupName, "SELECT Name FROM PropertyGroups WHERE ID = ?", groupID))
	assert.Equal(t, "access_control", groupName)

	// Verify: all fields (including soft-deleted) have new metadata.
	for _, tc := range []struct {
		id    string
		label string
	}{
		{fieldID1, "non-managed text field"},
		{fieldID2, "non-managed select field"},
		{fieldID3, "admin-managed field"},
		{deletedFieldID, "soft-deleted non-managed field"},
	} {
		var f struct {
			ObjectType string `db:"objecttype"`
			TargetType string `db:"targettype"`
		}
		require.NoError(t, master.Get(&f, "SELECT ObjectType, TargetType FROM PropertyFields WHERE ID = ?", tc.id))
		assert.Equal(t, "user", f.ObjectType, "%s ObjectType", tc.label)
		assert.Equal(t, "system", f.TargetType, "%s TargetType", tc.label)
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

	// Verify: the user attribute matview exists and includes the ObjectType
	// filter (user-type fields only). Since migration 000212 the single
	// AttributeView is split per object type; the user row lives in UserAttributeView.
	var viewDef string
	err = master.Get(&viewDef, "SELECT definition FROM pg_matviews WHERE matviewname = 'userattributeview'")
	require.NoError(t, err, "UserAttributeView should exist")
	assert.Contains(t, viewDef, "pf.objecttype", "view definition should filter by pf.ObjectType")

	// Verify: materialized view contains expected data after refresh.
	_, err = master.ExecNoTimeout("REFRESH MATERIALIZED VIEW UserAttributeView")
	require.NoError(t, err, "refreshing UserAttributeView should succeed")

	var viewRow struct {
		GroupID    string `db:"groupid"`
		TargetID   string `db:"targetid"`
		TargetType string `db:"targettype"`
		Attributes []byte `db:"attributes"`
	}
	err = master.Get(&viewRow, "SELECT GroupID, TargetID, TargetType, Attributes FROM UserAttributeView WHERE TargetID = ?", targetUserID)
	require.NoError(t, err, "UserAttributeView should contain a row for the target user")
	assert.Equal(t, groupID, viewRow.GroupID)
	assert.Equal(t, targetUserID, viewRow.TargetID)
	assert.Equal(t, "user", viewRow.TargetType)

	// The text field value "hello" should appear under the field name "Text Field".
	var attrs map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(viewRow.Attributes, &attrs))
	assert.JSONEq(t, `"hello"`, string(attrs["Text Field"]), "text field value should be materialized")

	// ---- Run DOWN migration ----
	_, err = master.ExecNoTimeout(cpaToAccessControlDownSQL)
	require.NoError(t, err, "down migration should succeed")

	// Verify: group name reverted.
	require.NoError(t, master.Get(&groupName, "SELECT Name FROM PropertyGroups WHERE ID = ?", groupID))
	assert.Equal(t, "custom_profile_attributes", groupName)

	// Verify: fields reverted.
	for _, fid := range []string{fieldID1, fieldID2, fieldID3, deletedFieldID} {
		var f struct {
			ObjectType string `db:"objecttype"`
			TargetType string `db:"targettype"`
		}
		require.NoError(t, master.Get(&f, "SELECT ObjectType, TargetType FROM PropertyFields WHERE ID = ?", fid))
		assert.Equal(t, "", f.ObjectType, "field %s ObjectType should revert", fid)
		assert.Equal(t, "", f.TargetType, "field %s TargetType should revert", fid)
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
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt)
		VALUES (?, ?, 'Legacy User Field', 'text', '{}'::jsonb, '', '', '', ?, ?, 0)`,
		userFieldID, groupID, now, now,
	)
	require.NoError(t, err)

	// Run UP migration — legacy user field gets ObjectType='user', TargetType='system'.
	_, err = master.ExecNoTimeout(cpaToAccessControlUpSQL)
	require.NoError(t, err, "up migration should succeed")

	// Simulate a post-migration channel-scoped field created via the
	// generic property API against the (now renamed) access_control
	// group.
	channelFieldID := model.NewId()
	channelTargetID := model.NewId()
	_, err = master.Exec(
		`INSERT INTO PropertyFields
			(ID, GroupID, Name, Type, Attrs, TargetID, TargetType, ObjectType, CreateAt, UpdateAt, DeleteAt)
		VALUES (?, ?, 'Channel Classification', 'select', '{}'::jsonb, ?, 'channel', 'channel', ?, ?, 0)`,
		channelFieldID, groupID, channelTargetID, now, now,
	)
	require.NoError(t, err)

	// Run DOWN migration — must revert only user/system fields, not the channel one.
	_, err = master.ExecNoTimeout(cpaToAccessControlDownSQL)
	require.NoError(t, err, "down migration should succeed")

	// The original user field reverts to legacy metadata.
	var userField struct {
		ObjectType string `db:"objecttype"`
		TargetType string `db:"targettype"`
	}
	require.NoError(t, master.Get(&userField, "SELECT ObjectType, TargetType FROM PropertyFields WHERE ID = ?", userFieldID))
	assert.Equal(t, "", userField.ObjectType, "user field ObjectType should revert")
	assert.Equal(t, "", userField.TargetType, "user field TargetType should revert")

	// The post-migration channel field keeps its PSAv2 metadata intact.
	var channelField struct {
		ObjectType string `db:"objecttype"`
		TargetType string `db:"targettype"`
		TargetID   string `db:"targetid"`
	}
	require.NoError(t, master.Get(&channelField, "SELECT ObjectType, TargetType, TargetID FROM PropertyFields WHERE ID = ?", channelFieldID))
	assert.Equal(t, "channel", channelField.ObjectType, "channel field ObjectType must survive rollback")
	assert.Equal(t, "channel", channelField.TargetType, "channel field TargetType must survive rollback")
	assert.Equal(t, channelTargetID, channelField.TargetID, "channel field TargetID must survive rollback")
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

	// On a fresh database with no CPA group, both up and down should be
	// safe no-ops (the UPDATE statements match zero rows).
	_, err = master.ExecNoTimeout(cpaToAccessControlUpSQL)
	assert.NoError(t, err, "up migration should be a safe no-op on fresh DB")

	// The attribute matviews exist in the final schema. Since migration 000212
	// the single AttributeView is split into per-object-type views.
	for _, view := range []string{"userattributeview", "channelattributeview"} {
		var viewExists bool
		require.NoError(t, master.Get(&viewExists, "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = $1)", view))
		assert.True(t, viewExists, "%s should exist after up migration on fresh DB", view)
	}

	_, err = master.ExecNoTimeout(cpaToAccessControlDownSQL)
	assert.NoError(t, err, "down migration should be a safe no-op on fresh DB")
}
