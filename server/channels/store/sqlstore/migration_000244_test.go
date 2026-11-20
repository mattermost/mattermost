// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"sort"
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
		sort.Strings(*q.dst)
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

	// New() applies every migration, so 000244 has already run against an
	// empty database. Nothing recreates the group afterwards.
	t.Run("a freshly migrated database has no post_attributes group", func(t *testing.T) {
		assert.Zero(t, snapshotGroup(t, store, postAttributesGroupName).total())
	})

	t.Run("a database without a post_attributes group is untouched", func(t *testing.T) {
		seedPropertyGroup(t, store, model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypePost)
		before := snapshotGroup(t, store, model.AccessControlPropertyGroupName)
		require.NotZero(t, before.total())

		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)
		assert.Equal(t, before, snapshotGroup(t, store, model.AccessControlPropertyGroupName))
	})

	t.Run("deletes every post_attributes row and nothing else", func(t *testing.T) {
		seedPropertyGroup(t, store, postAttributesGroupName, model.PropertyFieldObjectTypePost)
		// A second field in the same group, so it holds more than one.
		seedPropertyGroup(t, store, postAttributesGroupName, model.PropertyFieldObjectTypePost)
		// Another group holding the same object type, to show the match is by
		// group and not by object type.
		seedPropertyGroup(t, store, model.NewId(), model.PropertyFieldObjectTypePost)
		seedPropertyGroup(t, store, model.AccessControlPropertyGroupName, model.PropertyFieldObjectTypeUser)

		legacy := snapshotGroup(t, store, postAttributesGroupName)
		require.Len(t, legacy.Groups, 1)
		require.Len(t, legacy.Fields, 2)
		require.Len(t, legacy.Options, 4)
		require.Len(t, legacy.Edges, 2)
		require.Len(t, legacy.Grants, 2)
		require.Len(t, legacy.Values, 4)

		var totalGroups int
		require.NoError(t, store.GetMaster().Get(&totalGroups, `SELECT COUNT(*) FROM PropertyGroups`))
		var others []groupRows
		var otherNames []string
		require.NoError(t, store.GetMaster().Select(&otherNames, `SELECT Name FROM PropertyGroups WHERE Name <> $1 ORDER BY Name`, postAttributesGroupName))
		for _, name := range otherNames {
			others = append(others, snapshotGroup(t, store, name))
		}

		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)

		assert.Equal(t, groupRows{}, snapshotGroup(t, store, postAttributesGroupName), "every post_attributes row should be gone, grants included")

		// Orphan check: no option, edge, grant or value points at a deleted field.
		for _, table := range []string{"PropertyOptions", "PropertyOptionEdges", "PropertyFieldGrants", "PropertyValues"} {
			var orphans int
			require.NoError(t, store.GetMaster().Get(&orphans,
				`SELECT COUNT(*) FROM `+table+` t WHERE NOT EXISTS (SELECT 1 FROM PropertyFields f WHERE f.ID = t.FieldID)`))
			assert.Zero(t, orphans, "%s should hold no orphan rows", table)
		}

		var afterNames []string
		require.NoError(t, store.GetMaster().Select(&afterNames, `SELECT Name FROM PropertyGroups ORDER BY Name`))
		require.Equal(t, otherNames, afterNames, "no other group may be removed")
		for i, name := range afterNames {
			assert.Equal(t, others[i], snapshotGroup(t, store, name), "group %q must be unchanged", name)
		}

		ac := snapshotGroup(t, store, model.AccessControlPropertyGroupName)
		assert.Len(t, ac.Groups, 1)
		assert.NotEmpty(t, ac.Fields)
		assert.NotEmpty(t, ac.Values)
	})

	t.Run("running it again changes nothing", func(t *testing.T) {
		before := snapshotGroup(t, store, model.AccessControlPropertyGroupName)
		_, err := store.GetMaster().ExecNoTimeout(upSQL)
		require.NoError(t, err)
		assert.Equal(t, before, snapshotGroup(t, store, model.AccessControlPropertyGroupName))
		assert.Zero(t, snapshotGroup(t, store, postAttributesGroupName).total())
	})

	t.Run("the down migration is a no-op", func(t *testing.T) {
		before := snapshotGroup(t, store, model.AccessControlPropertyGroupName)
		_, err := store.GetMaster().ExecNoTimeout(downSQL)
		require.NoError(t, err)
		assert.Equal(t, before, snapshotGroup(t, store, model.AccessControlPropertyGroupName))
		assert.Zero(t, snapshotGroup(t, store, postAttributesGroupName).total(), "down must not recreate the group")
	})
}
