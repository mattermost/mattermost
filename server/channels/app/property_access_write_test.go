// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestCreatePropertyField_SourcePluginIDValidation tests source_plugin_id validation during field creation
func TestCreatePropertyField_SourcePluginIDValidation(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

	t.Run("allows field creation without source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
	})

	t.Run("allows plugin to set itself as source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)
		assert.NotNil(t, created)
		assert.Equal(t, "plugin1", created.Attrs[model.CustomProfileAttributesPropertyAttrsSourcePluginID])
	})

	t.Run("denies plugin setting different source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin2",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.Error(t, err)
		assert.Nil(t, created)
		assert.Contains(t, err.Error(), "plugin2")
	})

	t.Run("denies empty callerID setting source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("", field)
		require.Error(t, err)
		assert.Nil(t, created)
	})
}

// TestUpdatePropertyField_WriteAccessControl tests write access control for field updates
func TestUpdatePropertyField_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin2", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "access denied")
		assert.Contains(t, err.Error(), "plugin1")
	})

	t.Run("denies empty callerID updating protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
	})

	t.Run("prevents changing source_plugin_id", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}

		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		// Try to change source_plugin_id
		created.Attrs[model.CustomProfileAttributesPropertyAttrsSourcePluginID] = "plugin2"
		updated, err := th.App.PropertyAccessService().UpdatePropertyField("plugin1", groupID, created)
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "immutable")
	})
}

// TestUpdatePropertyFields_BulkWriteAccessControl tests bulk field updates with atomic access checking
func TestUpdatePropertyFields_BulkWriteAccessControl(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created2, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field2)
		require.NoError(t, err)

		// Try to update both with plugin2 (should fail atomically)
		created1.Name = "Updated Unprotected"
		created2.Name = "Updated Protected"

		updated, err := th.App.PropertyAccessService().UpdatePropertyFields("plugin2", groupID, []*model.PropertyField{created1, created2})
		require.Error(t, err)
		assert.Nil(t, updated)
		assert.Contains(t, err.Error(), "access denied")

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

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyField("plugin1", groupID, created.ID)
		require.NoError(t, err)
	})

	t.Run("denies non-source plugin deleting protected field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		err = th.App.PropertyAccessService().DeletePropertyField("plugin2", groupID, created.ID)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "access denied")
	})
}

// TestCreatePropertyValue_WriteAccessControl tests write access control for value creation
func TestCreatePropertyValue_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
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

	t.Run("denies non-source plugin creating value for source_only field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "SourceOnly",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
		require.NoError(t, err)

		value := &model.PropertyValue{
			GroupID:    groupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"secret value"`),
		}

		createdValue, err := th.App.PropertyAccessService().CreatePropertyValue("plugin2", value)
		require.Error(t, err)
		assert.Nil(t, createdValue)
		assert.Contains(t, err.Error(), "access denied")
		assert.Contains(t, err.Error(), "source_only")
	})

	t.Run("denies creating value for protected field by non-source", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Protected",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field)
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
		assert.Contains(t, err.Error(), "access denied")
	})
}

// TestDeletePropertyValue_WriteAccessControl tests write access control for value deletion
func TestDeletePropertyValue_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
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
		require.Error(t, err)
		assert.Contains(t, err.Error(), "access denied")
	})

	t.Run("returns nil when deleting non-existent value", func(t *testing.T) {
		err := th.App.PropertyAccessService().DeletePropertyValue("plugin1", groupID, "non-existent-id")
		require.NoError(t, err)
	})
}

// TestDeletePropertyValuesForTarget_WriteAccessControl tests bulk deletion with access control
func TestDeletePropertyValuesForTarget_WriteAccessControl(t *testing.T) {
	th := Setup(t)

	groupID := model.NewId()

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
				model.CustomProfileAttributesPropertyAttrsProtected:      true,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: "plugin1",
			},
		}
		created2, err := th.App.PropertyAccessService().CreatePropertyField("plugin1", field2)
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
		assert.Contains(t, err.Error(), "access denied")

		// Verify values still exist
		values, err := th.App.PropertyAccessService().SearchPropertyValues("plugin1", groupID, model.PropertyValueSearchOpts{
			TargetIDs: []string{targetID},
			PerPage:   10,
		})
		require.NoError(t, err)
		assert.Len(t, values, 2)
	})
}
