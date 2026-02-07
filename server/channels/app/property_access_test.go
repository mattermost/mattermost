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

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

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
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("test-plugin", field)
		require.NoError(t, err)

		// Create values for the caller (userID has opt1 and opt2)
		value1, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("test-plugin", &model.PropertyValue{
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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("test-plugin", field)
		require.NoError(t, err)

		// User has no values for this field
		retrieved, err := pas.GetPropertyField(userID, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("shared_only field - source plugin gets all options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-field-source",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsSourcePluginID: pluginID1,
				model.PropertyAttrsProtected:      true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
		require.NoError(t, err)

		// Source plugin can see all options even without having any values
		retrieved, err := pas.GetPropertyField(pluginID1, group.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		options := retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, options, 3)

		// Other plugin with no values sees empty options
		retrieved, err = pas.GetPropertyField(pluginID2, group.ID, created.ID)
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

	t.Run("field with invalid access_mode is rejected", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "invalid-access-mode-field",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: "invalid-mode",
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
				},
			},
		}
		_, err := pas.CreatePropertyField("", field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid access mode")
	})

	t.Run("non-CPA group source_only field - everyone sees all options", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-read")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "source-only-non-cpa",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option 1"},
					map[string]any{"id": "opt2", "value": "Secret Option 2"},
				},
			},
		}
		created, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Non-source plugin sees all options (no filtering)
		retrieved, err := pas.GetPropertyField(pluginID2, nonCpaGroup.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// User sees all options (no filtering)
		retrieved, err = pas.GetPropertyField(userID, nonCpaGroup.ID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})
}

func TestGetPropertyFieldsReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	pluginID := "plugin-1"
	userID := model.NewId()

	// Create multiple fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "public-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
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
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Secret Option"},
			},
		},
	}
	sourceOnlyField, err = pas.CreatePropertyFieldForPlugin(pluginID, sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "shared-only-field",
		Type:       model.PropertyFieldTypeMultiselect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Option 1"},
				map[string]any{"id": "opt2", "value": "Option 2"},
			},
		},
	}
	sharedOnlyField, err = pas.CreatePropertyFieldForPlugin("test-plugin", sharedOnlyField)
	require.NoError(t, err)

	// Create a value for userID on the shared field (opt1)
	value, err := json.Marshal([]string{"opt1"})
	require.NoError(t, err)
	_, err = pas.CreatePropertyValue("test-plugin", &model.PropertyValue{
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
}

func TestSearchPropertyFieldsReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	pluginID := "plugin-1"
	userID := model.NewId()

	// Create fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "public-search-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
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
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Secret"},
			},
		},
	}
	_, err = pas.CreatePropertyFieldForPlugin(pluginID, sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "shared-search-field",
		Type:       model.PropertyFieldTypeMultiselect,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:  true,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Option 1"},
				map[string]any{"id": "opt2", "value": "Option 2"},
			},
		},
	}
	sharedOnlyField, err = pas.CreatePropertyFieldForPlugin("test-plugin", sharedOnlyField)
	require.NoError(t, err)

	// Create value for userID (opt1)
	value, err := json.Marshal([]string{"opt1"})
	require.NoError(t, err)
	_, err = pas.CreatePropertyValue("test-plugin", &model.PropertyValue{
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

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

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
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret"},
				},
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin(pluginID, field)
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

// TestCreatePropertyField_SourcePluginIDValidation tests source_plugin_id validation during field creation
func TestCreatePropertyField_SourcePluginIDValidation(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows field creation without source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("user1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		// Verify source_plugin_id was not set
		assert.Nil(t, created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("rejects any attempt to set source_plugin_id via CreatePropertyField", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		// Should be rejected even if caller matches
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "source_plugin_id cannot be set directly")
	})

	t.Run("rejects source_plugin_id from user/admin via CreatePropertyField", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("user-id-123", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "source_plugin_id cannot be set directly")
	})

	t.Run("allows empty string source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "",
			},
		}

		// Empty string is allowed (default value from API serialization)
		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
	})

	t.Run("rejects protected attribute via CreatePropertyField", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		// Should be rejected - only plugins can set protected via CreatePropertyFieldForPlugin
		created, err := th.App.PropertyAccessService().CreatePropertyField("user1", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected can only be set by plugins")
	})

	t.Run("rejects protected attribute even when caller is empty", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected can only be set by plugins")
	})

	t.Run("non-CPA group allows protected attribute", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		// Should succeed because access control doesn't apply to non-CPA groups
		created, err := th.App.PropertyAccessService().CreatePropertyField("user1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.True(t, created.Attrs[model.PropertyAttrsProtected].(bool))
	})

	t.Run("non-CPA group allows source_plugin_id to be set", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-2")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "some-plugin",
			},
		}

		// Should succeed because access control doesn't apply to non-CPA groups
		created, err := th.App.PropertyAccessService().CreatePropertyField("user1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "some-plugin", created.Attrs[model.PropertyAttrsSourcePluginID])
	})
}

