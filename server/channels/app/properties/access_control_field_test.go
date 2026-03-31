// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPropertyFieldReadAccess(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	// only "plugin-1" and "test-plugin" will be checked as installed
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "test-plugin"
	})

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID := model.NewId()

	rctxAnon := RequestContextWithCallerID(th.Context, "")
	rctx1 := RequestContextWithCallerID(th.Context, pluginID1)
	rctx2 := RequestContextWithCallerID(th.Context, pluginID2)
	rctxUser := RequestContextWithCallerID(th.Context, userID)
	rctxTestPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

	t.Run("public field - any caller can read without filtering", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.NoError(t, err)

		// Plugin 1 can read
		retrieved, err := th.service.GetPropertyField(rctx1, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// Plugin 2 can read
		retrieved, err = th.service.GetPropertyField(rctx2, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// User can read
		retrieved, err = th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		// Anonymous caller can read
		retrieved, err = th.service.GetPropertyField(rctxAnon, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})

	t.Run("source_only field - source plugin gets all options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// Source plugin can see all options
		retrieved, err := th.service.GetPropertyField(rctx1, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})

	t.Run("source_only field - other plugin gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// Other plugin gets field but with empty options
		retrieved, err := th.service.GetPropertyField(rctx2, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("source_only field - user gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// User gets field but with empty options
		retrieved, err := th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("source_only field - anonymous caller gets empty options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// Anonymous caller gets field but with empty options
		retrieved, err := th.service.GetPropertyField(rctxAnon, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("shared_only field - caller with values sees filtered options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctxTestPlugin, field)
		require.NoError(t, err)

		// Create values for the caller (userID has opt1 and opt2)
		value1, jsonErr := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, jsonErr)
		_, err = th.service.CreatePropertyValue(rctxTestPlugin, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      value1,
		})
		require.NoError(t, err)

		// User should only see opt1 and opt2
		retrieved, err := th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
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
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctxTestPlugin, field)
		require.NoError(t, err)

		// User has no values for this field
		retrieved, err := th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("shared_only field - source plugin gets all options", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// Source plugin can see all options even without having any values
		retrieved, err := th.service.GetPropertyField(rctx1, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		options := retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any)
		assert.Len(t, options, 3)

		// Other plugin with no values sees empty options
		retrieved, err = th.service.GetPropertyField(rctx2, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})

	t.Run("non-CPA group routes directly to PropertyService without filtering", func(t *testing.T) {
		nonCpaGroup, err := th.service.RegisterPropertyGroup("other-group-routing-read")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID:    nonCpaGroup.ID,
			Name:       "routing-test-non-cpa-source-only",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: pluginID1,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
				},
			},
		}
		rctx1 := RequestContextWithCallerID(th.Context, pluginID1)
		created, err := th.service.CreatePropertyField(rctx1, field)
		require.NoError(t, err)

		// Other plugin sees ALL options (no filtering, goes directly to PropertyService)
		rctx2 := RequestContextWithCallerID(th.Context, "plugin-2")
		retrieved, err := th.service.GetPropertyField(rctx2, nonCpaGroup.ID, created.ID)
		require.NoError(t, err)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)
	})

	t.Run("field with no attrs defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "no-attrs-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      nil,
		}
		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.NoError(t, err)

		// Any caller can read
		retrieved, err := th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
	})

	t.Run("field with empty access_mode defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "empty-access-mode-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs:      model.StringInterface{},
		}
		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.NoError(t, err)

		// Any caller can read
		retrieved, err := th.service.GetPropertyField(rctxUser, th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, retrieved.ID)
	})

	t.Run("field with invalid access_mode is rejected", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		_, err := th.service.CreatePropertyField(rctxAnon, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid access mode")
	})
}

