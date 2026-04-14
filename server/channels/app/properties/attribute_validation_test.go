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

func TestAttributeValidationHook(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup("test_attr_validation")
	require.NoError(t, err)

	hook := NewAttributeValidationHook(th.service, group.ID)
	th.service.AddHook(hook)

	t.Run("allows valid visibility on create", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttrVisibility: "always"},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("rejects invalid visibility on create", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttrVisibility: "public"},
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "visibility")
	})

	t.Run("rejects non-numeric sort_order on create", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttrSortOrder: "not_a_number"},
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "sort_order")
	})

	t.Run("allows numeric sort_order on create", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttrSortOrder: float64(1.5)},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("rejects invalid visibility on update", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Attrs = model.StringInterface{model.PropertyFieldAttrVisibility: "bad"}
		_, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "visibility")
	})

	t.Run("skips validation for unmanaged groups", func(t *testing.T) {
		otherGroup, groupErr := th.service.RegisterPropertyGroup("test_other_group")
		require.NoError(t, groupErr)

		field := &model.PropertyField{
			GroupID:    otherGroup.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttrVisibility: "invalid_but_ignored"},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("validates value_type on upsert — rejects invalid email", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "email_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrValueType: "email",
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"not-an-email"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "email")
	})

	t.Run("validates value_type on upsert — accepts valid email", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "email_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrValueType: "email",
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"test@example.com"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("skips value_type validation for non-text fields", func(t *testing.T) {
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
			Value:      json.RawMessage(`"2024-01-01"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("allows empty value even with value_type", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "email_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrValueType: "email",
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`""`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})
}
