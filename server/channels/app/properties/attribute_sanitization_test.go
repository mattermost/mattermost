// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAttributeSanitizationHook(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup("test_attr_sanitization")
	require.NoError(t, err)

	hook := NewAttributeSanitizationHook(th.service, group.ID)
	th.service.AddHook(hook)

	t.Run("trims whitespace from text field value", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "text_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"  hello world  "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, "hello world", str)
	})

	t.Run("trims whitespace from date field value", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "date_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeDate,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`" 2024-01-01 "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, "2024-01-01", str)
	})

	t.Run("trims whitespace from select field value", func(t *testing.T) {
		optionID := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "select_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionID, "name": "Option 1"},
				},
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"  ` + optionID + `  "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, optionID, str)
	})

	t.Run("trims whitespace from user field value", func(t *testing.T) {
		userID := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "user_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeUser,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"  ` + userID + `  "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, userID, str)
	})

	t.Run("trims and filters empty strings from multiselect value", func(t *testing.T) {
		optionID1 := model.NewId()
		optionID2 := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiselect_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionID1, "name": "Option 1"},
					map[string]any{"id": optionID2, "name": "Option 2"},
				},
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`["  ` + optionID1 + `  ", "", "   ", "` + optionID2 + `"]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var values []string
		require.NoError(t, json.Unmarshal(result.Value, &values))
		assert.Equal(t, []string{optionID1, optionID2}, values)
	})

	t.Run("trims and filters empty strings from multiuser value", func(t *testing.T) {
		userID1 := model.NewId()
		userID2 := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiuser_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiuser,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`["  ` + userID1 + `  ", "", "` + userID2 + `"]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var values []string
		require.NoError(t, json.Unmarshal(result.Value, &values))
		assert.Equal(t, []string{userID1, userID2}, values)
	})

	t.Run("skips sanitization for unmanaged groups", func(t *testing.T) {
		otherGroup, groupErr := th.service.RegisterPropertyGroup("test_other_sanitize")
		require.NoError(t, groupErr)

		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    otherGroup.ID,
			Name:       "text_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    otherGroup.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"  not trimmed  "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, "  not trimmed  ", str, "unmanaged group values should not be sanitized")
	})

	t.Run("handles empty string becoming empty after trim", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "text_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"   "`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var str string
		require.NoError(t, json.Unmarshal(result.Value, &str))
		assert.Equal(t, "", str)
	})

	t.Run("handles all-empty multiselect becoming empty array", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiselect_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "system",
			ObjectType: "user",
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`["", "   ", ""]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)

		var values []string
		require.NoError(t, json.Unmarshal(result.Value, &values))
		assert.Empty(t, values)
	})
}
