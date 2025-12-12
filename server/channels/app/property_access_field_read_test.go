// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPropertyFieldReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, err := pas.RegisterPropertyGroup("", "test-group")
	require.NoError(t, err)

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID := model.NewId()

	t.Run("public field - any caller can read without filtering", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Plugin 1 can read
		retrieved, err := pas.GetPropertyField(pluginID1, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// Plugin 2 can read
		retrieved, err = pas.GetPropertyField(pluginID2, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// User can read
		retrieved, err = pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// Anonymous caller can read
		retrieved, err = pas.GetPropertyField("", group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})

	t.Run("source_only field - source plugin gets all options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Source plugin can see all options
		retrieved, err := pas.GetPropertyField(pluginID1, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})

	t.Run("source_only field - other plugin gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-2",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Other plugin gets field but with empty options
		retrieved, err := pas.GetPropertyField(pluginID2, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("source_only field - user gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-3",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// User gets field but with empty options
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("source_only field - anonymous caller gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-4",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Anonymous caller gets field but with empty options
		retrieved, err := pas.GetPropertyField("", group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("shared_only field - caller with values sees filtered options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-field",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create values for the caller (userID has opt1 and opt2)
		value1, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      value1,
		})
		require.NoError(t, err)

		// User should only see opt1 and opt2
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		options := retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, options, 2)

		// Verify the options are opt1 and opt2
		optionIDs := make([]string, 0, len(options))
		for _, opt := range options {
			optMap := opt.(map[string]any)
			optionIDs = append(optionIDs, optMap["id"].(string))
		}
		assert.Contains(t, optionIDs, "opt1")
		assert.Contains(t, optionIDs, "opt2")
		assert.NotContains(t, optionIDs, "opt3")
	})

	t.Run("shared_only field - caller with no values sees empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-field-2",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// User has no values for this field
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("field with no attrs defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "no-attrs-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      nil,
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Any caller can read
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
	})

	t.Run("field with empty access_mode defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "empty-access-mode-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      model.StringInterface{},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Any caller can read
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
	})

	t.Run("field with invalid access_mode treated as source_only", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "invalid-access-mode-field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: "invalid-mode",
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Should get field with empty options (treated as source_only)
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})
}

func TestGetPropertyFieldsReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, err := pas.RegisterPropertyGroup("", "test-group-batch")
	require.NoError(t, err)

	pluginID := "plugin-1"
	userID := model.NewId()

	// Create multiple fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "public-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
		},
	}
	publicField, err = pas.CreatePropertyField("", publicField)
	require.NoError(t, err)

	sourceOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "source-only-field",
		Type:       model.PropertyFieldTypeSelect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
			model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Secret Option"},
			},
		},
	}
	sourceOnlyField, err = pas.CreatePropertyField("", sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "shared-only-field",
		Type:       model.PropertyFieldTypeMultiselect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Option 1"},
				map[string]any{"id": "opt2", "value": "Option 2"},
			},
		},
	}
	sharedOnlyField, err = pas.CreatePropertyField("", sharedOnlyField)
	require.NoError(t, err)

	// Create a value for userID on the shared field (opt1)
	value, err := json.Marshal([]string{"opt1"})
	require.NoError(t, err)
	_, err = pas.CreatePropertyValue("", &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    sharedOnlyField.ID,
		TargetType: "user",
		TargetID:   userID,
		Value:      value,
	})
	require.NoError(t, err)

	t.Run("source plugin sees all fields with full options", func(t *testing.T) {
		fields, err := pas.GetPropertyFields(pluginID, group.ID, []string{publicField.ID, sourceOnlyField.ID, sharedOnlyField.ID})
		require.NoError(t, err)
		require.Len(t, fields, 3)

		// Find each field and verify
		for _, field := range fields {
			if field.ID == sourceOnlyField.ID {
				// Source plugin sees all options
				assert.Len(t, field.Attrs[model.PropertyFieldAttributeOptions].([]any), 1)
			}
		}
	})

	t.Run("user sees all fields with filtered options", func(t *testing.T) {
		fields, err := pas.GetPropertyFields(userID, group.ID, []string{publicField.ID, sourceOnlyField.ID, sharedOnlyField.ID})
		require.NoError(t, err)
		require.Len(t, fields, 3)

		// Find each field and verify
		for _, field := range fields {
			if field.ID == sourceOnlyField.ID {
				// User sees empty options for source_only
				assert.Empty(t, field.Attrs[model.PropertyFieldAttributeOptions].([]any))
			} else if field.ID == sharedOnlyField.ID {
				// User sees filtered options (only opt1)
				assert.Len(t, field.Attrs[model.PropertyFieldAttributeOptions].([]any), 1)
			}
		}
	})

	t.Run("empty list returns empty list", func(t *testing.T) {
		fields, err := pas.GetPropertyFields(userID, group.ID, []string{})
		require.NoError(t, err)
		assert.Empty(t, fields)
	})
}

func TestSearchPropertyFieldsReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, err := pas.RegisterPropertyGroup("", "test-group-search")
	require.NoError(t, err)

	pluginID := "plugin-1"
	userID := model.NewId()

	// Create fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "public-search-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
		},
	}
	_, err = pas.CreatePropertyField("", publicField)
	require.NoError(t, err)

	sourceOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "source-search-field",
		Type:       model.PropertyFieldTypeSelect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
			model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Secret"},
			},
		},
	}
	_, err = pas.CreatePropertyField("", sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "shared-search-field",
		Type:       model.PropertyFieldTypeMultiselect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Option 1"},
				map[string]any{"id": "opt2", "value": "Option 2"},
			},
		},
	}
	sharedOnlyField, err = pas.CreatePropertyField("", sharedOnlyField)
	require.NoError(t, err)

	// Create value for userID (opt1)
	value, err := json.Marshal([]string{"opt1"})
	require.NoError(t, err)
	_, err = pas.CreatePropertyValue("", &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    sharedOnlyField.ID,
		TargetType: "user",
		TargetID:   userID,
		Value:      value,
	})
	require.NoError(t, err)

	t.Run("search returns all fields with appropriate filtering", func(t *testing.T) {
		// User search
		results, err := pas.SearchPropertyFields(userID, group.ID, model.PropertyFieldSearchOpts{
			PerPage: 100,
		})
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 3)

		// Verify filtering
		for _, field := range results {
			if field.Name == "source-search-field" {
				// User sees empty options for source_only
				assert.Empty(t, field.Attrs[model.PropertyFieldAttributeOptions].([]any))
			} else if field.Name == "shared-search-field" {
				// User sees filtered options (only opt1)
				options := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
				assert.Len(t, options, 1)
			}
		}
	})

	t.Run("source plugin search sees unfiltered options", func(t *testing.T) {
		results, err := pas.SearchPropertyFields(pluginID, group.ID, model.PropertyFieldSearchOpts{
			PerPage: 100,
		})
		require.NoError(t, err)

		// Verify source plugin sees all options
		for _, field := range results {
			if field.Name == "source-search-field" {
				assert.Len(t, field.Attrs[model.PropertyFieldAttributeOptions].([]any), 1)
			}
		}
	})
}

func TestGetPropertyFieldByNameReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, err := pas.RegisterPropertyGroup("", "test-group-byname")
	require.NoError(t, err)

	pluginID := "plugin-1"
	userID := model.NewId()
	targetID := model.NewId()

	t.Run("source_only field by name - filters options for non-source", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "byname-source-only",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			TargetID:   targetID,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Source plugin can see options
		retrieved, err := pas.GetPropertyFieldByName(pluginID, group.ID, targetID, created.Name)
		require.NoError(t, err)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 1)

		// User sees empty options
		retrieved, err = pas.GetPropertyFieldByName(userID, group.ID, targetID, created.Name)
		require.NoError(t, err)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})
}
