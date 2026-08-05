// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// tableExists reports whether a table of the given name exists in the current
// schema.
func tableExists(t *testing.T, s *SqlStore, name string) bool {
	t.Helper()
	var count int
	err := s.GetMaster().Get(&count,
		"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND lower(table_name) = lower($1)", name)
	require.NoError(t, err)
	return count > 0
}

// TestMigration000213 verifies the move of select-style field options out of
// PropertyFields.Attrs->'options' and into PropertyOptions.
//
// The property both attribute views depend on is that an option identifier in a
// property value still resolves to that option's name, including through a field
// that only links to the template owning the option — which is the case the
// previous view definitions got for free, because a linked field held its own copy
// of the list. The test drives it through a full down/up cycle: the down migration
// puts the options back in the blob and restores the previous view bodies, and the
// up migration backfills from that blob, so the same assertions hold either side
// and the backfill is exercised on rows the store wrote.
func TestMigration000213(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000213 is already in effect.
	require.True(t, tableExists(t, store, "PropertyOptions"), "PropertyOptions should exist after migration")

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	selectOptionID := model.NewId()
	multiOptionAID := model.NewId()
	multiOptionBID := model.NewId()
	rankOptionID := model.NewId()

	// A user-scoped select field whose options are owned by a template, so the
	// view has to resolve the option through the link.
	template, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "template_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{map[string]any{"id": selectOptionID, "name": "Chosen", "color": "#abcdef"}},
		},
	})
	require.NoError(t, err)

	linkedSelect, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:       groupID,
		Name:          "linked_select",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
		Attrs: model.StringInterface{
			"options": []any{map[string]any{"id": selectOptionID, "name": "Chosen", "color": "#abcdef"}},
		},
	})
	require.NoError(t, err)

	rankField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "user_rank",
		Type:       model.PropertyFieldTypeRank,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": model.NewId(), "name": "Low", "rank": 1},
				map[string]any{"id": rankOptionID, "name": "High", "rank": 2},
			},
		},
	})
	require.NoError(t, err)

	multiField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "channel_multi",
		Type:       model.PropertyFieldTypeMultiselect,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": multiOptionAID, "name": "Topic A"},
				map[string]any{"id": multiOptionBID, "name": "Topic B"},
			},
		},
	})
	require.NoError(t, err)

	userTarget := model.NewId()
	channelTarget := model.NewId()

	selectValue, err := store.PropertyValue().Create(&model.PropertyValue{
		TargetID: userTarget, TargetType: model.PropertyValueTargetTypeUser,
		GroupID: groupID, FieldID: linkedSelect.ID, Value: []byte(`"` + selectOptionID + `"`),
	})
	require.NoError(t, err)
	rankValue, err := store.PropertyValue().Create(&model.PropertyValue{
		TargetID: userTarget, TargetType: model.PropertyValueTargetTypeUser,
		GroupID: groupID, FieldID: rankField.ID, Value: []byte(`"` + rankOptionID + `"`),
	})
	require.NoError(t, err)
	// Deliberately in the reverse of the option order: a multiselect value keeps
	// the order the value was written in, not the order the options were.
	multiValue, err := store.PropertyValue().Create(&model.PropertyValue{
		TargetID: channelTarget, TargetType: model.PropertyValueTargetTypeChannel,
		GroupID: groupID, FieldID: multiField.ID, Value: []byte(`["` + multiOptionBID + `","` + multiOptionAID + `"]`),
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		store.PropertyValue().Delete(groupID, selectValue.ID)  //nolint:errcheck
		store.PropertyValue().Delete(groupID, rankValue.ID)    //nolint:errcheck
		store.PropertyValue().Delete(groupID, multiValue.ID)   //nolint:errcheck
		store.PropertyField().Delete(groupID, linkedSelect.ID) //nolint:errcheck
		store.PropertyField().Delete(groupID, rankField.ID)    //nolint:errcheck
		store.PropertyField().Delete(groupID, multiField.ID)   //nolint:errcheck
		store.PropertyField().Delete(groupID, template.ID)     //nolint:errcheck
	})

	attributeFor := func(t *testing.T, view, targetID, name string) string {
		t.Helper()
		var out string
		gErr := store.GetMaster().Get(&out,
			"SELECT COALESCE(Attributes->$1, 'null'::jsonb)::text FROM "+view+" WHERE TargetID = $2", name, targetID)
		require.NoError(t, gErr)
		return out
	}

	// assertProjections checks each type's projection: select yields the option
	// name, multiselect an array of names in value order, rank an object of name
	// and rank.
	assertProjections := func(t *testing.T, stage string) {
		t.Helper()
		require.NoError(t, store.Attributes().RefreshAttributes())

		require.Equal(t, `"Chosen"`, attributeFor(t, "UserAttributeView", userTarget, "linked_select"),
			"%s: a select value on a linked field must resolve to the template option's name", stage)
		require.JSONEq(t, `{"name": "High", "rank": 2}`, attributeFor(t, "UserAttributeView", userTarget, "user_rank"),
			"%s: a rank value must resolve to its name and rank", stage)
		require.JSONEq(t, `["Topic B", "Topic A"]`, attributeFor(t, "ChannelAttributeView", channelTarget, "channel_multi"),
			"%s: a multiselect value must resolve to names in value order", stage)
	}

	assertProjections(t, "after migration")

	// A linked field stores none of the options it serves; they belong to the
	// template it links to.
	var ownedByLinked int
	require.NoError(t, store.GetMaster().Get(&ownedByLinked,
		"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1", linkedSelect.ID))
	require.Zero(t, ownedByLinked, "a linked field must not own a copy of its template's options")

	downSQL := readMigrationSQL(t, "000213_move_property_options_to_table.down.sql")
	upSQL := readMigrationSQL(t, "000213_move_property_options_to_table.up.sql")

	// Down: the options go back into every field's own blob, including a copy in
	// each linked field, and the table goes away.
	_, err = store.GetMaster().Exec(downSQL)
	require.NoError(t, err)
	require.False(t, tableExists(t, store, "PropertyOptions"), "down should drop PropertyOptions")

	var blobbedOptions int
	require.NoError(t, store.GetMaster().Get(&blobbedOptions,
		"SELECT jsonb_array_length(Attrs->'options') FROM PropertyFields WHERE ID = $1", linkedSelect.ID))
	require.Equal(t, 1, blobbedOptions, "down should restore the linked field's own copy of the option list")

	assertProjections(t, "after down migration")

	// Up again: this time the backfill reads the blob the down migration wrote,
	// which is the shape a real upgrade starts from.
	_, err = store.GetMaster().Exec(upSQL)
	require.NoError(t, err)
	require.True(t, tableExists(t, store, "PropertyOptions"), "up should recreate PropertyOptions")

	require.NoError(t, store.GetMaster().Get(&ownedByLinked,
		"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1", linkedSelect.ID))
	require.Zero(t, ownedByLinked, "the backfill should leave a linked field's inherited options owned by the template")

	var strippedOptions int
	require.NoError(t, store.GetMaster().Get(&strippedOptions,
		"SELECT COUNT(*) FROM PropertyFields WHERE Type IN ('select', 'multiselect', 'rank') AND Attrs->'options' IS NOT NULL"))
	require.Zero(t, strippedOptions, "up should strip the options key from every option-bearing field")

	assertProjections(t, "after up migration")

	// The option list a field reads back survives the round trip.
	readLinked, err := store.PropertyField().Get(t.Context(), groupID, linkedSelect.ID)
	require.NoError(t, err)
	options, ok := readLinked.Attrs["options"].([]any)
	require.True(t, ok)
	require.Len(t, options, 1)
	require.Equal(t, map[string]any{"id": selectOptionID, "name": "Chosen", "color": "#abcdef"}, options[0])
}
