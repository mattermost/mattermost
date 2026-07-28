// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAccessControlAttributeValidationHook(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_attr_validation", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	hook := NewAccessControlAttributeValidationHook(th.service, nil, group.ID)
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
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "visibility")
	})

	t.Run("skips validation for unmanaged groups", func(t *testing.T) {
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_other_group", Version: model.PropertyGroupVersionV2})
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

	// Select field validation tests

	t.Run("select — accepts valid option ID", func(t *testing.T) {
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
			Value:      json.RawMessage(`"` + optionID + `"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("select — rejects non-existent option ID", func(t *testing.T) {
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
			Value:      json.RawMessage(`"` + model.NewId() + `"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "does not exist")
	})

	t.Run("select — allows empty string value", func(t *testing.T) {
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
			Value:      json.RawMessage(`""`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	// Multiselect field validation tests

	t.Run("multiselect — accepts valid option IDs", func(t *testing.T) {
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
			Value:      json.RawMessage(`["` + optionID1 + `","` + optionID2 + `"]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("multiselect — rejects if any option ID is invalid", func(t *testing.T) {
		optionID1 := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiselect_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionID1, "name": "Option 1"},
				},
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`["` + optionID1 + `","` + model.NewId() + `"]`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "does not exist")
	})

	t.Run("multiselect — accepts empty array", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiselect_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option 1"},
				},
			},
		})

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`[]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	// User field validation tests

	t.Run("user — accepts valid user ID", func(t *testing.T) {
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
			Value:      json.RawMessage(`"` + userID + `"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("user — rejects invalid user ID format", func(t *testing.T) {
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
			Value:      json.RawMessage(`"not-a-valid-id"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "invalid user id")
	})

	t.Run("user — allows empty string", func(t *testing.T) {
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
			Value:      json.RawMessage(`""`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	// Multiuser field validation tests

	t.Run("multiuser — accepts valid user IDs", func(t *testing.T) {
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
			Value:      json.RawMessage(`["` + userID1 + `","` + userID2 + `"]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("multiuser — rejects if any user ID is invalid", func(t *testing.T) {
		validID := model.NewId()
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
			Value:      json.RawMessage(`["` + validID + `","bad-id"]`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "invalid user id")
	})

	t.Run("multiuser — accepts empty array", func(t *testing.T) {
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
			Value:      json.RawMessage(`[]`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	// Edge case: select with wrong JSON type

	t.Run("select — rejects non-string JSON value", func(t *testing.T) {
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
			Value:      json.RawMessage(`123`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "expected string value")
	})

	t.Run("multiselect — rejects non-array JSON value", func(t *testing.T) {
		optionID := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "multiselect_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
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
			Value:      json.RawMessage(`"not-an-array"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "expected string array")
	})

	t.Run("upsert with unknown field id returns ErrFieldNotFound", func(t *testing.T) {
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    model.NewId(),
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"anything"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.ErrorIs(t, upsertErr, ErrFieldNotFound)
		var resultsMismatchErr *store.ErrResultsMismatch
		assert.ErrorAs(t, upsertErr, &resultsMismatchErr, "original store error should remain in chain")
	})

	// Group permission enforcement tests
	//
	// These tests run with the hook configured with a nil permissionChecker
	// (see the Setup block at the top of this test function). In that
	// configuration, managed="admin" is default-denied since there is no
	// way to verify the caller's admin status. The "allowed" side of the
	// authorization matrix is covered in TestAccessControlAttributeValidationHookManagedAuthorization.

	t.Run("create field with managed=admin is rejected when no permission checker is configured", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "managed=admin")
	})

	t.Run("create field without managed sets PermissionValues to member", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		require.NotNil(t, created.PermissionValues)
		assert.Equal(t, model.PermissionLevelMember, *created.PermissionValues)
		require.NotNil(t, created.PermissionField)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionField)
		require.NotNil(t, created.PermissionOptions)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionOptions)
	})

	t.Run("update field to managed=admin is rejected when no permission checker is configured", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{},
		})

		field.Attrs = model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsManaged: "admin",
		}
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "managed=admin")
	})

	t.Run("update field to remove managed sets PermissionValues to member", func(t *testing.T) {
		member := model.PermissionLevelMember
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:          group.ID,
			Name:             "field_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			TargetType:       "system",
			ObjectType:       "user",
			PermissionValues: &member,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		})

		field.Attrs = model.StringInterface{}
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, updateErr)
		require.NotNil(t, updated.PermissionValues)
		assert.Equal(t, model.PermissionLevelMember, *updated.PermissionValues)
	})

	t.Run("sanitization on create: defaults visibility to when_set", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.Equal(t, model.CustomProfileAttributesVisibilityWhenSet, created.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("sanitization on create: trims display_name and rejects when too long", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsDisplayName: "  Department Head  ",
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.Equal(t, "Department Head", created.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName])

		// Build a 256-rune string — exceeds the 255-rune cap (PropertyFieldNameMaxRunes).
		tooLong := strings.Repeat("a", model.PropertyFieldNameMaxRunes+1)
		bad := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.CustomProfileAttributesPropertyAttrsDisplayName: tooLong},
		}
		_, badErr := th.service.CreatePropertyField(th.Context, bad)
		require.Error(t, badErr)
		assert.Contains(t, badErr.Error(), "display_name")
	})

	t.Run("sanitization on update: rejects display_name longer than max", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Attrs = model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsDisplayName: strings.Repeat("a", model.PropertyFieldNameMaxRunes+1),
		}
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "display_name")
	})

	t.Run("sanitization on update: rejects unknown value_type on text field", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Attrs = model.StringInterface{model.PropertyFieldAttrValueType: "wat"}
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "value_type")
	})

	t.Run("sanitization on update: rejects unknown managed value", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Attrs = model.StringInterface{model.PropertyFieldAttrManaged: "kinda"}
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "managed")
	})

	t.Run("name validation on create: rejects non-CEL identifier", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "Has Space",
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		var appErr *model.AppError
		require.ErrorAs(t, createErr, &appErr)
		assert.Equal(t, "model.cpa_field.name.invalid_charset.app_error", appErr.Id)
	})

	t.Run("name validation on create: rejects CEL reserved word", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "for",
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		var appErr *model.AppError
		require.ErrorAs(t, createErr, &appErr)
		assert.Equal(t, "model.cpa_field.name.reserved_word.app_error", appErr.Id)
	})

	t.Run("name validation on create: accepts CEL-safe identifier", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "department_head",
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.Equal(t, "department_head", created.Name)
	})

	t.Run("name validation on update: lenient grandfather lets non-conforming name through when unchanged", func(t *testing.T) {
		// Direct store insert bypasses the hook so we can seed a name that
		// would fail current validation, simulating a field that predates it.
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "legacy name",
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		// Patch a different attr without touching Name — should succeed.
		field.Attrs = model.StringInterface{model.PropertyFieldAttrVisibility: "always"}
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, updateErr)
		assert.Equal(t, "legacy name", updated.Name)
	})

	t.Run("name validation on update: rejects rename to non-CEL identifier", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "good_name_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Name = "Bad Name"
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		var appErr *model.AppError
		require.ErrorAs(t, updateErr, &appErr)
		assert.Equal(t, "model.cpa_field.name.invalid_charset.app_error", appErr.Id)
	})

	t.Run("name validation on update: rejects rename to CEL reserved word", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "good_name_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		field.Name = "in"
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.Error(t, updateErr)
		var appErr *model.AppError
		require.ErrorAs(t, updateErr, &appErr)
		assert.Equal(t, "model.cpa_field.name.reserved_word.app_error", appErr.Id)
	})

	t.Run("name validation on update: accepts rename to CEL-safe identifier", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "old_name_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		newName := "new_name_" + model.NewId()
		field.Name = newName
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		require.NoError(t, updateErr)
		assert.Equal(t, newName, updated.Name)
	})

	t.Run("name validation on batch update: lenient grandfather applies per-field", func(t *testing.T) {
		grandfathered := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "still legacy",
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})
		renamable := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "rename_src_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		// Touch grandfathered without renaming; rename renamable to a CEL-safe
		// name. Both should be accepted.
		grandfathered.Attrs = model.StringInterface{model.PropertyFieldAttrVisibility: "hidden"}
		newName := "rename_dst_" + model.NewId()
		renamable.Name = newName
		_, _, _, updateErr := th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{grandfathered, renamable})
		require.NoError(t, updateErr)
	})

	t.Run("name validation on batch update: one bad rename rejects the batch", func(t *testing.T) {
		ok := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "ok_src_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})
		bad := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "bad_src_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		ok.Name = "ok_dst_" + model.NewId()
		bad.Name = "for" // CEL reserved word
		_, _, _, updateErr := th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{ok, bad})
		require.Error(t, updateErr)
		var appErr *model.AppError
		require.ErrorAs(t, updateErr, &appErr)
		assert.Equal(t, "model.cpa_field.name.reserved_word.app_error", appErr.Id)
	})

	t.Run("text — rejects value exceeding max length", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "text_field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
		})

		// Create a string longer than PropertyFieldValueTypeTextMaxLength (64)
		longValue := make([]byte, 0, 70)
		for range 70 {
			longValue = append(longValue, 'a')
		}

		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetID:   model.NewId(),
			TargetType: "user",
			Value:      json.RawMessage(`"` + string(longValue) + `"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "maximum length")
	})

	t.Run("sanitizeAndValidateOptions writes back canonical []any of map[string]any", func(t *testing.T) {
		// Downstream readers (asOptionSlice, EnsureOptionIDs, store-layer
		// serialization) expect the canonical loose-typed shape. Writing back
		// a typed PropertyOptions slice from the hook used to break the linked-
		// options diff on every no-op patch — see commit bc15075016.
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "A", "color": "#fff"},
					map[string]any{"id": model.NewId(), "name": "B", "color": "#000"},
				},
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		opts, ok := created.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok, "options should be []any after hook canonicalization, got %T", created.Attrs[model.PropertyFieldAttributeOptions])
		require.Len(t, opts, 2)
		for _, opt := range opts {
			_, ok := opt.(map[string]any)
			assert.True(t, ok, "each option element should be map[string]any, got %T", opt)
		}
	})
}

func TestAccessControlAttributeValidationHookManagedAuthorization(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_managed_auth", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	adminUserID := model.NewId()
	regularUserID := model.NewId()

	permChecker := func(userID string, perm *model.Permission) bool {
		return userID == adminUserID && perm.Id == model.PermissionManageSystem.Id
	}

	hook := NewAccessControlAttributeValidationHook(th.service, permChecker, group.ID)
	th.service.AddHook(hook)

	t.Run("admin can create field with managed=admin", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, adminUserID)
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}
		created, createErr := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, createErr)
		require.NotNil(t, created.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionValues)
	})

	t.Run("non-admin is blocked from creating field with managed=admin", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, regularUserID)
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}
		_, createErr := th.service.CreatePropertyField(rctx, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "permission")
	})

	t.Run("non-admin can create field without managed attr", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, regularUserID)
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{},
		}
		created, createErr := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, createErr)
		require.NotNil(t, created.PermissionValues)
		assert.Equal(t, model.PermissionLevelMember, *created.PermissionValues)
	})

	t.Run("non-admin is blocked from updating field to managed=admin", func(t *testing.T) {
		// Create field as admin
		adminRctx := RequestContextWithCallerID(th.Context, adminUserID)
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)

		// Try to update as non-admin
		rctx := RequestContextWithCallerID(th.Context, regularUserID)
		created.Attrs = model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsManaged: "admin",
		}
		_, _, updateErr := th.service.UpdatePropertyField(rctx, group.ID, created)
		require.Error(t, updateErr)
		assert.Contains(t, updateErr.Error(), "permission")
	})

	t.Run("admin can update field to managed=admin", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, adminUserID)
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{},
		}
		created, createErr := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, createErr)

		created.Attrs = model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsManaged: "admin",
		}
		updated, _, updateErr := th.service.UpdatePropertyField(rctx, group.ID, created)
		require.NoError(t, updateErr)
		require.NotNil(t, updated.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *updated.PermissionValues)
	})

	t.Run("managed check skipped for unmanaged groups", func(t *testing.T) {
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_other_managed", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)

		rctx := RequestContextWithCallerID(th.Context, regularUserID)
		field := &model.PropertyField{
			GroupID:    otherGroup.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}
		// Should succeed because the hook doesn't apply to this group
		created, createErr := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, createErr)
		// PermissionValues should NOT be set by the hook for unmanaged groups
		assert.Nil(t, created.PermissionValues)
	})

	t.Run("empty caller ID is rejected (default-deny for unidentified callers)", func(t *testing.T) {
		// th.Context has no caller ID set. The hook must treat this as
		// non-admin and block managed=admin rather than silently
		// promoting to sysadmin.
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "managed=admin")
	})
}

// TestAccessControlAttributeValidationHookRankOptions exercises the rank-field
// option validation in sanitizeAndValidateOptions: a directly-authored rank
// field requires a positive, unique rank on every option, while non-rank
// fields keep any stray rank values (as opaque order-carriers) so a
// rank->select->rank round-trip preserves option ordering. Conversion repair
// is covered by TestAccessControlAttributeValidationHookRankConversion.
func TestAccessControlAttributeValidationHookRankOptions(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_attr_rank_validation", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	hook := NewAccessControlAttributeValidationHook(th.service, nil, group.ID)
	th.service.AddHook(hook)

	rankField := func(options []any) *model.PropertyField {
		return &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: options,
			},
		}
	}

	// optionRank reads the rank stored on the option at the given index of a
	// persisted field's canonical []any options, reporting whether the key was
	// present at all (JSON numbers decode as float64).
	optionRank := func(t *testing.T, field *model.PropertyField, idx int) (float64, bool) {
		t.Helper()
		opts, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok, "options should be []any, got %T", field.Attrs[model.PropertyFieldAttributeOptions])
		require.Greater(t, len(opts), idx)
		m, ok := opts[idx].(map[string]any)
		require.True(t, ok, "option should be map[string]any, got %T", opts[idx])
		raw, present := m["rank"]
		if !present || raw == nil {
			return 0, false
		}
		f, ok := raw.(float64)
		require.True(t, ok, "rank should decode as float64, got %T", raw)
		return f, true
	}

	t.Run("valid rank options pass and persist their ranks", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, rankField([]any{
			map[string]any{"name": "UNCLASSIFIED", "rank": 1},
			map[string]any{"name": "SECRET", "rank": 2},
			map[string]any{"name": "TOP SECRET", "rank": 3},
		}))
		require.NoError(t, createErr)

		for i, want := range []float64{1, 2, 3} {
			got, present := optionRank(t, created, i)
			assert.True(t, present, "option %d should retain its rank", i)
			assert.Equal(t, want, got, "option %d rank", i)
		}
	})

	t.Run("zero rank is rejected", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, rankField([]any{
			map[string]any{"name": "BASE", "rank": 0},
			map[string]any{"name": "HIGHER", "rank": 5},
		}))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "positive")
	})

	t.Run("option missing rank is rejected", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, rankField([]any{
			map[string]any{"name": "HAS_RANK", "rank": 1},
			map[string]any{"name": "NO_RANK"},
		}))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "missing rank")
	})

	t.Run("negative rank is rejected", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, rankField([]any{
			map[string]any{"name": "NEGATIVE", "rank": -1},
		}))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "positive")
	})

	t.Run("duplicate rank is rejected", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, rankField([]any{
			map[string]any{"name": "FIRST", "rank": 2},
			map[string]any{"name": "SECOND", "rank": 2},
		}))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "duplicate")
	})

	t.Run("non-rank field preserves stray rank values", func(t *testing.T) {
		// Ranks are meaningless on a select field, but we keep them so a later
		// conversion back to rank can recover the original ordering. They ride
		// along untouched; only a conversion into rank normalizes them.
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "A", "color": "#fff", "rank": 7},
					map[string]any{"name": "B", "color": "#000", "rank": 9},
				},
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		for i, want := range []float64{7, 9} {
			got, present := optionRank(t, created, i)
			assert.True(t, present, "select-field option %d should keep its rank", i)
			assert.Equal(t, want, got, "select-field option %d rank", i)
		}
	})

	t.Run("non-rank field keeps even non-positive or duplicate ranks", func(t *testing.T) {
		// Rank is unvalidated on a select field: it is just an opaque
		// order-carrier, so zero, negative, and duplicate values all ride
		// along untouched until a conversion into rank normalizes them.
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "A", "rank": -3},
					map[string]any{"name": "B", "rank": 0},
					map[string]any{"name": "C", "rank": 0},
				},
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		for i, want := range []float64{-3, 0, 0} {
			got, present := optionRank(t, created, i)
			assert.True(t, present, "select-field option %d should keep its rank", i)
			assert.Equal(t, want, got, "select-field option %d rank", i)
		}
	})
}

// TestAccessControlAttributeValidationHookRankConversion covers the repair that
// runs when a field is converted INTO rank from another type: arbitrary option
// ranks (non-sequential, duplicated, or missing) are renumbered to a gap-free
// 1..N sequence that preserves relative order, while directly editing an
// existing rank field still rejects invalid ranks rather than repairing them.
func TestAccessControlAttributeValidationHookRankConversion(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_attr_rank_conversion", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	hook := NewAccessControlAttributeValidationHook(th.service, nil, group.ID)
	th.service.AddHook(hook)

	// ranksByName parses a persisted field's canonical []any options into a
	// name -> rank map, plus the set of names whose rank is absent.
	ranksByName := func(t *testing.T, field *model.PropertyField) (map[string]int, map[string]struct{}) {
		t.Helper()
		opts, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok, "options should be []any, got %T", field.Attrs[model.PropertyFieldAttributeOptions])
		ranks := map[string]int{}
		missing := map[string]struct{}{}
		for _, o := range opts {
			m, ok := o.(map[string]any)
			require.True(t, ok, "option should be map[string]any, got %T", o)
			name, _ := m["name"].(string)
			raw, present := m["rank"]
			if !present || raw == nil {
				missing[name] = struct{}{}
				continue
			}
			f, ok := raw.(float64)
			require.True(t, ok, "rank should decode as float64, got %T", raw)
			ranks[name] = int(f)
		}
		return ranks, missing
	}

	selectField := func(options []any) *model.PropertyField {
		return &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      model.StringInterface{model.PropertyFieldAttributeOptions: options},
		}
	}

	convertToRank := func(t *testing.T, field *model.PropertyField) (*model.PropertyField, error) {
		t.Helper()
		field.Type = model.PropertyFieldTypeRank
		updated, _, updErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		return updated, updErr
	}

	t.Run("non-sequential valid ranks collapse to gap-free 1..N", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, selectField([]any{
			map[string]any{"name": "A", "rank": 10},
			map[string]any{"name": "B", "rank": 20},
			map[string]any{"name": "C", "rank": 30},
		}))
		require.NoError(t, createErr)

		updated, updErr := convertToRank(t, created)
		require.NoError(t, updErr)

		ranks, missing := ranksByName(t, updated)
		assert.Empty(t, missing)
		assert.Equal(t, map[string]int{"A": 1, "B": 2, "C": 3}, ranks)
	})

	t.Run("duplicate ranks renumber, ties broken by array order", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, selectField([]any{
			map[string]any{"name": "A", "rank": 1},
			map[string]any{"name": "B", "rank": 1},
			map[string]any{"name": "C", "rank": 2},
		}))
		require.NoError(t, createErr)

		updated, updErr := convertToRank(t, created)
		require.NoError(t, updErr)

		ranks, missing := ranksByName(t, updated)
		assert.Empty(t, missing)
		// A and B tie at 1; the earlier array position (A) keeps the lower rank.
		assert.Equal(t, map[string]int{"A": 1, "B": 2, "C": 3}, ranks)
	})

	t.Run("missing ranks sort last and are filled", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, selectField([]any{
			map[string]any{"name": "A", "rank": 1},
			map[string]any{"name": "B"},
			map[string]any{"name": "C", "rank": 2},
		}))
		require.NoError(t, createErr)

		updated, updErr := convertToRank(t, created)
		require.NoError(t, updErr)

		ranks, missing := ranksByName(t, updated)
		assert.Empty(t, missing)
		// B had no rank, so it sorts after the ranked options and lands last.
		assert.Equal(t, map[string]int{"A": 1, "C": 2, "B": 3}, ranks)
	})

	t.Run("plain select with no ranks gets sequential ranks by order", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, selectField([]any{
			map[string]any{"name": "A"},
			map[string]any{"name": "B"},
			map[string]any{"name": "C"},
		}))
		require.NoError(t, createErr)

		updated, updErr := convertToRank(t, created)
		require.NoError(t, updErr)

		ranks, missing := ranksByName(t, updated)
		assert.Empty(t, missing)
		assert.Equal(t, map[string]int{"A": 1, "B": 2, "C": 3}, ranks)
	})

	t.Run("clean rank->select->rank round-trip preserves sequential ranks", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "A", "rank": 1},
				map[string]any{"name": "B", "rank": 2},
				map[string]any{"name": "C", "rank": 3},
			}},
		})
		require.NoError(t, createErr)

		// rank -> select: ranks ride along untouched.
		created.Type = model.PropertyFieldTypeSelect
		asSelect, _, updErr := th.service.UpdatePropertyField(th.Context, group.ID, created)
		require.NoError(t, updErr)
		ranks, missing := ranksByName(t, asSelect)
		assert.Empty(t, missing)
		assert.Equal(t, map[string]int{"A": 1, "B": 2, "C": 3}, ranks)

		// select -> rank: normalization is an identity on an already-clean set.
		asRank, updErr := convertToRank(t, asSelect)
		require.NoError(t, updErr)
		ranks, missing = ranksByName(t, asRank)
		assert.Empty(t, missing)
		assert.Equal(t, map[string]int{"A": 1, "B": 2, "C": 3}, ranks)
	})

	t.Run("rank->rank edit with duplicate rank is rejected, not repaired", func(t *testing.T) {
		created, createErr := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "A", "rank": 1},
				map[string]any{"name": "B", "rank": 2},
			}},
		})
		require.NoError(t, createErr)

		// Stay a rank field but introduce a duplicate: the caller owns these
		// ranks, so this is an error rather than a silent renumber.
		created.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"name": "A", "rank": 1},
			map[string]any{"name": "B", "rank": 1},
		}
		_, _, updErr := th.service.UpdatePropertyField(th.Context, group.ID, created)
		require.Error(t, updErr)
		assert.Contains(t, updErr.Error(), "duplicate")
	})
}

func TestAccessControlAttributeValidationHookSync(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_attr_sync", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	adminUserID := model.NewId()
	permChecker := func(userID string, perm *model.Permission) bool {
		return userID == adminUserID && perm.Id == model.PermissionManageSystem.Id
	}

	hook := NewAccessControlAttributeValidationHook(th.service, permChecker, group.ID)
	th.service.AddHook(hook)

	adminRctx := RequestContextWithCallerID(th.Context, adminUserID)

	t.Run("user-editable text field keeps the ldap sync attr", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP: "employeeID",
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.Equal(t, "employeeID", created.Attrs[model.PropertyFieldAttrLDAP])
	})

	t.Run("admin-managed text field keeps the ldap sync attr", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
				model.PropertyFieldAttrLDAP:    "employeeID",
			},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)
		assert.Equal(t, "employeeID", created.Attrs[model.PropertyFieldAttrLDAP])
		assert.Equal(t, "admin", created.Attrs[model.PropertyFieldAttrManaged])
	})

	t.Run("admin-managed text field keeps the saml sync attr", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
				model.PropertyFieldAttrSAML:    "position",
			},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)
		assert.Equal(t, "position", created.Attrs[model.PropertyFieldAttrSAML])
	})

	t.Run("linking an existing admin-managed field keeps the ldap sync attr on update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
			},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)
		require.Empty(t, created.Attrs[model.PropertyFieldAttrLDAP])

		created.Attrs[model.PropertyFieldAttrLDAP] = "employeeID"
		updated, _, updateErr := th.service.UpdatePropertyField(adminRctx, group.ID, created)
		require.NoError(t, updateErr)
		assert.Equal(t, "employeeID", updated.Attrs[model.PropertyFieldAttrLDAP])
	})

	t.Run("adding managed to an ldap-synced field keeps the ldap sync attr on update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP: "employeeID",
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		created.Attrs[model.PropertyFieldAttrManaged] = "admin"
		updated, _, updateErr := th.service.UpdatePropertyField(adminRctx, group.ID, created)
		require.NoError(t, updateErr)
		assert.Equal(t, "employeeID", updated.Attrs[model.PropertyFieldAttrLDAP])
		assert.Equal(t, "admin", updated.Attrs[model.PropertyFieldAttrManaged])
	})

	t.Run("clearing ldap on an unmanaged field keeps managed unset", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP: "employeeID",
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		created.Attrs[model.PropertyFieldAttrLDAP] = ""
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, created)
		require.NoError(t, updateErr)
		assert.Equal(t, "", updated.Attrs[model.PropertyFieldAttrLDAP])
		assert.NotContains(t, updated.Attrs, model.PropertyFieldAttrManaged)
	})

	t.Run("clearing ldap on an admin-managed field keeps managed admin", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
				model.PropertyFieldAttrLDAP:    "employeeID",
			},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)

		created.Attrs[model.PropertyFieldAttrLDAP] = ""
		updated, _, updateErr := th.service.UpdatePropertyField(adminRctx, group.ID, created)
		require.NoError(t, updateErr)
		assert.Equal(t, "", updated.Attrs[model.PropertyFieldAttrLDAP])
		assert.Equal(t, "admin", updated.Attrs[model.PropertyFieldAttrManaged])
	})

	t.Run("linking an existing admin-managed field keeps the saml sync attr on update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
			},
		}
		created, createErr := th.service.CreatePropertyField(adminRctx, field)
		require.NoError(t, createErr)
		require.Empty(t, created.Attrs[model.PropertyFieldAttrSAML])

		created.Attrs[model.PropertyFieldAttrSAML] = "position"
		updated, _, updateErr := th.service.UpdatePropertyField(adminRctx, group.ID, created)
		require.NoError(t, updateErr)
		assert.Equal(t, "position", updated.Attrs[model.PropertyFieldAttrSAML])
	})

	t.Run("non-text field strips ldap and saml sync attrs", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrLDAP: "employeeID",
				model.PropertyFieldAttrSAML: "position",
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.NotContains(t, created.Attrs, model.PropertyFieldAttrLDAP)
		assert.NotContains(t, created.Attrs, model.PropertyFieldAttrSAML)
	})
}

func TestAccessControlAttributeValidationHook_Owners(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_owner_validation", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	hook := NewAccessControlAttributeValidationHook(th.service, func(userID string, _ *model.Permission) bool {
		return userID == "admin-user"
	}, group.ID)
	th.service.AddHook(hook)

	newOwnerFieldAttrs := func(owners []model.PropertyOwner) model.StringInterface {
		return model.StringInterface{model.PropertyAttrsOwners: owners}
	}

	t.Run("normalizes owners: trims, dedupes scopes, merges duplicate entries", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "  com.mattermost.scim ", Type: model.PropertyOwnerTypePlugin, Scopes: []string{" entra ", "entra", ""}},
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta"}},
			}),
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		owners := model.GetPropertyFieldOwners(created)
		require.Len(t, owners, 1)
		assert.Equal(t, "com.mattermost.scim", owners[0].ID)
		assert.Equal(t, model.PropertyOwnerTypePlugin, owners[0].Type)
		assert.ElementsMatch(t, []string{"entra", "okta"}, owners[0].Scopes)
	})

	t.Run("preserves scope label case verbatim", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"Entra"}},
			}),
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		owners := model.GetPropertyFieldOwners(created)
		require.Len(t, owners, 1)
		assert.Equal(t, []string{"Entra"}, owners[0].Scopes)
	})

	t.Run("keeps case-variant scope labels distinct but dedupes exact duplicates", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"Entra", "entra", "Entra"}},
			}),
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)

		owners := model.GetPropertyFieldOwners(created)
		require.Len(t, owners, 1)
		assert.Equal(t, []string{"Entra", "entra"}, owners[0].Scopes)
	})

	t.Run("rejects a scope with invalid characters", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"a b"}},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "invalid characters")
	})

	t.Run("rejects an owner with an unknown type", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "x", Type: "bogus", Scopes: []string{"s"}},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "owner type")
	})

	t.Run("rejects an owner with an empty id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "  ", Type: model.PropertyOwnerTypePlugin},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "owner id")
	})

	t.Run("rejects owners combined with managed=admin", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttrManaged: "admin",
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
				},
			},
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "managed=admin")
	})

	t.Run("allows owners combined with saml sync attr", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "department",
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
				},
			},
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.Equal(t, "department", created.Attrs[model.CustomProfileAttributesPropertyAttrsSAML])
		require.True(t, model.HasPropertyFieldOwners(created))
	})

	t.Run("pins permission_values to sysadmin for owner-managed fields", func(t *testing.T) {
		// Owner-managed fields pin PermissionValues to sysadmin so that if the
		// owners list is ever dropped, the field falls back to admin-only
		// rather than becoming writable by every member.
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			}),
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		require.NotNil(t, created.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionValues)
	})

	t.Run("removes an empty owners list", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      newOwnerFieldAttrs([]model.PropertyOwner{}),
		}
		created, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
		assert.False(t, model.HasPropertyFieldOwners(created))
	})

	t.Run("rejects too many owners", func(t *testing.T) {
		owners := make([]model.PropertyOwner, 0, model.PropertyOwnersMaxPerField+1)
		for i := 0; i <= model.PropertyOwnersMaxPerField; i++ {
			owners = append(owners, model.PropertyOwner{ID: fmt.Sprintf("com.mattermost.owner%d", i), Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}})
		}
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs:      newOwnerFieldAttrs(owners),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "too many owners")
	})

	t.Run("rejects too many scopes on a single owner", func(t *testing.T) {
		scopes := make([]string, 0, model.PropertyOwnerScopesMax+1)
		for i := 0; i <= model.PropertyOwnerScopesMax; i++ {
			scopes = append(scopes, fmt.Sprintf("scope%d", i))
		}
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: scopes},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "too many scopes")
	})

	t.Run("rejects an overlong scope", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: "com.mattermost.scim", Type: model.PropertyOwnerTypePlugin, Scopes: []string{strings.Repeat("a", model.PropertyOwnerScopeMaxRunes+1)}},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "scope exceeds max length")
	})

	t.Run("rejects an overlong owner id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: "user",
			Attrs: newOwnerFieldAttrs([]model.PropertyOwner{
				{ID: strings.Repeat("a", model.PropertyOwnerIDMaxRunes+1), Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			}),
		}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "owner id exceeds max length")
	})
}
