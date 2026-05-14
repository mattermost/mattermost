// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
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
