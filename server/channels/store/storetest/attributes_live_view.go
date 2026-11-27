// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// testAttributesStoreLiveViewMatchesMaterializedView is the drift guard for migration 000245:
// GetSubject reads the live views and the bulk readers read the materialized views built on
// them, so after a refresh the two have to hold the same rows. It covers every field type the
// views project, a field linked to a template, a deleted field and a deleted option, for user
// and channel targets, and a target with no values.
func testAttributesStoreLiveViewMatchesMaterializedView(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	group, err := ss.PropertyGroup().Register(&model.PropertyGroup{Name: model.NewId(), Version: model.PropertyGroupVersionV1})
	require.NoError(t, err)
	groupID := group.ID

	var fields []*model.PropertyField
	var values []*model.PropertyValue
	t.Cleanup(func() {
		for _, v := range values {
			require.NoError(t, ss.PropertyValue().Delete(groupID, v.ID))
		}
		for _, f := range fields {
			if f.DeleteAt == 0 {
				require.NoError(t, ss.PropertyField().Delete(groupID, f.ID))
			}
		}
	})

	newField := func(t *testing.T, objectType string, fieldType model.PropertyFieldType, options []any, linkedFieldID string) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       string(fieldType) + "_" + objectType + "_" + model.NewId(),
			Type:       fieldType,
			ObjectType: objectType,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		if options != nil {
			field.Attrs = model.StringInterface{"options": options}
		}
		if linkedFieldID != "" {
			field.LinkedFieldID = &linkedFieldID
		}
		created, cErr := ss.PropertyField().Create(field)
		require.NoError(t, cErr)
		fields = append(fields, created)
		return created
	}

	setValue := func(t *testing.T, targetID, targetType string, field *model.PropertyField, value any) {
		t.Helper()
		raw, mErr := json.Marshal(value)
		require.NoError(t, mErr)
		created, cErr := ss.PropertyValue().Create(&model.PropertyValue{
			TargetID:   targetID,
			TargetType: targetType,
			GroupID:    groupID,
			FieldID:    field.ID,
			Value:      raw,
		})
		require.NoError(t, cErr)
		values = append(values, created)
	}

	// Option-bearing fields, each with one option that is deleted below.
	selectOpt, selectGone := model.NewId(), model.NewId()
	multiOptA, multiOptB, multiGone := model.NewId(), model.NewId(), model.NewId()
	rankLow, rankHigh := model.NewId(), model.NewId()
	graphAir, graphJet, graphGone := model.NewId(), model.NewId(), model.NewId()

	options := func(ids ...string) []any {
		out := make([]any, 0, len(ids))
		for i, id := range ids {
			out = append(out, map[string]any{"id": id, "name": "option " + string(rune('A'+i)), "color": ""})
		}
		return out
	}

	userText := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeText, nil, "")
	userSelect := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeSelect, options(selectOpt, selectGone), "")
	userMulti := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeMultiselect, options(multiOptA, multiOptB, multiGone), "")
	userRank := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeRank, []any{
		map[string]any{"id": rankLow, "name": "Low", "color": "", "rank": 1},
		map[string]any{"id": rankHigh, "name": "High", "color": "", "rank": 2},
	}, "")
	userDeleted := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeText, nil, "")

	// A graph template holds the options; the user and channel fields link to it and hold none.
	template := newField(t, model.PropertyFieldObjectTypeTemplate, model.PropertyFieldTypeGraph, []any{
		map[string]any{"id": graphAir, "name": "Air"},
		map[string]any{"id": graphJet, "name": "Jet", "parents": []string{"Air"}},
		map[string]any{"id": graphGone, "name": "Gone", "parents": []string{"Air"}},
	}, "")
	userGraph := newField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTypeGraph, nil, template.ID)

	channelText := newField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTypeText, nil, "")
	channelMulti := newField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTypeMultiselect, options(multiOptA, multiOptB, multiGone), "")
	channelGraph := newField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTypeGraph, nil, template.ID)

	fullUser, oddUser, channelID, emptyTarget := model.NewId(), model.NewId(), model.NewId(), model.NewId()

	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userText, "engineering")
	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userSelect, selectOpt)
	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userMulti, []string{multiOptB, multiGone, multiOptA})
	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userRank, rankHigh)
	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userGraph, []string{graphJet, graphGone, model.NewId()})
	setValue(t, fullUser, model.PropertyValueTargetTypeUser, userDeleted, "dropped with its field")

	// Values pointing at a deleted option, an empty multiselect and a graph value that is not
	// an array: the shapes that project as null or an empty array.
	setValue(t, oddUser, model.PropertyValueTargetTypeUser, userSelect, selectGone)
	setValue(t, oddUser, model.PropertyValueTargetTypeUser, userMulti, []string{})
	setValue(t, oddUser, model.PropertyValueTargetTypeUser, userRank, rankLow)
	setValue(t, oddUser, model.PropertyValueTargetTypeUser, userGraph, graphAir)

	setValue(t, channelID, model.PropertyValueTargetTypeChannel, channelText, "restricted")
	setValue(t, channelID, model.PropertyValueTargetTypeChannel, channelMulti, []string{multiGone, multiOptA})
	setValue(t, channelID, model.PropertyValueTargetTypeChannel, channelGraph, []string{graphAir, graphGone})

	require.NoError(t, ss.PropertyField().Delete(groupID, userDeleted.ID))
	userDeleted.DeleteAt = model.GetMillis()
	_, err = s.GetMaster().Exec("UPDATE PropertyOptions SET DeleteAt = $1 WHERE ID IN ($2, $3, $4)",
		model.GetMillis(), selectGone, multiGone, graphGone)
	require.NoError(t, err)

	require.NoError(t, ss.Attributes().RefreshAttributes())

	// Rows in one view of the group that the other doesn't hold, compared as whole rows: the
	// Attributes jsonb compares by value, so key order doesn't matter.
	const columns = "GroupID, TargetID, TargetType, Attributes"
	missingFrom := func(t *testing.T, fromView, otherView string) int {
		t.Helper()
		var count int
		require.NoError(t, s.GetMaster().Get(&count,
			"SELECT COUNT(*) FROM (SELECT "+columns+" FROM "+fromView+" WHERE GroupID = $1 EXCEPT ALL SELECT "+columns+" FROM "+otherView+" WHERE GroupID = $1) AS diff",
			groupID))
		return count
	}

	rowCount := func(t *testing.T, view string) int {
		t.Helper()
		var count int
		require.NoError(t, s.GetMaster().Get(&count, "SELECT COUNT(*) FROM "+view+" WHERE GroupID = $1", groupID))
		return count
	}

	for _, pair := range []struct{ live, materialized string }{
		{"UserAttributeLiveView", "UserAttributeView"},
		{"ChannelAttributeLiveView", "ChannelAttributeView"},
	} {
		t.Run(pair.live+" matches "+pair.materialized, func(t *testing.T) {
			require.NotZero(t, rowCount(t, pair.live), "the fixture must give the view rows to compare")
			require.Zero(t, missingFrom(t, pair.live, pair.materialized))
			require.Zero(t, missingFrom(t, pair.materialized, pair.live))
		})
	}

	t.Run("GetSubject returns the projected values", func(t *testing.T) {
		subject, sErr := ss.Attributes().GetSubject(rctx, fullUser, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, sErr)
		require.Equal(t, "engineering", subject.Attributes[userText.Name])
		require.Equal(t, "option A", subject.Attributes[userSelect.Name])
		require.Equal(t, []any{"option B", "option A"}, subject.Attributes[userMulti.Name], "names in value order, deleted option left out")
		require.Equal(t, map[string]any{"name": "High", "rank": float64(2)}, subject.Attributes[userRank.Name])
		require.ElementsMatch(t, []any{graphJet}, subject.Attributes[userGraph.Name], "live options only")
		require.NotContains(t, subject.Attributes, userDeleted.Name, "a deleted field projects nothing")

		odd, sErr := ss.Attributes().GetSubject(rctx, oddUser, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, sErr)
		require.Contains(t, odd.Attributes, userSelect.Name)
		require.Nil(t, odd.Attributes[userSelect.Name], "a deleted option resolves to null")
		require.Nil(t, odd.Attributes[userMulti.Name], "an empty multiselect resolves to null")
		require.Equal(t, []any{}, odd.Attributes[userGraph.Name], "a graph value that is not an array holds nothing")

		channel, sErr := ss.Attributes().GetSubject(rctx, channelID, groupID, model.PropertyFieldObjectTypeChannel)
		require.NoError(t, sErr)
		require.Equal(t, "restricted", channel.Attributes[channelText.Name])
		require.Equal(t, []any{"option A"}, channel.Attributes[channelMulti.Name])
		require.ElementsMatch(t, []any{graphAir}, channel.Attributes[channelGraph.Name])
	})

	t.Run("a target with no values has no row in either view", func(t *testing.T) {
		for _, objectType := range []string{model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypeChannel} {
			_, sErr := ss.Attributes().GetSubject(rctx, emptyTarget, groupID, objectType)
			require.Error(t, sErr)
			require.IsType(t, &store.ErrNotFound{}, sErr)
		}
		for _, view := range []string{"UserAttributeView", "ChannelAttributeView"} {
			var count int
			require.NoError(t, s.GetMaster().Get(&count, "SELECT COUNT(*) FROM "+view+" WHERE TargetID = $1", emptyTarget))
			require.Zero(t, count)
		}
	})

	t.Run("GetSubject sees a write without a refresh", func(t *testing.T) {
		newUser := model.NewId()
		setValue(t, newUser, model.PropertyValueTargetTypeUser, userText, "fresh")

		subject, sErr := ss.Attributes().GetSubject(rctx, newUser, groupID, model.PropertyFieldObjectTypeUser)
		require.NoError(t, sErr)
		require.Equal(t, "fresh", subject.Attributes[userText.Name])

		var count int
		require.NoError(t, s.GetMaster().Get(&count, "SELECT COUNT(*) FROM UserAttributeView WHERE TargetID = $1", newUser))
		require.Zero(t, count, "the materialized view only sees the write after a refresh")
	})
}
