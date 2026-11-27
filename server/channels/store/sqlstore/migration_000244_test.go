// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const postAttributesGroupName = "post_attributes"

// groupRows holds the identifiers of every row of the property tables that
// belongs to one group, so two snapshots can be compared by content and not
// only by count.
type groupRows struct {
	Groups  []string
	Fields  []string
	Options []string
	Edges   []string
	Grants  []string
	Values  []string
}

func (g groupRows) total() int {
	return len(g.Groups) + len(g.Fields) + len(g.Options) + len(g.Edges) + len(g.Grants) + len(g.Values)
}

func snapshotGroup(t *testing.T, s *SqlStore, name string) groupRows {
	t.Helper()
	var rows groupRows
	queries := []struct {
		dst   *[]string
		query string
	}{
		{&rows.Groups, `SELECT ID FROM PropertyGroups WHERE Name = $1`},
		{&rows.Fields, `SELECT f.ID FROM PropertyFields f JOIN PropertyGroups g ON g.ID = f.GroupID WHERE g.Name = $1`},
		{&rows.Options, `SELECT o.FieldID || '/' || o.ID FROM PropertyOptions o JOIN PropertyGroups g ON g.ID = o.GroupID WHERE g.Name = $1`},
		{&rows.Edges, `SELECT e.FieldID || '/' || e.ChildOptionID || '/' || e.ParentOptionID FROM PropertyOptionEdges e JOIN PropertyFields f ON f.ID = e.FieldID JOIN PropertyGroups g ON g.ID = f.GroupID WHERE g.Name = $1`},
		{&rows.Grants, `SELECT gr.FieldID || '/' || gr.Type || '/' || gr.ID || '/' || gr.Action FROM PropertyFieldGrants gr JOIN PropertyFields f ON f.ID = gr.FieldID JOIN PropertyGroups g ON g.ID = f.GroupID WHERE g.Name = $1`},
		{&rows.Values, `SELECT v.ID FROM PropertyValues v JOIN PropertyGroups g ON g.ID = v.GroupID WHERE g.Name = $1`},
	}
	for _, q := range queries {
		require.NoError(t, s.GetMaster().Select(q.dst, q.query, name))
		slices.Sort(*q.dst)
	}
	return rows
}

// seedPropertyGroup creates a group with a select field of object type
// objectType, two options linked by an edge, one grant, and a value on each of
// two targets.
func seedPropertyGroup(t *testing.T, s *SqlStore, groupName, objectType string) {
	t.Helper()

	group, err := s.PropertyGroup().Get(groupName)
	if err != nil {
		group, err = s.PropertyGroup().Register(&model.PropertyGroup{Name: groupName, Version: model.PropertyGroupVersionV1})
		require.NoError(t, err)
	}

	parentID := model.NewId()
	childID := model.NewId()
	field, err := s.PropertyField().Create(&model.PropertyField{
		GroupID:    group.ID,
		Name:       "select_" + model.NewId(),
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: objectType,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": parentID, "name": "Parent"},
				map[string]any{"id": childID, "name": "Child"},
			},
		},
	})
	require.NoError(t, err)

	_, err = s.GetMaster().Exec(
		`INSERT INTO PropertyOptionEdges (FieldID, ChildOptionID, ParentOptionID, CreateAt) VALUES ($1, $2, $3, $4)`,
		field.ID, childID, parentID, model.GetMillis())
	require.NoError(t, err)

	_, err = s.GetMaster().Exec(
		`INSERT INTO PropertyFieldGrants (FieldID, Type, ID, Action) VALUES ($1, 'role', 'system_user', 'value.write')`,
		field.ID)
	require.NoError(t, err)

	raw, err := json.Marshal(parentID)
	require.NoError(t, err)
	for range 2 {
		_, err = s.PropertyValue().Create(&model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: objectType,
			Value:      raw,
		})
		require.NoError(t, err)
	}
}

