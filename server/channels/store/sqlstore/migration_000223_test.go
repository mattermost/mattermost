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
	"github.com/mattermost/mattermost/server/public/shared/request"
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

// TestMigration000223 verifies the move of field options out of
// PropertyFields.Attrs->'options' and into PropertyOptions, the shape of
// PropertyOptionEdges, and each option-bearing type's projection in the two
// attribute views — including graph, whose values project as the identifiers of
// the live options the object holds.
//
// The property both attribute views depend on is that an option identifier in a
// property value still resolves to that option's name, including through a field
// that only links to the template owning the option — which is the case the
// blob-reading view definitions got for free, because a linked field held its
// own copy of the list. The test drives it through a full down/up cycle: the
// down migration puts the options back in the blob and restores the
// blob-reading view bodies, and the up migration backfills from that blob, so
// the same assertions hold either side and the backfill is exercised on rows
// the store wrote.
func TestMigration000223(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000223 is already in effect.
	require.True(t, tableExists(t, store, "PropertyOptions"), "PropertyOptions should exist after migration")
	require.True(t, tableExists(t, store, "PropertyOptionEdges"), "PropertyOptionEdges should exist after migration")

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	selectOptionID := model.NewId()
	rankOptionID := model.NewId()
	resurrectionOptionID := model.NewId()
	airID := model.NewId()
	jetID := model.NewId()
	retiredID := model.NewId()
	// Shared by the multiselect field and the graph field below on purpose: an
	// option identifier is only unique within its field, so a projection that
	// resolved options without scoping them to the field would read one field's
	// names for the other's identifiers.
	topicAID := model.NewId()
	topicBID := model.NewId()

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

	// A select field that owns its options outright, with no template above it.
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

	// A select field whose one option gets soft-deleted after the upgrade, so
	// down must not resurrect it from a stale blob.
	resurrectionField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "resurrection_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{map[string]any{"id": resurrectionOptionID, "name": "Present"}},
		},
	})
	require.NoError(t, err)

	// The driving shape for a graph field: one template owns the hierarchy, and
	// the fields that tag users with it link to the template and own no options
	// of their own. The view has to find the options through the link.
	graphTemplate, err := store.PropertyField().Create(&model.PropertyField{
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
		LinkedFieldID: &graphTemplate.ID,
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

	// Three users and two channels for the graph cases, so each degenerate case
	// sits on a target of its own and the views can be read one row at a time,
	// plus a user and a channel for the select/rank/multiselect round trip.
	userTarget := model.NewId()
	channelTarget := model.NewId()
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

	createValue(t, linkedSelect.ID, userTarget, model.PropertyValueTargetTypeUser, `"`+selectOptionID+`"`)
	createValue(t, rankField.ID, userTarget, model.PropertyValueTargetTypeUser, `"`+rankOptionID+`"`)
	// Deliberately in the reverse of the option order: a multiselect value keeps
	// the order the value was written in, not the order the options were.
	createValue(t, multiField.ID, channelTarget, model.PropertyValueTargetTypeChannel, `["`+topicBID+`","`+topicAID+`"]`)

	// Holds two live options and one that is about to be soft-deleted, in an
	// order that is not the option order, so the projection cannot be passing by
	// coincidence.
	createValue(t, userGraph.ID, holderUser, model.PropertyValueTargetTypeUser, `["`+jetID+`","`+retiredID+`","`+airID+`"]`)
	createValue(t, userGraph.ID, deletedOnlyUser, model.PropertyValueTargetTypeUser, `["`+retiredID+`"]`)
	createValue(t, channelGraph.ID, holderChannel, model.PropertyValueTargetTypeChannel, `["`+topicBID+`"]`)

	createValue(t, selectField.ID, holderUser, model.PropertyValueTargetTypeUser, `"`+selectOptionID+`"`)
	createValue(t, rankField.ID, holderUser, model.PropertyValueTargetTypeUser, `"`+rankOptionID+`"`)
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
		model.GetMillis(), graphTemplate.ID, retiredID)
	require.NoError(t, err)

	t.Cleanup(func() {
		store.GetMaster().Exec("DELETE FROM PropertyValues WHERE ID = ?", malformedID) //nolint:errcheck
		store.PropertyField().Delete(groupID, multiField.ID)                           //nolint:errcheck
		store.PropertyField().Delete(groupID, rankField.ID)                            //nolint:errcheck
		store.PropertyField().Delete(groupID, selectField.ID)                          //nolint:errcheck
		store.PropertyField().Delete(groupID, channelGraph.ID)                         //nolint:errcheck
		store.PropertyField().Delete(groupID, userGraph.ID)                            //nolint:errcheck
		store.PropertyField().Delete(groupID, graphTemplate.ID)                        //nolint:errcheck
		store.PropertyField().Delete(groupID, linkedSelect.ID)                         //nolint:errcheck
		store.PropertyField().Delete(groupID, template.ID)                             //nolint:errcheck
		store.PropertyField().Delete(groupID, resurrectionField.ID)                    //nolint:errcheck
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

	assertOtherTypesUnchanged := func(t *testing.T, stage string) {
		t.Helper()
		assert.Equal(t, `"Chosen"`, attributeFor(t, "UserAttributeView", holderUser, "user_select"),
			"%s: a select value must resolve to its option's name", stage)
		assert.JSONEq(t, `{"name": "High", "rank": 2}`, attributeFor(t, "UserAttributeView", holderUser, "user_rank"),
			"%s: a rank value must resolve to its name and rank", stage)
		assert.JSONEq(t, `["Topic B", "Topic A"]`, attributeFor(t, "ChannelAttributeView", multiChannel, "channel_multi"),
			"%s: a multiselect value must resolve to names in value order", stage)
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

	indexDefs := func(t *testing.T, table string) map[string]string {
		t.Helper()
		type index struct {
			Indexname string
			Indexdef  string
		}
		rows := []*index{}
		require.NoError(t, store.GetMaster().Select(&rows,
			"SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1", table))

		defs := make(map[string]string, len(rows))
		for _, row := range rows {
			defs[row.Indexname] = row.Indexdef
		}
		return defs
	}

	// assertOptionIndexes pins the two PropertyOptions secondary indexes as
	// present and valid. The migration builds them in its own transaction rather
	// than CONCURRENTLY, so validity is what tells them apart from the leftover
	// of an interrupted concurrent build.
	assertOptionIndexes := func(t *testing.T, stage string) {
		t.Helper()
		defs := indexDefs(t, "propertyoptions")
		assert.Contains(t, defs, "idx_propertyoptions_fieldid_createat_id", "%s: missing the display-order index", stage)
		assert.Contains(t, defs, "idx_propertyoptions_fieldid_name", "%s: missing the name-lookup index", stage)

		var invalid int
		require.NoError(t, store.GetMaster().Get(&invalid, `
			SELECT COUNT(*)
			FROM pg_class c
			JOIN pg_index i ON i.indexrelid = c.oid
			WHERE c.relname IN ('idx_propertyoptions_fieldid_createat_id', 'idx_propertyoptions_fieldid_name')
			  AND NOT i.indisvalid`))
		assert.Zero(t, invalid, "%s: the PropertyOptions indexes must be valid", stage)
	}

	// Both of PropertyOptionEdges' keys lead with FieldID, which is what makes an
	// edge belong to one field's option hierarchy and nothing else, and what lets
	// a walk in either direction stay inside that field.
	edgeDefs := indexDefs(t, "propertyoptionedges")
	require.Len(t, edgeDefs, 2, "the table carries its primary key and one secondary index: %v", edgeDefs)
	// The upward walk, and the identity of an edge.
	assert.Contains(t, edgeDefs["propertyoptionedges_pkey"], "(fieldid, childoptionid, parentoptionid)")
	// The downward walk, and the check for an option's children.
	assert.Contains(t, edgeDefs["idx_propertyoptionedges_fieldid_parent_child"], "(fieldid, parentoptionid, childoptionid)")

	assertOptionIndexes(t, "after migration")

	assertProjections(t, "after migration")

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

	// A linked field stores none of the options it serves; they belong to the
	// template it links to.
	var ownedByLinked int
	require.NoError(t, store.GetMaster().Get(&ownedByLinked,
		"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1", linkedSelect.ID))
	require.Zero(t, ownedByLinked, "a linked field must not own a copy of its template's options")

	insertEdge := func(t *testing.T, fieldID, childID, parentID string) error {
		t.Helper()
		_, iErr := store.GetMaster().Exec(
			"INSERT INTO PropertyOptionEdges (FieldID, ChildOptionID, ParentOptionID, CreateAt) VALUES (?, ?, ?, ?)",
			fieldID, childID, parentID, model.GetMillis())
		return iErr
	}

	t.Run("an edge is identified by its field and both endpoints", func(t *testing.T) {
		fieldID := model.NewId()
		childID := model.NewId()
		parentID := model.NewId()

		require.NoError(t, insertEdge(t, fieldID, childID, parentID))
		require.Error(t, insertEdge(t, fieldID, childID, parentID), "the same edge twice on one field is one edge")

		// The same pair of identifiers on another field is a different edge, not a
		// duplicate: option IDs are unique within a field, not across fields.
		require.NoError(t, insertEdge(t, model.NewId(), childID, parentID))

		// And an option may have more than one parent, which is the whole point of
		// a hierarchy that is not a tree.
		require.NoError(t, insertEdge(t, fieldID, childID, model.NewId()))
	})

	// The state a real upgrade window leaves behind: the blob written by hand
	// because storedFieldAttrs strips it on every store write, and the option
	// row deleted as it would be by an edit made after the upgrade.
	_, err = store.GetMaster().Exec(
		"UPDATE PropertyFields SET Attrs = jsonb_set(COALESCE(Attrs,'{}'::jsonb), '{options}', $1::jsonb, true) WHERE ID = $2",
		`[{"id":"`+resurrectionOptionID+`","name":"Gone"}]`, resurrectionField.ID)
	require.NoError(t, err)
	_, err = store.GetMaster().Exec(
		"UPDATE PropertyOptions SET DeleteAt = 1 WHERE FieldID = $1", resurrectionField.ID)
	require.NoError(t, err)

	downSQL := readMigrationSQL(t, "000223_move_property_options_to_table.down.sql")
	upSQL := readMigrationSQL(t, "000223_move_property_options_to_table.up.sql")

	// sentinelCount reads the backfill's completion sentinel: present exactly
	// when the up migration has run and the down has not.
	sentinelCount := func(t *testing.T) int {
		t.Helper()
		var count int
		require.NoError(t, store.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM Systems WHERE Name = 'PropertyOptionsBackfillComplete'"))
		return count
	}

	// optionsHash fingerprints every PropertyOptions row, so a re-executed
	// backfill can be required to have touched nothing.
	optionsHash := func(t *testing.T) string {
		t.Helper()
		var hash string
		require.NoError(t, store.GetMaster().Get(&hash,
			`SELECT COALESCE(md5(string_agg(FieldID || ID || COALESCE(Name,'') || SortOrder || DeleteAt, '|' ORDER BY FieldID, ID)), '') FROM PropertyOptions`))
		return hash
	}

	// Down: the options go back into every field's own blob, including a copy in
	// each linked field, the blob-reading view bodies come back, and both tables
	// go away.
	_, err = store.GetMaster().ExecNoTimeout(downSQL)
	require.NoError(t, err)
	require.False(t, tableExists(t, store, "PropertyOptions"), "down should drop PropertyOptions")
	require.False(t, tableExists(t, store, "PropertyOptionEdges"), "down should drop PropertyOptionEdges")
	require.Empty(t, indexDefs(t, "propertyoptionedges"))
	require.Zero(t, sentinelCount(t), "down should delete the backfill sentinel so an up after it backfills again")

	var blobbedOptions int
	require.NoError(t, store.GetMaster().Get(&blobbedOptions,
		"SELECT jsonb_array_length(Attrs->'options') FROM PropertyFields WHERE ID = $1", linkedSelect.ID))
	require.Equal(t, 1, blobbedOptions, "down should restore the linked field's own copy of the option list")

	var resurrected int
	require.NoError(t, store.GetMaster().Get(&resurrected,
		"SELECT COUNT(*) FROM PropertyFields WHERE ID = $1 AND Attrs->'options' IS NOT NULL", resurrectionField.ID))
	require.Zero(t, resurrected, "down must not resurrect a deleted option")

	assertProjections(t, "after down migration")

	// Without the graph branch a graph value falls through to the catch-all
	// again, which projects the stored array as it is: the deleted option's
	// identifier included, and a value that is not an array left alone.
	assertHeldIDs(t, "UserAttributeView", holderUser, "user_programs", []string{jetID, retiredID, airID},
		"the catch-all projection keeps every identifier the value holds")
	assert.Equal(t, `"`+airID+`"`, attributeFor(t, "UserAttributeView", malformedUser, "user_programs"),
		"the catch-all projection passes a non-array value through")
	assertOtherTypesUnchanged(t, "after down migration")

	// Up again: this time the backfill reads the blob the down migration wrote,
	// which is the shape a real upgrade starts from.
	_, err = store.GetMaster().ExecNoTimeout(upSQL)
	require.NoError(t, err)
	require.True(t, tableExists(t, store, "PropertyOptions"), "up should recreate PropertyOptions")
	require.True(t, tableExists(t, store, "PropertyOptionEdges"), "up should recreate PropertyOptionEdges")

	require.Len(t, indexDefs(t, "propertyoptionedges"), 2)
	var edgeCount int
	require.NoError(t, store.GetMaster().Get(&edgeCount, "SELECT COUNT(*) FROM PropertyOptionEdges"))
	assert.Zero(t, edgeCount, "the recreated table starts empty")

	assertOptionIndexes(t, "after up migration")

	require.NoError(t, store.GetMaster().Get(&ownedByLinked,
		"SELECT COUNT(*) FROM PropertyOptions WHERE FieldID = $1", linkedSelect.ID))
	require.Zero(t, ownedByLinked, "the backfill should leave a linked field's inherited options owned by the template")

	var blobbedAfterUp int
	require.NoError(t, store.GetMaster().Get(&blobbedAfterUp,
		"SELECT COUNT(*) FROM PropertyFields WHERE GroupID = $1 AND Type IN ('select', 'multiselect', 'rank') AND Attrs->'options' IS NOT NULL", groupID))
	require.Greater(t, blobbedAfterUp, 0, "up must leave the blob in place for nodes that have not upgraded")

	assertProjections(t, "after up migration")

	// The soft-deleted option did not survive the round trip: the down
	// migration's rehydrate skips soft-deleted rows, so the backfill never sees
	// it, and the projection filters to the two live options rather than
	// filtering a row that still exists with DeleteAt set.
	assertHeldIDs(t, "UserAttributeView", holderUser, "user_programs", []string{jetID, airID},
		"re-applying the migration projects the live options only")
	assertHeldIDs(t, "UserAttributeView", malformedUser, "user_programs", []string{},
		"re-applying the migration stops the non-array value projecting again")
	assertOtherTypesUnchanged(t, "after up migration")

	// The up records its completion: exactly one sentinel row.
	require.Equal(t, 1, sentinelCount(t), "up should record the backfill sentinel")

	// Re-executing the up body against a database it has already migrated
	// completes without error and leaves every PropertyOptions row untouched:
	// the sentinel skips the backfill and its postcondition checks whole.
	before := optionsHash(t)
	_, err = store.GetMaster().ExecNoTimeout(upSQL)
	require.NoError(t, err, "re-executing the up migration must not fail")
	require.Equal(t, before, optionsHash(t), "re-executing the up migration must leave every PropertyOptions row untouched")
	require.Equal(t, 1, sentinelCount(t), "re-executing the up migration must not add a second sentinel row")

	// The option list a field reads back survives the round trip.
	readLinked, err := store.PropertyField().Get(request.TestContext(t), groupID, linkedSelect.ID)
	require.NoError(t, err)
	options, ok := readLinked.Attrs["options"].([]any)
	require.True(t, ok)
	require.Len(t, options, 1)
	require.Equal(t, map[string]any{"id": selectOptionID, "name": "Chosen", "color": "#abcdef"}, options[0])
}