// TestCreatePropertyFieldForPlugin tests the plugin-specific field creation method
func TestCreatePropertyFieldForPlugin(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("automatically sets source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "plugin1", created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("overwrites any pre-set source_plugin_id with plugin ID", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "malicious-plugin",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		// Should override with correct plugin ID
		assert.Equal(t, "plugin1", created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("rejects empty plugin ID", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "pluginID is required")
	})

	t.Run("creates protected field with source_only access mode", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:  true,
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Secret Option"},
				},
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("security-plugin", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "security-plugin", created.Attrs[model.PropertyAttrsSourcePluginID])
		assert.True(t, created.Attrs[model.PropertyAttrsProtected].(bool))
		assert.Equal(t, model.PropertyAccessModeSourceOnly, created.Attrs[model.PropertyAttrsAccessMode])
	})
}

// TestUpdatePropertyField_WriteAccessControl tests write access control for field updates
func TestUpdatePropertyField_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows update of unprotected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Original Name",
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		created.Name = "Updated Name"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin2", groupID, created)
		require.NoError(t, err)
		assert.Equal(t, "Updated Name", updated.Name)
	})

	t.Run("allows source plugin to update protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		created.Name = "Updated Protected Field"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin1", groupID, created)
		require.NoError(t, err)
		assert.Equal(t, "Updated Protected Field", updated.Name)
	})

	t.Run("denies non-source plugin updating protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin2", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
		assert.Contains(t, err.Error(), "plugin1")
	})

	t.Run("denies empty callerID updating protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected Field Empty Caller",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("prevents changing source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		// Try to change source_plugin_id
		created.Attrs[model.PropertyAttrsSourcePluginID] = "plugin2"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin1", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "immutable")
	})

	t.Run("non-CPA group allows anyone to update protected field", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-update")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    "Protected Field Non-CPA",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.NoError(t, err)

		created.Name = "Updated by Different Plugin"
		// Should succeed - plugin2 can update plugin1's protected field in non-CPA group
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin2", nonCpaGroup.ID, created)
		require.NoError(t, err)
		assert.Equal(t, "Updated by Different Plugin", updated.Name)
	})
}

// TestUpdatePropertyFields_BulkWriteAccessControl tests bulk field updates with atomic access checking
func TestUpdatePropertyFields_BulkWriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows bulk update of unprotected fields", func(t *testing.T) {
		field1 := &model.PropertyField{GroupID: groupID, Name: "Field1", Type: model.PropertyFieldTypeText}
		field2 := &model.PropertyField{GroupID: groupID, Name: "Field2", Type: model.PropertyFieldTypeText}

		created1, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field1)
		require.NoError(t, err)
		created2, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field2)
		require.NoError(t, err)

		created1.Name = "Updated Field1"
		created2.Name = "Updated Field2"

		updated, err := th.App.PropertyAccessService().UpdatePropertyFields("plugin2", groupID, []*model.PropertyField{created1, created2})
		require.NoError(t, err)
		assert.Len(t, updated, 2)
	})

	t.Run("fails atomically when one protected field in batch", func(t *testing.T) {
		// Create unprotected field
		field1 := &model.PropertyField{GroupID: groupID, Name: "Unprotected", Type: model.PropertyFieldTypeText}
		created1, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field1)
		require.NoError(t, err)

		// Create protected field
		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created2, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field2)
		require.NoError(t, err)

		// Try to update both with plugin2 (should fail atomically)
		created1.Name = "Updated Unprotected"
		created2.Name = "Updated Protected"

		updated, err := th.App.PropertyAccessService().UpdatePropertyFields("plugin2", groupID, []*model.PropertyField{created1, created2})
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")

		// Verify neither was updated
		check1, err := th.App.PropertyAccessService().GetPropertyField("plugin1", groupID, created1.ID)
		require.NoError(t, err)
		assert.Equal(t, "Unprotected", check1.Name)

		check2, err := th.App.PropertyAccessService().GetPropertyField("plugin1", groupID, created2.ID)
		require.NoError(t, err)
		assert.Equal(t, "Protected", check2.Name)
	})
}

