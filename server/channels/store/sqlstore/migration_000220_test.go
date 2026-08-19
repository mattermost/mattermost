// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestMigration000220 pins how a graph-typed property value appears in the two
// attribute views: as the identifiers of the options the object holds, live
// options only, always a JSON array.
//
// Worth pinning even though the array of identifiers is also what the views
// produced before this migration, where a graph value had no branch of its own
// and fell through to the catch-all. That made the projection an accident of
// where the CASE ended, and an accident a later redefinition could undo without
// anyone noticing. The assertions here fail if it is undone, and the down/up
// cycle shows the two behaviours that are not accidental: a deleted option's
// identifier is dropped, and a value that is not an array projects as holding
// nothing.
func TestMigration000220(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	airID := model.NewId()
	jetID := model.NewId()
	retiredID := model.NewId()
	topicAID := model.NewId()
	topicBID := model.NewId()
	selectOptionID := model.NewId()
	rankOptionID := model.NewId()

	// The driving shape for a graph field: one template owns the hierarchy, and
	// the fields that tag users with it link to the template and own no options
	// of their own. The view has to find the options through the link.
	template, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "template_programs",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": airID, "name": "Air Program"},
				map[string]any{"id": jetID, "name": "Fighter Jet Program"},
				map[string]any{"id": retiredID, "name": "Retired Program"},
			},
		},
	})
	require.NoError(t, err)

	userGraph, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:       groupID,
		Name:          "user_programs",
		Type:          model.PropertyFieldTypeGraph,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
	})
	require.NoError(t, err)

	// The other arm of the option lookup: a graph field that owns its options
	// outright, with no template above it.
	channelGraph, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "channel_programs",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": topicAID, "name": "Topic A"},
				map[string]any{"id": topicBID, "name": "Topic B"},
			},
		},
	})
	require.NoError(t, err)

	// The types whose projections this migration must leave alone.
	selectField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "user_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
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

	// Reuses the graph field's option identifiers on purpose: an option
	// identifier is only unique within its field, so a projection that resolved
	// options without scoping them to the field would read this field's names for
	// the graph field's identifiers.
	multiField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "channel_multi",
		Type:       model.PropertyFieldTypeMultiselect,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": topicAID, "name": "Topic A"},
				map[string]any{"id": topicBID, "name": "Topic B"},
			},
		},
	})
	require.NoError(t, err)

	// Three users and two channels, so each degenerate case sits on a target of
	// its own and the views can be read one row at a time.
	holderUser := model.NewId()
	deletedOnlyUser := model.NewId()
	malformedUser := model.NewId()
	holderChannel := model.NewId()
	multiChannel := model.NewId()

	createValue := func(t *testing.T, fieldID, targetID, targetType string, value string) *model.PropertyValue {
		t.Helper()
		pv, cErr := store.PropertyValue().Create(&model.PropertyValue{
			TargetID: targetID, TargetType: targetType,
			GroupID: groupID, FieldID: fieldID, Value: []byte(value),
		})
		require.NoError(t, cErr)
		t.Cleanup(func() {
			store.PropertyValue().Delete(groupID, pv.ID) //nolint:errcheck
		})
		return pv
	}

	// Holds two live options and one that is about to be soft-deleted, in an
	// order that is not the option order, so the projection cannot be passing by
	// coincidence.
	createValue(t, userGraph.ID, holderUser, model.PropertyValueTargetTypeUser, `["`+jetID+`","`+retiredID+`","`+airID+`"]`)
	createValue(t, userGraph.ID, deletedOnlyUser, model.PropertyValueTargetTypeUser, `["`+retiredID+`"]`)
	createValue(t, channelGraph.ID, holderChannel, model.PropertyValueTargetTypeChannel, `["`+topicBID+`"]`)

	createValue(t, selectField.ID, holderUser, model.PropertyValueTargetTypeUser, `"`+selectOptionID+`"`)
	createValue(t, rankField.ID, holderUser, model.PropertyValueTargetTypeUser, `"`+rankOptionID+`"`)
	// Deliberately in the reverse of the option order: a multiselect value keeps
	// the order the value was written in.
	createValue(t, multiField.ID, multiChannel, model.PropertyValueTargetTypeChannel, `["`+topicBID+`","`+topicAID+`"]`)

	// A graph value that is not an array of identifiers, written straight to the
	// table because no write path produces one -- which is the point: the view
	// must not hand a rule something to compare instead of a set to intersect.
	malformedID := model.NewId()
	_, err = store.GetMaster().Exec(
		`INSERT INTO PropertyValues (ID, TargetID, TargetType, GroupID, FieldID, Value, CreateAt, UpdateAt, DeleteAt)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
		malformedID, malformedUser, model.PropertyValueTargetTypeUser, groupID, userGraph.ID,
		`"`+airID+`"`, model.GetMillis(), model.GetMillis())
	require.NoError(t, err)

	// Soft-delete one of the template's options. Its identifier stays in the
	// value that holds it, which is the case the graph branch exists to filter.
	_, err = store.GetMaster().Exec(
		"UPDATE PropertyOptions SET DeleteAt = ? WHERE FieldID = ? AND ID = ?",
		model.GetMillis(), template.ID, retiredID)
	require.NoError(t, err)

	t.Cleanup(func() {
		store.GetMaster().Exec("DELETE FROM PropertyValues WHERE ID = ?", malformedID) //nolint:errcheck
		store.PropertyField().Delete(groupID, multiField.ID)                           //nolint:errcheck
		store.PropertyField().Delete(groupID, rankField.ID)                            //nolint:errcheck
		store.PropertyField().Delete(groupID, selectField.ID)                          //nolint:errcheck
		store.PropertyField().Delete(groupID, channelGraph.ID)                         //nolint:errcheck
		store.PropertyField().Delete(groupID, userGraph.ID)                            //nolint:errcheck
		store.PropertyField().Delete(groupID, template.ID)                             //nolint:errcheck
	})

	attributeFor := func(t *testing.T, view, targetID, name string) string {
		t.Helper()
		var out string
		gErr := store.GetMaster().Get(&out,
			"SELECT COALESCE(Attributes->$1, 'null'::jsonb)::text FROM "+view+" WHERE TargetID = $2", name, targetID)
		require.NoError(t, gErr)
		return out
	}

	// A graph projection is a set, not a sequence: a rule intersects it against
	// the identifiers it was compiled with, and nothing reads its order. So it is
	// compared as a set, and only its being an array is exact.
	assertHeldIDs := func(t *testing.T, view, targetID, name string, expected []string, msg string) {
		t.Helper()
		raw := attributeFor(t, view, targetID, name)
		// The array itself is asserted before its contents, because a JSON null
		// unmarshals into a nil slice that would compare equal to an empty one.
		require.True(t, strings.HasPrefix(raw, "["), "%s: expected a JSON array, got %s", msg, raw)
		var ids []string
		require.NoError(t, json.Unmarshal([]byte(raw), &ids), "%s: expected a JSON array of identifiers, got %s", msg, raw)
		assert.ElementsMatch(t, expected, ids, msg)
	}

	assertOtherTypesUnchanged := func(t *testing.T, stage string) {
		t.Helper()
		assert.Equal(t, `"Chosen"`, attributeFor(t, "UserAttributeView", holderUser, "user_select"),
			"%s: a select value must resolve to its option's name", stage)
		assert.JSONEq(t, `{"name": "High", "rank": 2}`, attributeFor(t, "UserAttributeView", holderUser, "user_rank"),
			"%s: a rank value must resolve to its name and rank", stage)
		assert.JSONEq(t, `["Topic B", "Topic A"]`, attributeFor(t, "ChannelAttributeView", multiChannel, "channel_multi"),
			"%s: a multiselect value must resolve to names in value order", stage)
	}

	// New() applies all migrations, so 000216 is already in effect.
	require.NoError(t, store.Attributes().RefreshAttributes())

	t.Run("a graph value projects the identifiers it holds", func(t *testing.T) {
		// Through the link: the options belong to the template, not to the field
		// the value is attached to.
		assertHeldIDs(t, "UserAttributeView", holderUser, "user_programs", []string{jetID, airID},
			"a graph value must project the identifiers of the live options it holds, and no others")
		// And on a field that owns its own options.
		assertHeldIDs(t, "ChannelAttributeView", holderChannel, "channel_programs", []string{topicBID},
			"a graph field owning its options must project them too")
	})

	t.Run("an option that no longer exists is not projected", func(t *testing.T) {
		assertHeldIDs(t, "UserAttributeView", deletedOnlyUser, "user_programs", []string{},
			"holding only deleted options is holding nothing, and must project an empty array rather than a JSON null")
	})

	t.Run("a value that is not an array projects as holding nothing", func(t *testing.T) {
		assertHeldIDs(t, "UserAttributeView", malformedUser, "user_programs", []string{},
			"a graph value that is not an array must not project the raw value")
	})

	t.Run("every other type projects as before", func(t *testing.T) {
		assertOtherTypesUnchanged(t, "after migration")
	})

	t.Run("the down migration restores the previous projections", func(t *testing.T) {
		_, dErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000220_add_graph_to_attribute_views.down.sql"))
		require.NoError(t, dErr)
		require.NoError(t, store.Attributes().RefreshAttributes())

		// Without the graph branch a graph value falls through to the catch-all
		// again, which projects the stored array as it is: the deleted option's
		// identifier included, and a value that is not an array left alone.
		assertHeldIDs(t, "UserAttributeView", holderUser, "user_programs", []string{jetID, retiredID, airID},
			"the catch-all projection keeps every identifier the value holds")
		assert.Equal(t, `"`+airID+`"`, attributeFor(t, "UserAttributeView", malformedUser, "user_programs"),
			"the catch-all projection passes a non-array value through")
		assertOtherTypesUnchanged(t, "after down migration")

		_, uErr := store.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000220_add_graph_to_attribute_views.up.sql"))
		require.NoError(t, uErr)
		require.NoError(t, store.Attributes().RefreshAttributes())

		assertHeldIDs(t, "UserAttributeView", holderUser, "user_programs", []string{jetID, airID},
			"re-applying the migration filters the deleted option again")
		assertHeldIDs(t, "UserAttributeView", malformedUser, "user_programs", []string{},
			"re-applying the migration stops the non-array value projecting again")
		assertOtherTypesUnchanged(t, "after up migration")
	})
}