func TestGetPropertyFieldsReadAccess(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "test-plugin"
	})

	pluginID := "plugin-1"
	userID := model.NewId()

	rctxAnon := RequestContextWithCallerID(th.Context, "")
	rctxPlugin := RequestContextWithCallerID(th.Context, pluginID)
	rctxUser := RequestContextWithCallerID(th.Context, userID)
	rctxTestPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

	// Create multiple fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "public-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
		},
	}
	publicField, err := th.service.CreatePropertyField(rctxAnon, publicField)
	require.NoError(t, err)

	sourceOnlyField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
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
	sourceOnlyField, err = th.service.CreatePropertyField(rctxPlugin, sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
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
	sharedOnlyField, err = th.service.CreatePropertyField(rctxTestPlugin, sharedOnlyField)
	require.NoError(t, err)

	// Create a value for userID on the shared field (opt1)
	value, jsonErr := json.Marshal([]string{"opt1"})
	require.NoError(t, jsonErr)
	_, err = th.service.CreatePropertyValue(rctxTestPlugin, &model.PropertyValue{
		GroupID:    th.CPAGroupID,
		FieldID:    sharedOnlyField.ID,
		TargetType: "user",
		TargetID:   userID,
		Value:      value,
	})
	require.NoError(t, err)

	t.Run("source plugin sees all fields with full options", func(t *testing.T) {
		fields, err := th.service.GetPropertyFields(rctxPlugin, th.CPAGroupID, []string{publicField.ID, sourceOnlyField.ID, sharedOnlyField.ID})
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
		fields, err := th.service.GetPropertyFields(rctxUser, th.CPAGroupID, []string{publicField.ID, sourceOnlyField.ID, sharedOnlyField.ID})
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
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "test-plugin"
	})

	pluginID := "plugin-1"
	userID := model.NewId()

	rctxAnon := RequestContextWithCallerID(th.Context, "")
	rctxPlugin := RequestContextWithCallerID(th.Context, pluginID)
	rctxUser := RequestContextWithCallerID(th.Context, userID)
	rctxTestPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

	// Create fields with different access modes
	publicField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "public-search-field",
		Type:       model.PropertyFieldTypeText,
		TargetType: "user",
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModePublic,
		},
	}
	_, err := th.service.CreatePropertyField(rctxAnon, publicField)
	require.NoError(t, err)

	sourceOnlyField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
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
	_, err = th.service.CreatePropertyField(rctxPlugin, sourceOnlyField)
	require.NoError(t, err)

	sharedOnlyField := &model.PropertyField{
		GroupID:    th.CPAGroupID,
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
	sharedOnlyField, err = th.service.CreatePropertyField(rctxTestPlugin, sharedOnlyField)
	require.NoError(t, err)

	// Create value for userID (opt1)
	value, jsonErr := json.Marshal([]string{"opt1"})
	require.NoError(t, jsonErr)
	_, err = th.service.CreatePropertyValue(rctxTestPlugin, &model.PropertyValue{
		GroupID:    th.CPAGroupID,
		FieldID:    sharedOnlyField.ID,
		TargetType: "user",
		TargetID:   userID,
		Value:      value,
	})
	require.NoError(t, err)

	t.Run("search returns all fields with appropriate filtering", func(t *testing.T) {
		// User search
		results, err := th.service.SearchPropertyFields(rctxUser, th.CPAGroupID, model.PropertyFieldSearchOpts{
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
		results, err := th.service.SearchPropertyFields(rctxPlugin, th.CPAGroupID, model.PropertyFieldSearchOpts{
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
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1"
	})

	pluginID := "plugin-1"
	userID := model.NewId()
	targetID := model.NewId()

	rctxPlugin := RequestContextWithCallerID(th.Context, pluginID)
	rctxUser := RequestContextWithCallerID(th.Context, userID)

	t.Run("source_only field by name - filters options for non-source", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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
		created, err := th.service.CreatePropertyField(rctxPlugin, field)
		require.NoError(t, err)

		// Source plugin can see options
		retrieved, err := th.service.GetPropertyFieldByName(rctxPlugin, th.CPAGroupID, targetID, created.Name)
		require.NoError(t, err)
		assert.Len(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any), 1)

		// User sees empty options
		retrieved, err = th.service.GetPropertyFieldByName(rctxUser, th.CPAGroupID, targetID, created.Name)
		require.NoError(t, err)
		assert.Empty(t, retrieved.Attrs[model.PropertyFieldAttributeOptions].([]any))
	})
}

// TestCreatePropertyField_AccessControl tests access control for field creation based on caller type
func TestCreatePropertyField_AccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "security-plugin"
	})

	rctxAnon := RequestContextWithCallerID(th.Context, "")
	rctxUser1 := RequestContextWithCallerID(th.Context, "user-1")
	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxSecurityPlugin := RequestContextWithCallerID(th.Context, "security-plugin")

	// Non-plugin caller tests

	t.Run("non-plugin caller can create field without source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.service.CreatePropertyField(rctxUser1, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		// source_plugin_id is not set for non-plugin callers
		assert.Empty(t, created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("non-plugin caller cannot set source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "plugin-1",
			},
		}

		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "user-id-123"), field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "source_plugin_id can only be set by a plugin")
	})

	t.Run("non-plugin caller cannot set protected", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.service.CreatePropertyField(rctxUser1, field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected can only be set by a plugin")
	})

	t.Run("anonymous caller cannot set source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "plugin-1",
			},
		}

		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "source_plugin_id can only be set by a plugin")
	})

	t.Run("anonymous caller cannot set protected", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "protected can only be set by a plugin")
	})

	t.Run("anonymous caller can create field with empty source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "",
			},
		}

		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
	})

	// Plugin caller tests

	t.Run("plugin caller auto-sets source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "plugin-1", created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("plugin caller overwrites any pre-set source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsSourcePluginID: "malicious-plugin",
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "plugin-1", created.Attrs[model.PropertyAttrsSourcePluginID])
	})

	t.Run("plugin caller can create protected field with source_only access mode", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
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

		created, err := th.service.CreatePropertyField(rctxSecurityPlugin, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "security-plugin", created.Attrs[model.PropertyAttrsSourcePluginID])
		assert.True(t, created.Attrs[model.PropertyAttrsProtected].(bool))
		assert.Equal(t, model.PropertyAccessModeSourceOnly, created.Attrs[model.PropertyAttrsAccessMode])
	})

	t.Run("non-CPA group routes directly to PropertyService without setting source_plugin_id", func(t *testing.T) {
		nonCpaGroup, err := th.service.RegisterPropertyGroup("other-group-create")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		rctx := RequestContextWithCallerID(th.Context, "plugin-2")
		created, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Nil(t, created.Attrs[model.PropertyAttrsSourcePluginID])
	})
}

