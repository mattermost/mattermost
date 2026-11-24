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
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// withMaterializedAttributeViews reverts 000245, for tests that replay earlier
// migrations written against the UserAttributeView and ChannelAttributeView
// materialized views, and returns a function that re-applies it. Restore as a
// defer, as with withoutLegacyAttributeView.
func withMaterializedAttributeViews(t *testing.T, s *SqlStore) func() {
	t.Helper()
	_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000245_drop_attribute_views.down.sql"))
	require.NoError(t, err, "reverting 000245")
	return func() {
		_, err := s.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000245_drop_attribute_views.up.sql"))
		assert.NoError(t, err, "re-applying 000245")
	}
}

// refreshAttributeMatviews refreshes the views withMaterializedAttributeViews
// puts back, which RefreshAttributes no longer does.
func refreshAttributeMatviews(t *testing.T, s *SqlStore) {
	t.Helper()
	for _, view := range []string{"UserAttributeView", "ChannelAttributeView"} {
		_, err := s.GetMaster().Exec("REFRESH MATERIALIZED VIEW " + view)
		require.NoError(t, err, "refreshing %s", view)
	}
}

// TestMigration000245 verifies that the attribute views are gone, that the down
// migration puts them back, and that the store's projection matches theirs for
// every field type: options resolved through the field's own and its template's
// live options, deleted values and fields left out, and each object type read on
// its own.
func TestMigration000245(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	ss, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer ss.Close()

	views := []string{"UserAttributeView", "ChannelAttributeView"}

	// New() applies all migrations, so 000245 is already in effect.
	for _, view := range views {
		require.False(t, matviewExists(t, ss, view), "%s should be dropped", view)
	}
	require.True(t, matviewExists(t, ss, "AttributeView"), "the legacy AttributeView should stay")

	group, err := ss.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	createField := func(t *testing.T, field *model.PropertyField) *model.PropertyField {
		t.Helper()
		field.GroupID = groupID
		field.TargetType = string(model.PropertyFieldTargetLevelSystem)
		created, cErr := ss.PropertyField().Create(field)
		require.NoError(t, cErr)
		return created
	}
	options := func(ids ...string) model.StringInterface {
		list := make([]any, 0, len(ids))
		for _, id := range ids {
			list = append(list, map[string]any{"id": id, "name": "Option " + id})
		}
		return model.StringInterface{"options": list}
	}

	selectID, rankID, multiA, multiB, deadID, graphA, graphB := model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId()
	template := createField(t, &model.PropertyField{Name: "template", Type: model.PropertyFieldTypeSelect, ObjectType: model.PropertyFieldObjectTypeTemplate, Attrs: options(selectID)})
	graphTemplate := createField(t, &model.PropertyField{Name: "graph_template", Type: model.PropertyFieldTypeGraph, ObjectType: model.PropertyFieldObjectTypeTemplate, Attrs: options(graphA, graphB, deadID)})
	linkedSelect := createField(t, &model.PropertyField{Name: "linked_select", Type: model.PropertyFieldTypeSelect, ObjectType: model.PropertyFieldObjectTypeUser, LinkedFieldID: &template.ID})
	rank := createField(t, &model.PropertyField{Name: "rank", Type: model.PropertyFieldTypeRank, ObjectType: model.PropertyFieldObjectTypeUser, Attrs: model.StringInterface{
		"options": []any{map[string]any{"id": rankID, "name": "Option " + rankID, "rank": 1}},
	}})
	multi := createField(t, &model.PropertyField{Name: "multi", Type: model.PropertyFieldTypeMultiselect, ObjectType: model.PropertyFieldObjectTypeUser, Attrs: options(multiA, multiB, deadID)})
	deadMulti := createField(t, &model.PropertyField{Name: "dead_multi", Type: model.PropertyFieldTypeMultiselect, ObjectType: model.PropertyFieldObjectTypeUser, Attrs: options(deadID)})
	linkedGraph := createField(t, &model.PropertyField{Name: "graph", Type: model.PropertyFieldTypeGraph, ObjectType: model.PropertyFieldObjectTypeUser, LinkedFieldID: &graphTemplate.ID})
	malformedGraph := createField(t, &model.PropertyField{Name: "malformed_graph", Type: model.PropertyFieldTypeGraph, ObjectType: model.PropertyFieldObjectTypeUser, LinkedFieldID: &graphTemplate.ID})
	text := createField(t, &model.PropertyField{Name: "text", Type: model.PropertyFieldTypeText, ObjectType: model.PropertyFieldObjectTypeUser})
	deletedField := createField(t, &model.PropertyField{Name: "deleted_field", Type: model.PropertyFieldTypeText, ObjectType: model.PropertyFieldObjectTypeUser})
	channelGraph := createField(t, &model.PropertyField{Name: "channel_graph", Type: model.PropertyFieldTypeGraph, ObjectType: model.PropertyFieldObjectTypeChannel, Attrs: options(graphA, deadID)})
	channelText := createField(t, &model.PropertyField{Name: "channel_text", Type: model.PropertyFieldTypeText, ObjectType: model.PropertyFieldObjectTypeChannel})

	userTarget, channelTarget := model.NewId(), model.NewId()
	createValue := func(t *testing.T, field *model.PropertyField, targetID, value string) *model.PropertyValue {
		t.Helper()
		targetType := model.PropertyValueTargetTypeUser
		if field.ObjectType == model.PropertyFieldObjectTypeChannel {
			targetType = model.PropertyValueTargetTypeChannel
		}
		pv, cErr := ss.PropertyValue().Create(&model.PropertyValue{
			TargetID: targetID, TargetType: targetType, GroupID: groupID, FieldID: field.ID, Value: []byte(value),
		})
		require.NoError(t, cErr)
		return pv
	}
	createValue(t, linkedSelect, userTarget, `"`+selectID+`"`)
	createValue(t, rank, userTarget, `"`+rankID+`"`)
	createValue(t, multi, userTarget, `["`+multiB+`","`+deadID+`","`+multiA+`"]`)
	createValue(t, deadMulti, userTarget, `["`+deadID+`"]`)
	createValue(t, linkedGraph, userTarget, `["`+graphB+`","`+deadID+`","`+graphA+`"]`)
	createValue(t, malformedGraph, userTarget, `"`+graphA+`"`)
	createValue(t, text, userTarget, `"hello"`)
	createValue(t, deletedField, userTarget, `"gone"`)
	createValue(t, channelGraph, channelTarget, `["`+deadID+`","`+graphA+`"]`)
	deletedValue := createValue(t, channelText, channelTarget, `"gone"`)

	_, err = ss.GetMaster().Exec("UPDATE PropertyOptions SET DeleteAt = 1 WHERE ID = $1", deadID)
	require.NoError(t, err)
	_, err = ss.GetMaster().Exec("UPDATE PropertyFields SET DeleteAt = 1 WHERE ID = $1", deletedField.ID)
	require.NoError(t, err)
	require.NoError(t, ss.PropertyValue().Delete(groupID, deletedValue.ID))

	subjectJSON := func(t *testing.T, targetID, objectType string) string {
		t.Helper()
		subject, gErr := ss.Attributes().GetSubject(request.TestContext(t), targetID, groupID, objectType)
		require.NoError(t, gErr)
		b, mErr := json.Marshal(subject.Attributes)
		require.NoError(t, mErr)
		return string(b)
	}
	userJSON := subjectJSON(t, userTarget, model.PropertyFieldObjectTypeUser)
	require.JSONEq(t, `{
		"linked_select": "Option `+selectID+`",
		"rank": {"name": "Option `+rankID+`", "rank": 1},
		"multi": ["Option `+multiB+`", "Option `+multiA+`"],
		"dead_multi": null,
		"graph": ["`+graphB+`", "`+graphA+`"],
		"malformed_graph": [],
		"text": "hello"
	}`, userJSON)
	channelJSON := subjectJSON(t, channelTarget, model.PropertyFieldObjectTypeChannel)
	require.JSONEq(t, `{"channel_graph": ["`+graphA+`"]}`, channelJSON)
	_, err = ss.Attributes().GetSubject(request.TestContext(t), channelTarget, groupID, model.PropertyFieldObjectTypeUser)
	require.IsType(t, &store.ErrNotFound{}, err, "a user read must not see channel attributes")

	_, err = ss.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000245_drop_attribute_views.down.sql"))
	require.NoError(t, err)
	for _, view := range views {
		require.True(t, matviewExists(t, ss, view), "down should restore %s", view)
	}
	viewJSON := func(t *testing.T, view, targetID string) string {
		t.Helper()
		var out string
		require.NoError(t, ss.GetMaster().Get(&out,
			"SELECT Attributes::text FROM "+view+" WHERE TargetID = $1 AND GroupID = $2", targetID, groupID))
		return out
	}
	require.JSONEq(t, viewJSON(t, "UserAttributeView", userTarget), userJSON, "the store must project users as the view did")
	require.JSONEq(t, viewJSON(t, "ChannelAttributeView", channelTarget), channelJSON, "the store must project channels as the view did")

	_, err = ss.GetMaster().ExecNoTimeout(readMigrationSQL(t, "000245_drop_attribute_views.up.sql"))
	require.NoError(t, err)
	for _, view := range views {
		require.False(t, matviewExists(t, ss, view), "up should drop %s", view)
	}
}
