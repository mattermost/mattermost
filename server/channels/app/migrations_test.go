// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		//we need to call the Setup method and run the full setup instead of
		//just creating a new server via NewServer() because the Setup method
		//also care of using the correct database DSN based on environment,
		//setting up the store and initializing services used in store such as property services.
		th := Setup(t)
		defer th.TearDown()

		group, err := th.Server.propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
		require.NoError(t, err)
		require.NotNil(t, group)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, err := th.Server.propertyService.SearchPropertyFields(group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 10)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// Now we will remove the migration done key from systems table to allow the data migration to run again
		_, err := th.Store.System().PermanentDeleteByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)

		// Run the content flagging data migration again
		err = th.Server.doSetupContentFlaggingProperties()
		require.NoError(t, err)

		group, err := th.Server.propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
		require.NoError(t, err)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, err := th.Server.propertyService.SearchPropertyFields(group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 10)
	})
}

func TestDoCPAFieldApplyDefaultAttrs(t *testing.T) {
	t.Run("should apply default attrs to existing CPA fields", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// Register CPA property group
		group, err := th.Server.propertyService.RegisterPropertyGroup(model.CustomProfileAttributesPropertyGroupName)
		require.NoError(t, err)

		// Create fields with missing attrs to simulate old data
		fieldWithNilAttrs := &model.PropertyField{
			GroupID: group.ID,
			Name:    "Field with nil attrs",
			Type:    model.PropertyFieldTypeText,
			Attrs:   nil,
		}
		createdField1, err := th.Server.propertyService.CreatePropertyField(fieldWithNilAttrs)
		require.NoError(t, err)

		fieldWithEmptyAttrs := &model.PropertyField{
			GroupID: group.ID,
			Name:    "Field with empty attrs",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{},
		}
		createdField2, err := th.Server.propertyService.CreatePropertyField(fieldWithEmptyAttrs)
		require.NoError(t, err)

		// Remove the migration done key to allow migration to run
		_, err = th.Store.System().PermanentDeleteByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)

		// Run the migration
		err = th.Server.doCPAFieldApplyDefaultAttrs()
		require.NoError(t, err)

		// Verify fields now have default attrs
		updatedField1, err := th.Server.propertyService.GetPropertyField(group.ID, createdField1.ID)
		require.NoError(t, err)
		require.NotNil(t, updatedField1.Attrs)
		require.Equal(t, model.CustomProfileAttributesVisibilityDefault, updatedField1.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
		require.Equal(t, float64(0), updatedField1.Attrs[model.CustomProfileAttributesPropertyAttrsSortOrder])

		updatedField2, err := th.Server.propertyService.GetPropertyField(group.ID, createdField2.ID)
		require.NoError(t, err)
		require.NotNil(t, updatedField2.Attrs)
		require.Equal(t, model.CustomProfileAttributesVisibilityDefault, updatedField2.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
		require.Equal(t, float64(0), updatedField2.Attrs[model.CustomProfileAttributesPropertyAttrsSortOrder])

		// Verify migration key was set
		_, err = th.Store.System().GetByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// Register CPA property group
		group, err := th.Server.propertyService.RegisterPropertyGroup(model.CustomProfileAttributesPropertyGroupName)
		require.NoError(t, err)

		// Create a field with proper attrs
		field := &model.PropertyField{
			GroupID: group.ID,
			Name:    "Field with proper attrs",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityDefault,
				model.CustomProfileAttributesPropertyAttrsSortOrder:  float64(5),
			},
		}
		createdField, err := th.Server.propertyService.CreatePropertyField(field)
		require.NoError(t, err)

		// Remove the migration done key
		_, err = th.Store.System().PermanentDeleteByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)

		// Run the migration first time
		err = th.Server.doCPAFieldApplyDefaultAttrs()
		require.NoError(t, err)

		// Remove the key again and run migration second time
		_, err = th.Store.System().PermanentDeleteByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)
		err = th.Server.doCPAFieldApplyDefaultAttrs()
		require.NoError(t, err)

		// Verify field attrs are still correct and not overwritten
		updatedField, err := th.Server.propertyService.GetPropertyField(group.ID, createdField.ID)
		require.NoError(t, err)
		require.Equal(t, model.CustomProfileAttributesVisibilityDefault, updatedField.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
		require.Equal(t, float64(5), updatedField.Attrs[model.CustomProfileAttributesPropertyAttrsSortOrder])
	})

	t.Run("should handle case where no CPA fields exist", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		// Remove the migration done key
		_, err := th.Store.System().PermanentDeleteByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)

		// Run the migration with no CPA fields
		err = th.Server.doCPAFieldApplyDefaultAttrs()
		require.NoError(t, err)

		// Verify migration key was still set
		_, err = th.Store.System().GetByName(cpaFieldDefaultAttrsMigrationKey)
		require.NoError(t, err)
	})
}