// TestDeletePropertyField_WriteAccessControl tests write access control for field deletion
func TestDeletePropertyField_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows deletion of unprotected field", func(t *testing.T) {
		field := &model.PropertyField{GroupID: groupID, Name: "Unprotected", Type: model.PropertyFieldTypeText}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyField("plugin2", groupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("allows source plugin to delete protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyField("plugin1", groupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("denies non-source plugin deleting protected field", func(t *testing.T) {
		pas.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "plugin1"
		})

		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		err = pas.DeletePropertyField("plugin2", groupID, created.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("non-CPA group allows anyone to delete protected field", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-delete")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    "Protected Non-CPA",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.NoError(t, err)

		// Should succeed - plugin2 can delete plugin1's protected field in non-CPA group
		err = th.App.PropertyAccessService().DeletePropertyField("plugin2", nonCpaGroup.ID, created.ID)
		require.NoError(t, err)
	})
}

// TestCreatePropertyValue_WriteAccessControl tests write access control for value creation
func TestCreatePropertyValue_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows creating value for public field", func(t *testing.T) {
		field := &model.PropertyField{GroupID: groupID, Name: "Public", Type: model.PropertyFieldTypeText}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"test value"`),
		}

		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin2", value)
		require.NoError(t, err)
		assert.NotNil(t, createdValue)
	})

	t.Run("allows source plugin to create value for source_only field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "SourceOnly",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"secret value"`),
		}

		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin1", value)
		require.NoError(t, err)
		assert.NotNil(t, createdValue)
	})

	t.Run("denies creating value for protected field by non-source", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"value"`),
		}

		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin2", value)
		require.Error(t, err)
		assert.Nil(t, createdValue)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("non-CPA group allows anyone to create value for protected field", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-value-create")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    "Protected Non-CPA",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    nonCpaGroup.ID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"value from plugin2"`),
		}

		// Should succeed - plugin2 can create value on plugin1's protected field in non-CPA group
		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin2", value)
		require.NoError(t, err)
		assert.NotNil(t, createdValue)
	})
}

// TestDeletePropertyValue_WriteAccessControl tests write access control for value deletion
func TestDeletePropertyValue_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows deleting value for public field", func(t *testing.T) {
		field := &model.PropertyField{GroupID: groupID, Name: "Public", Type: model.PropertyFieldTypeText}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"test"`),
		}
		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin1", value)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyValue("plugin2", groupID, createdValue.ID)
		require.NoError(t, err)
	})

	t.Run("denies non-source deleting value for protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"test"`),
		}
		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin1", value)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyValue("plugin2", groupID, createdValue.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
	})
}