// TestUpdatePropertyField_WriteAccessControl tests write access control for field updates
func TestUpdatePropertyField_WriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "plugin-2"
	})

	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxPlugin2 := RequestContextWithCallerID(th.Context, "plugin-2")
	rctxAnon := RequestContextWithCallerID(th.Context, "")

	t.Run("allows update of unprotected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Original Name",
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		created.Name = "Updated Name"
		updated, err := th.service.UpdatePropertyField(rctxPlugin2, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.Equal(t, "Updated Name", updated.Name)
	})

	t.Run("allows source plugin to update protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		created.Name = "Updated Protected Field"
		updated, err := th.service.UpdatePropertyField(rctxPlugin1, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.Equal(t, "Updated Protected Field", updated.Name)
	})

	t.Run("denies non-source plugin updating protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.service.UpdatePropertyField(rctxPlugin2, th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
		assert.Contains(t, err.Error(), "plugin-1")
	})

	t.Run("denies empty callerID updating protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected Field Empty Caller",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.service.UpdatePropertyField(rctxAnon, th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("prevents changing source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Field",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Try to change source_plugin_id
		created.Attrs[model.PropertyAttrsSourcePluginID] = "plugin-2"
		updated, err := th.service.UpdatePropertyField(rctxPlugin1, th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "immutable")
	})

	t.Run("prevents setting protected=true without source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Field Without Source Plugin",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}

		created, err := th.service.CreatePropertyField(rctxAnon, field)
		require.NoError(t, err)

		// Try to set protected=true without having a source_plugin_id
		created.Attrs[model.PropertyAttrsProtected] = true
		updated, err := th.service.UpdatePropertyField(rctxPlugin1, th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "cannot set protected=true")
		assert.Contains(t, err.Error(), "source_plugin_id")
	})

	t.Run("prevents non-source plugin from setting protected=true", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Field With Source Plugin",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}

		// Create field via plugin-1 (sets source_plugin_id automatically)
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		assert.False(t, model.IsPropertyFieldProtected(created))

		// Try to set protected=true by a different plugin (plugin-2)
		created.Attrs[model.PropertyAttrsProtected] = true
		updated, err := th.service.UpdatePropertyField(rctxPlugin2, th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "cannot set protected=true")
		assert.Contains(t, err.Error(), "plugin-1")

		// Verify the source plugin (plugin-1) CAN set protected=true
		updated, err = th.service.UpdatePropertyField(rctxPlugin1, th.CPAGroupID, created)
		require.NoError(t, err)
		assert.True(t, model.IsPropertyFieldProtected(updated))
	})

	t.Run("non-CPA group routes directly to PropertyService without access control", func(t *testing.T) {
		nonCpaGroup, err := th.service.RegisterPropertyGroup("other-group-update")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    "Non-CPA Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin-1",
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Update with different plugin - should be allowed (no access control)
		created.Name = "Updated by Plugin2"
		updated, err := th.service.UpdatePropertyField(rctxPlugin2, nonCpaGroup.ID, created)
		require.NoError(t, err)
		assert.NotNil(t, updated)
		assert.Equal(t, "Updated by Plugin2", updated.Name)
	})
}

