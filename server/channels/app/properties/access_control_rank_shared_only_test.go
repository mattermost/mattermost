// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// rankOptions returns a four-rung classification ladder for rank-field tests.
func rankOptions() []any {
	return []any{
		map[string]any{"id": "opt_public", "name": "Public", "rank": 1},
		map[string]any{"id": "opt_confidential", "name": "Confidential", "rank": 2},
		map[string]any{"id": "opt_secret", "name": "Secret", "rank": 3},
		map[string]any{"id": "opt_topsecret", "name": "TopSecret", "rank": 4},
	}
}

func optionIDsOf(t *testing.T, field *model.PropertyField) []string {
	t.Helper()
	raw, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
	require.True(t, ok, "options should be a slice")
	ids := make([]string, 0, len(raw))
	for _, opt := range raw {
		ids = append(ids, opt.(map[string]any)["id"].(string))
	}
	return ids
}

// TestRankSharedOnly_FieldOptions verifies that a shared_only rank field
// exposes every option at or below the caller's own rank ("everything at your
// rank and lower"), rather than only the exact option the caller holds.
func TestRankSharedOnly_FieldOptions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "test-plugin"
	})

	rctxSource := RequestContextWithCallerID(th.Context, "test-plugin")

	newRankField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		field, err := th.service.CreatePropertyField(rctxSource, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       name,
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:       model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:        true,
				model.PropertyFieldAttributeOptions: rankOptions(),
			},
		})
		require.NoError(t, err)
		return field
	}

	assignRank := func(t *testing.T, fieldID, userID, optionID string) {
		t.Helper()
		v, jsonErr := json.Marshal(optionID)
		require.NoError(t, jsonErr)
		_, err := th.service.CreatePropertyValue(rctxSource, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    fieldID,
			TargetType: "user",
			TargetID:   userID,
			Value:      v,
		})
		require.NoError(t, err)
	}

	t.Run("caller at a middle rank sees their rank and below", func(t *testing.T) {
		field := newRankField(t, "clearance-middle")
		userID := model.NewId()
		assignRank(t, field.ID, userID, "opt_secret") // rank 2

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		ids := optionIDsOf(t, retrieved)
		assert.ElementsMatch(t, []string{"opt_public", "opt_confidential", "opt_secret"}, ids,
			"caller at Secret should see Public, Confidential, Secret but not TopSecret")
	})

	t.Run("caller at the top rank sees every option", func(t *testing.T) {
		field := newRankField(t, "clearance-top")
		userID := model.NewId()
		assignRank(t, field.ID, userID, "opt_topsecret") // rank 3

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		ids := optionIDsOf(t, retrieved)
		assert.ElementsMatch(t, []string{"opt_public", "opt_confidential", "opt_secret", "opt_topsecret"}, ids)
	})

	t.Run("caller at the lowest rank sees only that rank", func(t *testing.T) {
		field := newRankField(t, "clearance-bottom")
		userID := model.NewId()
		assignRank(t, field.ID, userID, "opt_public") // rank 1

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		ids := optionIDsOf(t, retrieved)
		assert.ElementsMatch(t, []string{"opt_public"}, ids)
	})

	t.Run("caller with no value sees no options", func(t *testing.T) {
		field := newRankField(t, "clearance-none")
		userID := model.NewId() // never assigned a value

		retrieved, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, userID), th.CPAGroupID, field.ID)
		require.NoError(t, err)
		assert.Empty(t, optionIDsOf(t, retrieved))
	})

	t.Run("source plugin sees all options regardless of rank", func(t *testing.T) {
		field := newRankField(t, "clearance-source")

		retrieved, err := th.service.GetPropertyField(rctxSource, th.CPAGroupID, field.ID)
		require.NoError(t, err)
		ids := optionIDsOf(t, retrieved)
		assert.ElementsMatch(t, []string{"opt_public", "opt_confidential", "opt_secret", "opt_topsecret"}, ids)
	})
}

// TestRankSharedOnly_Value verifies that a shared_only rank field exposes a
// target's value to a caller whose own rank is at or above the target's rank,
// rather than only on an exact rank match.
func TestRankSharedOnly_Value(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "test-plugin"
	})

	rctxSource := RequestContextWithCallerID(th.Context, "test-plugin")

	field, err := th.service.CreatePropertyField(rctxSource, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "clearance-value",
		Type:       model.PropertyFieldTypeRank,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode:       model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:        true,
			model.PropertyFieldAttributeOptions: rankOptions(),
		},
	})
	require.NoError(t, err)

	assignRank := func(t *testing.T, userID, optionID string) *model.PropertyValue {
		t.Helper()
		v, jsonErr := json.Marshal(optionID)
		require.NoError(t, jsonErr)
		pv, createErr := th.service.CreatePropertyValue(rctxSource, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      v,
		})
		require.NoError(t, createErr)
		return pv
	}

	// The caller holds Secret (rank 2).
	callerID := model.NewId()
	assignRank(t, callerID, "opt_secret")
	rctxCaller := RequestContextWithCallerID(th.Context, callerID)

	t.Run("target below caller's rank is visible", func(t *testing.T) {
		target := assignRank(t, model.NewId(), "opt_confidential") // rank 1
		retrieved, getErr := th.service.GetPropertyValue(rctxCaller, th.CPAGroupID, target.ID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		assert.Equal(t, target.Value, retrieved.Value)
	})

	t.Run("target at caller's rank is visible", func(t *testing.T) {
		target := assignRank(t, model.NewId(), "opt_secret") // rank 2
		retrieved, getErr := th.service.GetPropertyValue(rctxCaller, th.CPAGroupID, target.ID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)
		assert.Equal(t, target.Value, retrieved.Value)
	})

	t.Run("target above caller's rank is clamped to the caller's rank", func(t *testing.T) {
		target := assignRank(t, model.NewId(), "opt_topsecret") // rank 3
		retrieved, getErr := th.service.GetPropertyValue(rctxCaller, th.CPAGroupID, target.ID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)

		expected, jsonErr := json.Marshal("opt_secret") // caller holds Secret (rank 2)
		require.NoError(t, jsonErr)
		assert.Equal(t, json.RawMessage(expected), retrieved.Value,
			"caller at Secret viewing a TopSecret target should see the value clamped to Secret, the highest rank they share")
	})

	t.Run("caller with no value of their own sees nothing", func(t *testing.T) {
		target := assignRank(t, model.NewId(), "opt_public") // rank 1, the lowest
		noRankCaller := RequestContextWithCallerID(th.Context, model.NewId())
		retrieved, getErr := th.service.GetPropertyValue(noRankCaller, th.CPAGroupID, target.ID)
		require.NoError(t, getErr)
		assert.Nil(t, retrieved)
	})
}
