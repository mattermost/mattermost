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

func TestCheckUnrestrictedFieldReadAccess(t *testing.T) {
	th := Setup(t)
	pas := th.App.PropertyAccessService()

	t.Run("public field allows unrestricted access", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
			},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})

	t.Run("field with no attrs defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   nil,
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})

	t.Run("field with empty access_mode defaults to public", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})

	t.Run("source_only field allows source plugin unrestricted access", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, sourcePluginID)
		assert.NoError(t, err)
	})

	t.Run("source_only field denies other plugin access", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, "other-plugin")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "source_only")
	})

	t.Run("source_only field denies user access", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, model.NewId())
		assert.Error(t, err)
	})

	t.Run("source_only field denies empty caller access", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkUnrestrictedFieldReadAccess(field, "")
		assert.Error(t, err)
	})

	t.Run("shared_only field requires filtering for everyone", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSharedOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		// Even the source plugin needs filtering for shared_only
		err := pas.checkUnrestrictedFieldReadAccess(field, sourcePluginID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "shared_only")

		// Other callers also need filtering
		err = pas.checkUnrestrictedFieldReadAccess(field, "other-plugin")
		assert.Error(t, err)

		err = pas.checkUnrestrictedFieldReadAccess(field, model.NewId())
		assert.Error(t, err)
	})
}

func TestCheckFieldWriteAccess(t *testing.T) {
	th := Setup(t)
	pas := th.App.PropertyAccessService()

	t.Run("unprotected field allows any caller to modify", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected: false,
			},
		}

		err := pas.checkFieldWriteAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})

	t.Run("field with no attrs allows modification", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   nil,
		}

		err := pas.checkFieldWriteAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})

	t.Run("protected field allows source plugin to modify", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkFieldWriteAccess(field, sourcePluginID)
		assert.NoError(t, err)
	})

	t.Run("protected field denies other plugin modification", func(t *testing.T) {
		sourcePluginID := "test-plugin"
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: sourcePluginID,
			},
		}

		err := pas.checkFieldWriteAccess(field, "other-plugin")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "protected")
		assert.Contains(t, err.Error(), sourcePluginID)
	})

	t.Run("protected field with no source plugin allows modification", func(t *testing.T) {
		field := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected: true,
			},
		}

		err := pas.checkFieldWriteAccess(field, "any-caller-id")
		assert.NoError(t, err)
	})
}

func TestExtractOptionIDsFromValue(t *testing.T) {
	th := Setup(t)
	pas := th.App.PropertyAccessService()

	t.Run("extract from select value", func(t *testing.T) {
		value, _ := json.Marshal("option-1")
		optionIDs, err := pas.extractOptionIDsFromValue(model.PropertyFieldTypeSelect, value)

		require.NoError(t, err)
		require.NotNil(t, optionIDs)
		assert.Len(t, optionIDs, 1)
		assert.Contains(t, optionIDs, "option-1")
	})

	t.Run("extract from multiselect value", func(t *testing.T) {
		value, _ := json.Marshal([]string{"option-1", "option-2", "option-3"})
		optionIDs, err := pas.extractOptionIDsFromValue(model.PropertyFieldTypeMultiselect, value)

		require.NoError(t, err)
		require.NotNil(t, optionIDs)
		assert.Len(t, optionIDs, 3)
		assert.Contains(t, optionIDs, "option-1")
		assert.Contains(t, optionIDs, "option-2")
		assert.Contains(t, optionIDs, "option-3")
	})

	t.Run("empty value returns nil", func(t *testing.T) {
		optionIDs, err := pas.extractOptionIDsFromValue(model.PropertyFieldTypeSelect, []byte{})

		require.NoError(t, err)
		assert.Nil(t, optionIDs)
	})

	t.Run("unsupported field type returns error", func(t *testing.T) {
		value, _ := json.Marshal("some-value")
		_, err := pas.extractOptionIDsFromValue(model.PropertyFieldTypeText, value)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "only supports select and multiselect")
	})
}

func TestCopyPropertyField(t *testing.T) {
	th := Setup(t)
	pas := th.App.PropertyAccessService()

	t.Run("creates deep copy of field", func(t *testing.T) {
		original := &model.PropertyField{
			ID:      model.NewId(),
			GroupID: model.NewId(),
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				"key1": "value1",
				"key2": 123,
			},
		}

		copied := pas.copyPropertyField(original)

		// Verify it's a different instance
		assert.False(t, original == copied, "original and copied should be different instances")
		assert.False(t, &original.Attrs == &copied.Attrs, "Attrs maps should be different instances")

		// Verify values are equal
		assert.Equal(t, original.ID, copied.ID)
		assert.Equal(t, original.GroupID, copied.GroupID)
		assert.Equal(t, original.Name, copied.Name)
		assert.Equal(t, original.Type, copied.Type)
		assert.Equal(t, original.Attrs["key1"], copied.Attrs["key1"])
		assert.Equal(t, original.Attrs["key2"], copied.Attrs["key2"])

		// Verify modifying copy doesn't affect original
		copied.Attrs["key1"] = "modified"
		assert.Equal(t, "value1", original.Attrs["key1"])
		assert.Equal(t, "modified", copied.Attrs["key1"])
	})
}