// TestUpdatePropertyFields_BulkWriteAccessControl tests bulk field updates with atomic access checking
func TestUpdatePropertyFields_BulkWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "plugin-2"
	})

	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxPlugin2 := RequestContextWithCallerID(th.Context, "plugin-2")

	t.Run("allows bulk update of unprotected fields", func(t *testing.T) {
		field1 := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Field1", Type: model.PropertyFieldTypeText}
		field2 := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Field2", Type: model.PropertyFieldTypeText}

		created1, err := th.service.CreatePropertyField(rctxPlugin1, field1)
		require.NoError(t, err)
		created2, err := th.service.CreatePropertyField(rctxPlugin1, field2)
		require.NoError(t, err)

		created1.Name = "Updated Field1"
		created2.Name = "Updated Field2"

		updated, _, err := th.service.UpdatePropertyFields(rctxPlugin2, th.CPAGroupID, []*model.PropertyField{created1, created2})
		require.NoError(t, err)
		assert.Len(t, updated, 2)
	})

	t.Run("fails atomically when one protected field in batch", func(t *testing.T) {
		// Create unprotected field
		field1 := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Unprotected", Type: model.PropertyFieldTypeText}
		created1, err := th.service.CreatePropertyField(rctxPlugin1, field1)
		require.NoError(t, err)

		// Create protected field
		field2 := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created2, err := th.service.CreatePropertyField(rctxPlugin1, field2)
		require.NoError(t, err)

		// Try to update both with plugin2 (should fail atomically)
		created1.Name = "Updated Unprotected"
		created2.Name = "Updated Protected"

		updated, _, err := th.service.UpdatePropertyFields(rctxPlugin2, th.CPAGroupID, []*model.PropertyField{created1, created2})
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")

		// Verify neither was updated
		check1, err := th.service.GetPropertyField(rctxPlugin1, th.CPAGroupID, created1.ID)
		require.NoError(t, err)
		assert.Equal(t, "Unprotected", check1.Name)

		check2, err := th.service.GetPropertyField(rctxPlugin1, th.CPAGroupID, created2.ID)
		require.NoError(t, err)
		assert.Equal(t, "Protected", check2.Name)
	})

	t.Run("fails atomically when trying to set protected=true without source_plugin_id in batch", func(t *testing.T) {
		rctxAnon := RequestContextWithCallerID(th.Context, "")

		// Create two unprotected fields without source_plugin_id
		field1 := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Field1", Type: model.PropertyFieldTypeText, Attrs: model.StringInterface{}}
		field2 := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Field2", Type: model.PropertyFieldTypeText, Attrs: model.StringInterface{}}

		created1, err := th.service.CreatePropertyField(rctxAnon, field1)
		require.NoError(t, err)
		created2, err := th.service.CreatePropertyField(rctxAnon, field2)
		require.NoError(t, err)

		// Try to set protected=true on field2 without source_plugin_id
		created1.Name = "Updated Field1"
		created2.Attrs[model.PropertyAttrsProtected] = true

		updated, _, err := th.service.UpdatePropertyFields(rctxPlugin1, th.CPAGroupID, []*model.PropertyField{created1, created2})
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "cannot set protected=true")
		assert.Contains(t, err.Error(), "source_plugin_id")

		// Verify neither was updated (atomic failure)
		check1, err := th.service.GetPropertyField(rctxPlugin1, th.CPAGroupID, created1.ID)
		require.NoError(t, err)
		assert.Equal(t, "Field1", check1.Name)

		check2, err := th.service.GetPropertyField(rctxPlugin1, th.CPAGroupID, created2.ID)
		require.NoError(t, err)
		assert.False(t, model.IsPropertyFieldProtected(check2))
	})
}