// TestDeletePropertyValuesForTarget_WriteAccessControl tests bulk deletion with access control
func TestDeletePropertyValuesForTarget_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	groupID := cpaGroupID

	t.Run("allows deleting all values when caller has write access to all fields", func(t *testing.T) {
		field1 := &model.PropertyField{GroupID: groupID, Name: "Field1", Type: model.PropertyFieldTypeText}
		field2 := &model.PropertyField{GroupID: groupID, Name: "Field2", Type: model.PropertyFieldTypeText}

		created1, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field1)
		require.NoError(t, err)
		created2, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1 := &model.PropertyValue{GroupID: groupID, FieldID: created1.ID, TargetType: "user", TargetID: targetID, Value: json.RawMessage(`"v1"`)}
		value2 := &model.PropertyValue{GroupID: groupID, FieldID: created2.ID, TargetType: "user", TargetID: targetID, Value: json.RawMessage(`"v2"`)}

		_, err = th.App.PropertyAccessService().CreatePropertyValue("plugin1", value1)
		require.NoError(t, err)
		_, err = th.App.PropertyAccessService().CreatePropertyValue("plugin1", value2)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyValuesForTarget("plugin2", groupID, "user", targetID)
		require.NoError(t, err)
	})

	t.Run("fails atomically when caller lacks access to one field", func(t *testing.T) {
		// Create public field
		field1 := &model.PropertyField{GroupID: groupID, Name: "Public", Type: model.PropertyFieldTypeText}
		created1, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field1)
		require.NoError(t, err)

		// Create protected field
		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created2, err := th.App.PropertyAccessService().CreatePropertyFieldForPlugin("plugin1", field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1 := &model.PropertyValue{GroupID: groupID, FieldID: created1.ID, TargetType: "user", TargetID: targetID, Value: json.RawMessage(`"v1"`)}
		value2 := &model.PropertyValue{GroupID: groupID, FieldID: created2.ID, TargetType: "user", TargetID: targetID, Value: json.RawMessage(`"v2"`)}

		_, err = th.App.PropertyAccessService().CreatePropertyValue("plugin1", value1)
		require.NoError(t, err)
		_, err = th.App.PropertyAccessService().CreatePropertyValue("plugin1", value2)
		require.NoError(t, err)

		// Try to delete with plugin2 (should fail)
		err = th.App.PropertyAccessService().DeletePropertyValuesForTarget("plugin2", groupID, "user", targetID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")

		// Verify values still exist
		values, err := th.App.PropertyAccessService().SearchPropertyValues("plugin1", groupID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   10,
		})
		require.NoError(t, err)
		assert.Len(t, values, 2)
	})
}

func TestGetPropertyValueReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, rerr := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, rerr)
	cpaGroupID = group.ID

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID1 := model.NewId()
	userID2 := model.NewId()

	t.Run("public field value - any caller can read", func(t *testing.T) {
		// Create public field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("test value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// Plugin 1 can read
		retrieved, err := pas.GetPropertyValue(pluginID1, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)

		// Plugin 2 can read
		retrieved, err = pas.GetPropertyValue(pluginID2, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)

		// User can read
		retrieved, err = pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)

		// Anonymous caller can read
		retrieved, err = pas.GetPropertyValue("", group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
	})

	t.Run("source_only field value - only source plugin can read", func(t *testing.T) {
		// Create source_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		field, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("secret value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue(pluginID1, value)
		require.NoError(t, err)

		// Source plugin can read
		retrieved, err := pas.GetPropertyValue(pluginID1, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)
	})

	t.Run("source_only field value - other plugin gets nil", func(t *testing.T) {
		// Create source_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		field, err := pas.CreatePropertyFieldForPlugin(pluginID1, field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("secret value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue(pluginID1, value)
		require.NoError(t, err)

		// Other plugin gets nil
		retrieved, err := pas.GetPropertyValue(pluginID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)

		// User gets nil
		retrieved, err = pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)

		// Anonymous caller gets nil
		retrieved, err = pas.GetPropertyValue("", group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only single-select - return value only if caller has same", func(t *testing.T) {
		// Create shared_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-single-select",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		field, err := pas.CreatePropertyFieldForPlugin("test-plugin", field)
		require.NoError(t, err)

		// User 1 has opt1
		user1Value, err := json.Marshal("opt1")
		require.NoError(t, err)
		value1 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		}
		value1, err = pas.CreatePropertyValue("test-plugin", value1)
		require.NoError(t, err)

		// User 2 also has opt1
		user2Value, err := json.Marshal("opt1")
		require.NoError(t, err)
		value2 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID2,
			Value:      user2Value,
		}
		_, err = pas.CreatePropertyValue("test-plugin", value2)
		require.NoError(t, err)

		// User 2 can see user 1's value (both have opt1)
		retrieved, err := pas.GetPropertyValue(userID2, group.ID, value1.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value1.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(user1Value), retrieved.Value)

		// Create another user with opt2
		userID3 := model.NewId()
		user3Value, err := json.Marshal("opt2")
		require.NoError(t, err)
		value3 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID3,
			Value:      user3Value,
		}
		_, err = pas.CreatePropertyValue("test-plugin", value3)
		require.NoError(t, err)

		// User 3 cannot see user 1's value (different options, no intersection)
		retrieved, err = pas.GetPropertyValue(userID3, group.ID, value1.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only multi-select - return intersection of arrays", func(t *testing.T) {
		// Create shared_only multiselect field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-multi-select",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Hiking"},
					map[string]any{"id": "opt2", "value": "Cooking"},
					map[string]any{"id": "opt3", "value": "Gaming"},
				},
			},
		}
		field, err := pas.CreatePropertyFieldForPlugin("test-plugin", field)
		require.NoError(t, err)

		// Alice has ["opt1", "opt2"] (hiking, cooking)
		aliceID := model.NewId()
		aliceValue, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		alicePropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   aliceID,
			Value:      aliceValue,
		}
		alicePropertyValue, err = pas.CreatePropertyValue("test-plugin", alicePropertyValue)
		require.NoError(t, err)

		// Bob has ["opt1", "opt3"] (hiking, gaming)
		bobID := model.NewId()
		bobValue, err := json.Marshal([]string{"opt1", "opt3"})
		require.NoError(t, err)
		bobPropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   bobID,
			Value:      bobValue,
		}
		_, err = pas.CreatePropertyValue("test-plugin", bobPropertyValue)
		require.NoError(t, err)

		// Bob views Alice - should only see ["opt1"] (intersection)
		retrieved, err := pas.GetPropertyValue(bobID, group.ID, alicePropertyValue.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, alicePropertyValue.ID, retrieved.ID)

		var retrievedOptions []string
		err = json.Unmarshal(retrieved.Value, &retrievedOptions)
		require.NoError(t, err)
		assert.Len(t, retrievedOptions, 1)
		assert.Contains(t, retrievedOptions, "opt1")

		// Create user with no overlapping values
		charlieID := model.NewId()
		charlieValue, err := json.Marshal([]string{"opt3"})
		require.NoError(t, err)
		charliePropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   charlieID,
			Value:      charlieValue,
		}
		_, err = pas.CreatePropertyValue("test-plugin", charliePropertyValue)
		require.NoError(t, err)

		// Charlie views Alice - should get nil (no intersection)
		retrieved, err = pas.GetPropertyValue(charlieID, group.ID, alicePropertyValue.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only value - caller with no values sees nothing", func(t *testing.T) {
		// Create shared_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-no-values",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
				},
			},
		}
		field, err := pas.CreatePropertyFieldForPlugin("test-plugin", field)
		require.NoError(t, err)

		// Create value for user 1
		user1Value, err := json.Marshal([]string{"opt1"})
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		}
		value, err = pas.CreatePropertyValue("test-plugin", value)
		require.NoError(t, err)

		// User 2 has no values for this field
		retrieved, err := pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("non-CPA group source_only value - everyone can read", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-value-read")
		require.NoError(t, err)

		// Create source_only field
		field := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "source-only-non-cpa",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field, err = pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("secret value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    nonCpaGroup.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// Non-source plugin can read (no filtering)
		retrieved, err := pas.GetPropertyValue(pluginID2, nonCpaGroup.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)

		// User can read (no filtering)
		retrieved, err = pas.GetPropertyValue(userID2, nonCpaGroup.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)
	})
}

func TestGetPropertyValuesReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, rerr := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, rerr)
	cpaGroupID = group.ID

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID := model.NewId()

	t.Run("mixed access modes - bulk read respects per-field access control", func(t *testing.T) {
		// Create public field
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-bulk",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		publicField, err := pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		// Create source_only field
		sourceOnlyField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-bulk",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		sourceOnlyField, err = pas.CreatePropertyFieldForPlugin(pluginID1, sourceOnlyField)
		require.NoError(t, err)

		// Create values
		publicValue, err := json.Marshal("public")
		require.NoError(t, err)
		publicPropValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    publicField.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      publicValue,
		}
		publicPropValue, err = pas.CreatePropertyValue("", publicPropValue)
		require.NoError(t, err)

		sourceOnlyValue, err := json.Marshal("secret")
		require.NoError(t, err)
		sourceOnlyPropValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sourceOnlyField.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      sourceOnlyValue,
		}
		sourceOnlyPropValue, err = pas.CreatePropertyValue(pluginID1, sourceOnlyPropValue)
		require.NoError(t, err)

		// Plugin 1 (source) sees both values
		retrieved, err := pas.GetPropertyValues(pluginID1, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 2)

		// Plugin 2 sees only public value
		retrieved, err = pas.GetPropertyValues(pluginID2, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 1)
		assert.Equal(t, publicPropValue.ID, retrieved[0].ID)

		// User sees only public value
		retrieved, err = pas.GetPropertyValues(userID, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 1)
		assert.Equal(t, publicPropValue.ID, retrieved[0].ID)
	})
}

func TestSearchPropertyValuesReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, rerr := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, rerr)
	cpaGroupID = group.ID

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID1 := model.NewId()
	userID2 := model.NewId()

	t.Run("search filters based on field access", func(t *testing.T) {
		// Create public field
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-search",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		publicField, err := pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		// Create source_only field
		sourceOnlyField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-search",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		sourceOnlyField, err = pas.CreatePropertyFieldForPlugin(pluginID1, sourceOnlyField)
		require.NoError(t, err)

		// Create values for both fields
		publicValue, err := json.Marshal("public data")
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    publicField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      publicValue,
		})
		require.NoError(t, err)

		sourceOnlyValue, err := json.Marshal("secret data")
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue(pluginID1, &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sourceOnlyField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      sourceOnlyValue,
		})
		require.NoError(t, err)

		// Source plugin sees both values
		results, err := pas.SearchPropertyValues(pluginID1, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Len(t, results, 2)

		// Other plugin sees only public value
		results, err = pas.SearchPropertyValues(pluginID2, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Len(t, results, 1)
		assert.Equal(t, publicField.ID, results[0].FieldID)
	})

	t.Run("search shared_only values show intersection", func(t *testing.T) {
		// Create shared_only field
		sharedField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-field-search",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		sharedField, err := pas.CreatePropertyFieldForPlugin("test-plugin", sharedField)
		require.NoError(t, err)

		// User 1 has ["opt1", "opt2"]
		user1Value, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("test-plugin", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sharedField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		})
		require.NoError(t, err)

		// User 2 has ["opt1", "opt3"]
		user2Value, err := json.Marshal([]string{"opt1", "opt3"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("test-plugin", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sharedField.ID,
			TargetType: "user",
			TargetID:   userID2,
			Value:      user2Value,
		})
		require.NoError(t, err)

		// User 2 searches for user 1's values - should see only ["opt1"]
		results, err := pas.SearchPropertyValues(userID2, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			FieldID:   sharedField.ID,
			PerPage:   100,
		})
		require.NoError(t, err)
		require.Len(t, results, 1)

		var retrievedOptions []string
		err = json.Unmarshal(results[0].Value, &retrievedOptions)
		require.NoError(t, err)
		assert.Len(t, retrievedOptions, 1)
		assert.Contains(t, retrievedOptions, "opt1")
	})
}