func TestMigration000244(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	upSQL := readMigrationSQL(t, "000244_drop_post_attributes_group.up.sql")
	downSQL := readMigrationSQL(t, "000244_drop_post_attributes_group.down.sql")

	// snapshotAll captures every group's rows, keyed by group name.
	snapshotAll := func(t *testing.T) map[string]groupRows {
		t.Helper()
		var names []string
		require.NoError(t, store.GetMaster().Select(&names, `SELECT Name FROM PropertyGroups ORDER BY Name`))
		all := make(map[string]groupRows, len(names))
		for _, name := range names {
			all[name] = snapshotGroup(t, store, name)
		}
		return all
	}

	t.Run("keeps every pre-existing post_attributes row and every other group", func(t *testing.T) {
		seedPropertyGroup(t, store, postAttributesGroupName, model.PropertyFieldObjectTypePost)
		// A second field in the same group, so it holds more than one.
		seedPropertyGroup(t, store, postAttributesGroupName, model.PropertyFieldObjectTypePost)
		seedPropertyGroup(t, store, model.NewId(), model.PropertyFieldObjectTypePost)
		seedPropertyGroup(t, store, model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeUser)

		legacy := snapshotGroup(t, store, postAttributesGroupName)
		require.Len(t, legacy.Groups, 1)
		require.Len(t, legacy.Fields, 2)
		require.Len(t, legacy.Options, 4)
		require.Len(t, legacy.Edges, 2)
		require.Len(t, legacy.Grants, 2)
		require.Len(t, legacy.Values, 4)

		before := snapshotAll(t)

		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)

		assert.Equal(t, legacy, snapshotGroup(t, store, postAttributesGroupName), "no post_attributes row may be deleted, grants included")
		assert.Equal(t, before, snapshotAll(t), "no group may lose or gain rows")
	})

	t.Run("leaves post_attributes post fields at member", func(t *testing.T) {
		postAttributes := getOrRegisterGroup(t, store, postAttributesGroupName)
		legacyMember := createLeveledField(t, store, postAttributes, model.PropertyFieldObjectTypePost, model.PermissionLevelMember, nil)
		convertedMember := createLeveledField(t, store, postAttributes, model.PropertyFieldObjectTypePost, "",
			restrictionsWithValueWrite(model.PermissionLevelMember))
		permissionsBefore := storedPermissions(t, store, convertedMember)
		updateAtsBefore := storedUpdateAts(t, store, legacyMember, convertedMember)

		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)

		column, write := storedLevels(t, store, legacyMember)
		assert.Equal(t, "member", column)
		assert.False(t, write.Valid)

		column, write = storedLevels(t, store, convertedMember)
		assert.Equal(t, "member", column)
		assert.Equal(t, "member", write.String)
		assert.Equal(t, permissionsBefore, storedPermissions(t, store, convertedMember))
		assert.Equal(t, updateAtsBefore, storedUpdateAts(t, store, legacyMember, convertedMember))
	})

	t.Run("running it again changes nothing", func(t *testing.T) {
		before := snapshotAll(t)
		require.NotZero(t, before[postAttributesGroupName].total())
		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)
		assert.Equal(t, before, snapshotAll(t))
	})

	t.Run("the down migration is a no-op", func(t *testing.T) {
		before := snapshotAll(t)
		require.NotZero(t, before[postAttributesGroupName].total())
		_, err := store.GetMaster().ExecNoTimeout(downSQL)
		require.NoError(t, err)
		assert.Equal(t, before, snapshotAll(t))
	})

	t.Run("moves access_control post fields at member to creator and nothing else", func(t *testing.T) {
		accessControl := getOrRegisterGroup(t, store, model.AccessControlPropertyGroupName)
		other := getOrRegisterGroup(t, store, "other_"+model.NewId())

		// A field not yet converted carries its level in the column only.
		legacyMember := createLeveledField(t, store, accessControl, model.PropertyFieldObjectTypePost, model.PermissionLevelMember, nil)
		// A converted field carries it in the permissions object, which wins on read.
		convertedMember := createLeveledField(t, store, accessControl, model.PropertyFieldObjectTypePost, "",
			restrictionsWithValueWrite(model.PermissionLevelMember))
		convertedAdmin := createLeveledField(t, store, accessControl, model.PropertyFieldObjectTypePost, "",
			restrictionsWithValueWrite(model.PermissionLevelAdmin))
		legacyAdmin := createLeveledField(t, store, accessControl, model.PropertyFieldObjectTypePost, model.PermissionLevelAdmin, nil)
		userMember := createLeveledField(t, store, accessControl, model.PropertyFieldObjectTypeUser, model.PermissionLevelMember, nil)
		otherGroupMember := createLeveledField(t, store, other, model.PropertyFieldObjectTypePost, model.PermissionLevelMember,
			restrictionsWithValueWrite(model.PermissionLevelMember))

		convertedBefore := storedPermissions(t, store, convertedMember)
		updateAtsBefore := storedUpdateAts(t, store, legacyMember, convertedMember)

		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)

		column, write := storedLevels(t, store, legacyMember)
		assert.Equal(t, "creator", column, "an unconverted member field moves in the column")
		assert.False(t, write.Valid, "an unconverted field gains no permissions object")

		column, write = storedLevels(t, store, convertedMember)
		assert.Equal(t, "creator", column, "a converted member field moves in the column")
		assert.Equal(t, "creator", write.String, "a converted member field moves in the permissions object")

		// Only value.write changes: the rest of the permissions object is kept as it was.
		convertedAfter := storedPermissions(t, store, convertedMember)
		convertedBefore.Restrictions.Value.Write = model.PermissionLevelCreator
		assert.Equal(t, convertedBefore, convertedAfter)

		for name, id := range map[string]string{"converted admin": convertedAdmin, "legacy admin": legacyAdmin} {
			column, write = storedLevels(t, store, id)
			assert.Equal(t, "admin", column, "%s stays at admin", name)
			if write.Valid {
				assert.Equal(t, "admin", write.String, "%s stays at admin", name)
			}
		}

		column, _ = storedLevels(t, store, userMember)
		assert.Equal(t, "member", column, "a user field is not a post field")

		column, write = storedLevels(t, store, otherGroupMember)
		assert.Equal(t, "member", column, "a post field in another group is left alone")
		assert.Equal(t, "member", write.String, "a post field in another group is left alone")

		assert.Equal(t, updateAtsBefore, storedUpdateAts(t, store, legacyMember, convertedMember),
			"the move does not bump UpdateAt")

		// Running it again matches nothing at member, so nothing changes.
		_, err = store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)
		assert.Equal(t, convertedAfter, storedPermissions(t, store, convertedMember))
		column, _ = storedLevels(t, store, legacyMember)
		assert.Equal(t, "creator", column)
	})
}