// TestDeletePropertyField_WriteAccessControl tests write access control for field deletion
func TestDeletePropertyField_WriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "plugin-1" })

	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxPlugin2 := RequestContextWithCallerID(th.Context, "plugin-2")

	t.Run("allows deletion of unprotected field", func(t *testing.T) {
		field := &model.PropertyField{GroupID: th.CPAGroupID, Name: "Unprotected", Type: model.PropertyFieldTypeText}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		err = th.service.DeletePropertyField(rctxPlugin2, th.CPAGroupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("allows source plugin to delete protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		err = th.service.DeletePropertyField(rctxPlugin1, th.CPAGroupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("denies non-source plugin deleting protected field", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "plugin-1"
		})

		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		err = th.service.DeletePropertyField(rctxPlugin2, th.CPAGroupID, created.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
	})

	t.Run("non-CPA group routes directly to PropertyService without access control", func(t *testing.T) {
		nonCpaGroup, err := th.service.RegisterPropertyGroup("other-group-delete")
		require.NoError(t, err)

		field := &model.PropertyField{
			GroupID: nonCpaGroup.ID,
			Name:    "Non-CPA Delete Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "plugin-1",
			},
		}

		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)

		// Delete with different plugin - should be allowed (no access control)
		err = th.service.DeletePropertyField(rctxPlugin2, nonCpaGroup.ID, created.ID)
		require.NoError(t, err)
	})
}

func TestDeletePropertyField_OrphanedFieldDeletion(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "plugin-1" })

	t.Run("allows deletion of orphaned protected field when plugin is uninstalled", func(t *testing.T) {
		// Create the field while the plugin is still installed
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "removed-plugin"
		})

		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Orphaned Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "removed-plugin"), field)
		require.NoError(t, err)

		// Simulate plugin uninstall
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return false
		})

		err = th.service.DeletePropertyField(RequestContextWithCallerID(th.Context, "admin-user"), th.CPAGroupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("blocks deletion of protected field when plugin is still installed", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "installed-plugin"
		})

		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Active Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "installed-plugin"), field)
		require.NoError(t, err)

		err = th.service.DeletePropertyField(RequestContextWithCallerID(th.Context, "admin-user"), th.CPAGroupID, created.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
		assert.Contains(t, err.Error(), "installed-plugin")

		err = th.service.DeletePropertyField(RequestContextWithCallerID(th.Context, "installed-plugin"), th.CPAGroupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("blocks update of orphaned protected field even when plugin is uninstalled", func(t *testing.T) {
		// Create the field while the plugin is still installed
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "removed-plugin"
		})

		field := &model.PropertyField{
			GroupID: th.CPAGroupID,
			Name:    "Orphaned Field For Update",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsProtected: true,
			},
		}
		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "removed-plugin"), field)
		require.NoError(t, err)

		// Simulate plugin uninstall
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return false
		})

		created.Name = "Updated Orphaned Field"
		updated, err := th.service.UpdatePropertyField(RequestContextWithCallerID(th.Context, "admin-user"), th.CPAGroupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "protected")
	})
}