// TestCreatePropertyValues_WriteAccessControl tests write access control for bulk value creation
func TestCreatePropertyValues_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register the CPA group
	group, err := pas.RegisterPropertyGroup("cpa")
	require.NoError(t, err)
	cpaGroupID = group.ID

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"

	t.Run("allows creating values for public fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-1",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		field1, err = pas.CreatePropertyField("", field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		field2, err = pas.CreatePropertyField("", field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1, v1err := json.Marshal("value1")
		require.NoError(t, v1err)
		value2, v2err := json.Marshal("value2")
		require.NoError(t, v2err)

		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    field1.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value1,
			},
			{
				GroupID:    group.ID,
				FieldID:    field2.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value2,
			},
		}

		created, cerr := pas.CreatePropertyValues(pluginID2, values)
		require.NoError(t, cerr)
		assert.Len(t, created, 2)
	})

	t.Run("allows source plugin to create values for protected fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "protected-field-1",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		field1, err = pas.CreatePropertyFieldForPlugin(pluginID1, field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "protected-field-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		field2, err = pas.CreatePropertyFieldForPlugin(pluginID1, field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1, v1err := json.Marshal("secret1")
		require.NoError(t, v1err)
		value2, v2err := json.Marshal("secret2")
		require.NoError(t, v2err)

		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    field1.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value1,
			},
			{
				GroupID:    group.ID,
				FieldID:    field2.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value2,
			},
		}

		created, cerr := pas.CreatePropertyValues(pluginID1, values)
		require.NoError(t, cerr)
		assert.Len(t, created, 2)
	})

	t.Run("fails atomically when one protected field in batch", func(t *testing.T) {
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-batch",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		publicField, err = pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		protectedField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "protected-field-batch",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		protectedField, err = pas.CreatePropertyFieldForPlugin(pluginID1, protectedField)
		require.NoError(t, err)

		targetID := model.NewId()
		publicValue, err := json.Marshal("public data")
		require.NoError(t, err)
		protectedValue, err := json.Marshal("secret data")
		require.NoError(t, err)

		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    publicField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      publicValue,
			},
			{
				GroupID:    group.ID,
				FieldID:    protectedField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      protectedValue,
			},
		}

		// Plugin 2 should fail to create both values atomically
		created, err := pas.CreatePropertyValues(pluginID2, values)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected")

		// Verify neither value was created
		results, err := pas.SearchPropertyValues(pluginID1, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Empty(t, results)
	})

	t.Run("creates values across multiple groups", func(t *testing.T) {
		// Register a second group
		group2, err := pas.RegisterPropertyGroup("test-group-create-values-2")
		require.NoError(t, err)

		// Create fields in both groups
		field1 := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field-group1",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		field1, err = pas.CreatePropertyField("", field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID:    group2.ID,
			Name:       "field-group2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		field2, err = pas.CreatePropertyField("", field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1, err := json.Marshal("data from group 1")
		require.NoError(t, err)
		value2, err := json.Marshal("data from group 2")
		require.NoError(t, err)

		// Create values for fields from different groups in a single call
		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    field1.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value1,
			},
			{
				GroupID:    group2.ID,
				FieldID:    field2.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value2,
			},
		}

		created, err := pas.CreatePropertyValues(pluginID2, values)
		require.NoError(t, err)
		assert.Len(t, created, 2)

		// Verify both values were created
		retrieved1, err := pas.GetPropertyValue(pluginID2, group.ID, created[0].ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved1)

		retrieved2, err := pas.GetPropertyValue(pluginID2, group2.ID, created[1].ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved2)
	})

	t.Run("enforces access control across multiple groups atomically", func(t *testing.T) {
		// Register a third group
		group3, err := pas.RegisterPropertyGroup("test-group-create-values-3")
		require.NoError(t, err)

		// Create public field in group 1
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-multigroup",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
			},
		}
		publicField, err = pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		// Create protected field in group 3
		protectedField := &model.PropertyField{
			GroupID:    group3.ID,
			Name:       "protected-field-multigroup",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:  true,
			},
		}
		protectedField, err = pas.CreatePropertyFieldForPlugin(pluginID1, protectedField)
		require.NoError(t, err)

		targetID := model.NewId()
		publicValue, err := json.Marshal("public data")
		require.NoError(t, err)
		protectedValue, err := json.Marshal("secret data")
		require.NoError(t, err)

		// Try to create values from different groups with one protected field
		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    publicField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      publicValue,
			},
			{
				GroupID:    group3.ID,
				FieldID:    protectedField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      protectedValue,
			},
		}

		// Plugin 2 should fail atomically
		created, err := pas.CreatePropertyValues(pluginID2, values)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected")

		// Verify no values were created in either group
		results1, err := pas.SearchPropertyValues(pluginID1, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Empty(t, results1)

		results3, err := pas.SearchPropertyValues(pluginID1, group3.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Empty(t, results3)
	})

	t.Run("non-CPA group allows bulk creation of values for protected fields", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-bulk-create")
		require.NoError(t, err)

		// Create protected fields
		field1 := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "protected-bulk-1",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field1, err = pas.CreatePropertyField("", field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "protected-bulk-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field2, err = pas.CreatePropertyField("", field2)
		require.NoError(t, err)

		targetID := model.NewId()
		value1, err := json.Marshal("data1")
		require.NoError(t, err)
		value2, err := json.Marshal("data2")
		require.NoError(t, err)

		values := []*model.PropertyValue{
			{
				GroupID:    nonCpaGroup.ID,
				FieldID:    field1.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value1,
			},
			{
				GroupID:    nonCpaGroup.ID,
				FieldID:    field2.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value2,
			},
		}

		// Should succeed - plugin2 can create values on plugin1's protected fields in non-CPA group
		created, err := pas.CreatePropertyValues(pluginID2, values)
		require.NoError(t, err)
		assert.Len(t, created, 2)
	})

	t.Run("non-CPA group allows bulk upsert of values for protected fields", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-bulk-upsert")
		require.NoError(t, err)

		// Create protected field
		field := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "protected-upsert",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field, err = pas.CreatePropertyField("", field)
		require.NoError(t, err)

		targetID := model.NewId()
		value1, err := json.Marshal("initial value")
		require.NoError(t, err)

		values := []*model.PropertyValue{
			{
				GroupID:    nonCpaGroup.ID,
				FieldID:    field.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      value1,
			},
		}

		// Should succeed - plugin2 can upsert values on plugin1's protected field in non-CPA group
		created, err := pas.UpsertPropertyValues(pluginID2, values)
		require.NoError(t, err)
		assert.Len(t, created, 1)

		// Update the value
		value2, err := json.Marshal("updated value")
		require.NoError(t, err)
		values[0].Value = value2

		// Should succeed again
		updated, err := pas.UpsertPropertyValues(pluginID2, values)
		require.NoError(t, err)
		assert.Len(t, updated, 1)

		var retrievedValue string
		err = json.Unmarshal(updated[0].Value, &retrievedValue)
		require.NoError(t, err)
		assert.Equal(t, "updated value", retrievedValue)
	})

	t.Run("mixed CPA and non-CPA groups - enforces access control only on CPA group", func(t *testing.T) {
		// Register a non-CPA group
		nonCpaGroup, err := pas.RegisterPropertyGroup("other-group-mixed")
		require.NoError(t, err)

		// Create protected field in CPA group
		cpaField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "cpa-protected-mixed",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		cpaField, err = pas.CreatePropertyFieldForPlugin(pluginID1, cpaField)
		require.NoError(t, err)

		// Create protected field in non-CPA group
		nonCpaField := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "non-cpa-protected-mixed",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
			},
		}
		nonCpaField, err = pas.CreatePropertyField("", nonCpaField)
		require.NoError(t, err)

		targetID := model.NewId()
		cpaValue, err := json.Marshal("cpa data")
		require.NoError(t, err)
		nonCpaValue, err := json.Marshal("non-cpa data")
		require.NoError(t, err)

		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    cpaField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      cpaValue,
			},
			{
				GroupID:    nonCpaGroup.ID,
				FieldID:    nonCpaField.ID,
				TargetType: "user",
				TargetID:   targetID,
				Value:      nonCpaValue,
			},
		}

		// Should fail - plugin2 cannot create value on CPA group protected field
		created, err := pas.CreatePropertyValues(pluginID2, values)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected")

		// Verify no values were created (atomic failure)
		results, err := pas.SearchPropertyValues(pluginID1, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Empty(t, results)

		results, err = pas.SearchPropertyValues(pluginID1, nonCpaGroup.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Empty(t, results)
	})
}

