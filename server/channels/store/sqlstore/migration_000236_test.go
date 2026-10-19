// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// legacyCompatMigrations are the migrations that keep servers from before
// 000216 working against this schema, in the order they apply.
var legacyCompatMigrations = []string{
	"000236_create_legacy_attribute_view",
	"000237_create_legacy_option_write_guard",
}

// withoutLegacyCompat reverts legacyCompatMigrations and returns a function
// that re-applies them, for a test that recreates the state of an earlier
// migration. They have to come off first, the way a real downgrade would take
// them off: AttributeView depends on PropertyOptions, and the write guard
// refuses the option blobs that the earlier state is made of.
//
// Restoring is left to the caller, as a defer, rather than to t.Cleanup:
// cleanups run after the test's deferred store.Close.
func withoutLegacyCompat(t *testing.T, s *SqlStore) func() {
	t.Helper()
	for _, name := range slices.Backward(legacyCompatMigrations) {
		_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, name+".down.sql"))
		require.NoError(t, err, "reverting %s", name)
	}
	return func() {
		for _, name := range legacyCompatMigrations {
			_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, name+".up.sql"))
			assert.NoError(t, err, "re-applying %s", name)
		}
	}
}

// TestMigration000236 verifies the AttributeView kept for servers from before
// 000216: that it exists alongside the per-object-type views, that an 11.10
// server's refresh of it succeeds, and that it resolves every option-bearing
// type from PropertyOptions -- including through a field that links to a
// template, which holds no options of its own -- exactly as UserAttributeView
// does.
func TestMigration000236(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	// New() applies all migrations, so 000236 is already in effect.
	require.True(t, matviewExists(t, store, "AttributeView"), "AttributeView should exist after migration")
	require.True(t, matviewExists(t, store, "UserAttributeView"), "UserAttributeView should still exist")
	require.True(t, matviewExists(t, store, "ChannelAttributeView"), "ChannelAttributeView should still exist")

	group, err := store.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	chosenID := model.NewId()
	highID := model.NewId()
	topicAID := model.NewId()
	topicBID := model.NewId()

	template, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "template_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{map[string]any{"id": chosenID, "name": "Chosen"}},
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
				map[string]any{"id": highID, "name": "High", "rank": 2},
			},
		},
	})
	require.NoError(t, err)

	multiField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "user_multi",
		Type:       model.PropertyFieldTypeMultiselect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			"options": []any{
				map[string]any{"id": topicAID, "name": "Topic A"},
				map[string]any{"id": topicBID, "name": "Topic B"},
			},
		},
	})
	require.NoError(t, err)

	textField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "user_text",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)

	channelField, err := store.PropertyField().Create(&model.PropertyField{
		GroupID:    groupID,
		Name:       "channel_text",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})
	require.NoError(t, err)

	userTarget := model.NewId()
	channelTarget := model.NewId()

	createValue := func(t *testing.T, fieldID, targetID, targetType, value string) {
		t.Helper()
		pv, cErr := store.PropertyValue().Create(&model.PropertyValue{
			TargetID: targetID, TargetType: targetType,
			GroupID: groupID, FieldID: fieldID, Value: []byte(value),
		})
		require.NoError(t, cErr)
		t.Cleanup(func() {
			store.PropertyValue().Delete(groupID, pv.ID) //nolint:errcheck
		})
	}

	createValue(t, linkedSelect.ID, userTarget, model.PropertyValueTargetTypeUser, `"`+chosenID+`"`)
	createValue(t, rankField.ID, userTarget, model.PropertyValueTargetTypeUser, `"`+highID+`"`)
	createValue(t, multiField.ID, userTarget, model.PropertyValueTargetTypeUser, `["`+topicBID+`","`+topicAID+`"]`)
	createValue(t, textField.ID, userTarget, model.PropertyValueTargetTypeUser, `"hello"`)
	createValue(t, channelField.ID, channelTarget, model.PropertyValueTargetTypeChannel, `"secret"`)

	t.Cleanup(func() {
		store.PropertyField().Delete(groupID, channelField.ID) //nolint:errcheck
		store.PropertyField().Delete(groupID, textField.ID)    //nolint:errcheck
		store.PropertyField().Delete(groupID, multiField.ID)   //nolint:errcheck
		store.PropertyField().Delete(groupID, rankField.ID)    //nolint:errcheck
		store.PropertyField().Delete(groupID, linkedSelect.ID) //nolint:errcheck
		store.PropertyField().Delete(groupID, template.ID)     //nolint:errcheck
	})

	attributesIn := func(t *testing.T, view, targetID string) string {
		t.Helper()
		var out string
		require.NoError(t, store.GetMaster().Get(&out,
			"SELECT Attributes::text FROM "+view+" WHERE TargetID = $1", targetID))
		return out
	}

	countIn := func(t *testing.T, view, targetID string) int {
		t.Helper()
		var count int
		require.NoError(t, store.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM "+view+" WHERE TargetID = $1", targetID))
		return count
	}

	assertLegacyView := func(t *testing.T, stage string) {
		t.Helper()
		// Exactly the statement an 11.10 server issues.
		_, rErr := store.GetMaster().Exec("REFRESH MATERIALIZED VIEW AttributeView")
		require.NoError(t, rErr, "%s: refreshing AttributeView must succeed", stage)
		require.NoError(t, store.Attributes().RefreshAttributes())

		require.JSONEq(t, `{
			"linked_select": "Chosen",
			"user_rank": {"name": "High", "rank": 2},
			"user_multi": ["Topic B", "Topic A"],
			"user_text": "hello"
		}`, attributesIn(t, "AttributeView", userTarget),
			"%s: AttributeView must resolve every option-bearing type from PropertyOptions", stage)
		require.JSONEq(t, attributesIn(t, "UserAttributeView", userTarget), attributesIn(t, "AttributeView", userTarget),
			"%s: AttributeView must agree with UserAttributeView", stage)
		require.Zero(t, countIn(t, "AttributeView", channelTarget),
			"%s: AttributeView must hold user attributes only", stage)
	}

	assertLegacyView(t, "after migration")

	// An option renamed on an upgraded server reaches the legacy view on its
	// next refresh: the rows are the only copy upgraded code keeps current.
	_, err = store.GetMaster().Exec(
		"UPDATE PropertyOptions SET Name = 'Renamed' WHERE FieldID = $1 AND ID = $2", template.ID, chosenID)
	require.NoError(t, err)
	_, err = store.GetMaster().Exec("REFRESH MATERIALIZED VIEW AttributeView")
	require.NoError(t, err)
	var linked string
	require.NoError(t, store.GetMaster().Get(&linked,
		"SELECT (Attributes->'linked_select')::text FROM AttributeView WHERE TargetID = $1", userTarget))
	require.Equal(t, `"Renamed"`, linked, "AttributeView must read option names from PropertyOptions")
	_, err = store.GetMaster().Exec(
		"UPDATE PropertyOptions SET Name = 'Chosen' WHERE FieldID = $1 AND ID = $2", template.ID, chosenID)
	require.NoError(t, err)

	downSQL := readMigrationSQL(t, "000236_create_legacy_attribute_view.down.sql")
	upSQL := readMigrationSQL(t, "000236_create_legacy_attribute_view.up.sql")

	_, err = store.GetMaster().ExecNoTimeout(downSQL)
	require.NoError(t, err, "down migration should succeed")
	require.False(t, matviewExists(t, store, "AttributeView"), "down should drop AttributeView")
	require.True(t, matviewExists(t, store, "UserAttributeView"), "down must leave UserAttributeView alone")

	_, err = store.GetMaster().ExecNoTimeout(upSQL)
	require.NoError(t, err, "up migration should be re-appliable")
	assertLegacyView(t, "after up migration")

	_, err = store.GetMaster().ExecNoTimeout(upSQL)
	require.NoError(t, err, "re-executing the up migration must not fail")
}