func TestLinkedPropertyField_SecurityInheritance(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-1" || pluginID == "plugin-2"
	})

	rctxPlugin1 := RequestContextWithCallerID(th.Context, "plugin-1")
	rctxPlugin2 := RequestContextWithCallerID(th.Context, "plugin-2")
	rctxUser := RequestContextWithCallerID(th.Context, "user-1")

	sysadminLevel := model.PermissionLevelSysadmin

	// Helper: create a protected template in the CPA group owned by plugin-1
	createProtectedTemplate := func(t *testing.T, name string, accessMode string) *model.PropertyField {
		t.Helper()
		attrs := model.StringInterface{
			model.PropertyAttrsProtected:  true,
			model.PropertyAttrsAccessMode: accessMode,
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "Option A"},
				map[string]any{"id": model.NewId(), "name": "Option B"},
			},
		}
		field := &model.PropertyField{
			GroupID:           th.CPAGroupID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Type:              model.PropertyFieldTypeSelect,
			Name:              name,
			Attrs:             attrs,
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		return created
	}

	// Helper: create an unprotected template in the CPA group
	createUnprotectedTemplate := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       name,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
		}
		created, err := th.service.CreatePropertyField(rctxPlugin1, field)
		require.NoError(t, err)
		return created
	}

	t.Run("source plugin can create linked field from protected template", func(t *testing.T) {
		source := createProtectedTemplate(t, "ProtectedSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		linked, err := th.service.CreatePropertyField(rctxPlugin1, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)

		// Verify security attrs inherited
		assert.True(t, model.IsPropertyFieldProtected(linked))
		assert.Equal(t, "plugin-1", linked.Attrs[model.PropertyAttrsSourcePluginID])
		assert.Equal(t, model.PropertyAccessModeSourceOnly, linked.Attrs[model.PropertyAttrsAccessMode])
	})

	t.Run("different plugin cannot create linked field from protected template", func(t *testing.T) {
		source := createProtectedTemplate(t, "ProtectedSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		_, err := th.service.CreatePropertyField(rctxPlugin2, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "only the source plugin")
	})

	t.Run("non-plugin caller cannot create linked field from protected template", func(t *testing.T) {
		source := createProtectedTemplate(t, "ProtectedSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		_, err := th.service.CreatePropertyField(rctxUser, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "only the source plugin")
	})

	t.Run("linked field inherits Protected and attrs from source", func(t *testing.T) {
		source := createProtectedTemplate(t, "InheritSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		linked, err := th.service.CreatePropertyField(rctxPlugin1, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)

		assert.Equal(t, source.Protected, linked.Protected)
		assert.Equal(t, source.Attrs[model.PropertyAttrsProtected], linked.Attrs[model.PropertyAttrsProtected])
		assert.Equal(t, source.Attrs[model.PropertyAttrsSourcePluginID], linked.Attrs[model.PropertyAttrsSourcePluginID])
		assert.Equal(t, source.Attrs[model.PropertyAttrsAccessMode], linked.Attrs[model.PropertyAttrsAccessMode])
	})

	t.Run("linked field inherits permission levels from source", func(t *testing.T) {
		source := createProtectedTemplate(t, "PermSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		linked, err := th.service.CreatePropertyField(rctxPlugin1, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)

		require.NotNil(t, linked.PermissionField)
		require.NotNil(t, linked.PermissionValues)
		require.NotNil(t, linked.PermissionOptions)
		assert.Equal(t, *source.PermissionField, *linked.PermissionField)
		assert.Equal(t, *source.PermissionValues, *linked.PermissionValues)
		assert.Equal(t, *source.PermissionOptions, *linked.PermissionOptions)
	})

	t.Run("linked field inherits source access_mode even if caller supplies different value", func(t *testing.T) {
		source := createProtectedTemplate(t, "MismatchSource-"+model.NewId(), model.PropertyAccessModeSourceOnly)

		linked, err := th.service.CreatePropertyField(rctxPlugin1, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "Linked-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			},
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		// Caller supplied shared_only but source's source_only is inherited
		assert.Equal(t, model.PropertyAccessModeSourceOnly, linked.Attrs[model.PropertyAttrsAccessMode])
	})

	t.Run("linked field from unprotected template does not inherit protection", func(t *testing.T) {
		source := createUnprotectedTemplate(t, "UnprotectedSource-"+model.NewId())

		linked, err := th.service.CreatePropertyField(rctxPlugin1, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)

		assert.False(t, model.IsPropertyFieldProtected(linked))
	})

	t.Run("non-plugin caller can create linked field from unprotected template", func(t *testing.T) {
		source := createUnprotectedTemplate(t, "UnprotectedSource-"+model.NewId())

		linked, err := th.service.CreatePropertyField(rctxUser, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		assert.False(t, model.IsPropertyFieldProtected(linked))
	})
}