func TestDeletePropertyField_OrphanedFieldDeletion(t *testing.T) {
	th := Setup(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)
	pas := th.App.PropertyAccessService()

	t.Run("allows deletion of orphaned protected field when plugin is uninstalled", func(t *testing.T) {
		pas.setPluginCheckerForTests(func(pluginID string) bool {
			return false
		})

		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Orphaned Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("removed-plugin", field)
		require.NoError(t, err)

		err = pas.DeletePropertyField("admin-user", groupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("blocks deletion of protected field when plugin is still installed", func(t *testing.T) {
		pas.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "installed-plugin"
		})

		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Active Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("installed-plugin", field)
		require.NoError(t, err)

		err = pas.DeletePropertyField("admin-user", groupID, created.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
		assert.Contains(t, err.Error(), "installed-plugin")

		err = pas.DeletePropertyField("installed-plugin", groupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("blocks update of orphaned protected field even when plugin is uninstalled", func(t *testing.T) {
		pas.setPluginCheckerForTests(func(pluginID string) bool {
			return false
		})

		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Orphaned Field For Update",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := pas.CreatePropertyFieldForPlugin("removed-plugin", field)
		require.NoError(t, err)

		created.Name = "Updated Orphaned Field"
		updated, err := pas.UpdatePropertyField("admin-user", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
	})
}