func getOrRegisterGroup(t *testing.T, s *SqlStore, name string) *model.PropertyGroup {
	t.Helper()

	group, err := s.PropertyGroup().Get(name)
	if err != nil {
		group, err = s.PropertyGroup().Register(&model.PropertyGroup{Name: name, Version: model.PropertyGroupVersionV1})
		require.NoError(t, err)
	}
	return group
}

func restrictionsWithValueWrite(level model.PermissionLevel) *model.Permissions {
	return &model.Permissions{
		Restrictions: &model.Restrictions{
			Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: level},
			Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelSysadmin},
			Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
		},
		Grants: []model.Grant{},
	}
}

// createLeveledField stores a text field at value level `column` (left NULL when
// empty), with `permissions` when given, which the store projects into the column.
func createLeveledField(t *testing.T, s *SqlStore, group *model.PropertyGroup, objectType string, column model.PermissionLevel, permissions *model.Permissions) string {
	t.Helper()

	field := &model.PropertyField{
		GroupID:     group.ID,
		Name:        "leveled_" + model.NewId(),
		Type:        model.PropertyFieldTypeText,
		ObjectType:  objectType,
		TargetType:  string(model.PropertyFieldTargetLevelSystem),
		Permissions: permissions,
	}
	if column != "" {
		field.PermissionValues = model.NewPointer(column)
	}

	created, err := s.PropertyField().Create(field)
	require.NoError(t, err)
	return created.ID
}

// storedLevels reads a field's value level as stored, bypassing the store's
// projection: the PermissionValues column and the permissions object's
// restrictions.value.write leaf, NULL when the field has no permissions object.
func storedLevels(t *testing.T, s *SqlStore, fieldID string) (string, sql.NullString) {
	t.Helper()

	var row struct {
		Column string         `db:"column"`
		Write  sql.NullString `db:"write"`
	}
	require.NoError(t, s.GetMaster().Get(&row,
		`SELECT PermissionValues AS column, Permissions #>> '{restrictions,value,write}' AS write FROM PropertyFields WHERE ID = $1`,
		fieldID))
	return row.Column, row.Write
}

func storedPermissions(t *testing.T, s *SqlStore, fieldID string) model.Permissions {
	t.Helper()

	var raw string
	require.NoError(t, s.GetMaster().Get(&raw, `SELECT Permissions::text FROM PropertyFields WHERE ID = $1`, fieldID))

	var permissions model.Permissions
	require.NoError(t, json.Unmarshal([]byte(raw), &permissions))
	return permissions
}

func storedUpdateAts(t *testing.T, s *SqlStore, fieldIDs ...string) []int64 {
	t.Helper()

	updateAts := make([]int64, 0, len(fieldIDs))
	for _, id := range fieldIDs {
		var updateAt int64
		require.NoError(t, s.GetMaster().Get(&updateAt, `SELECT UpdateAt FROM PropertyFields WHERE ID = $1`, id))
		updateAts = append(updateAts, updateAt)
	}
	return updateAts
}
