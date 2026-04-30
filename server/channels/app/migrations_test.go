// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestDoSetupManagedCategoryProperties(t *testing.T) {
	t.Run("should register the property group and field on fresh install", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.ManagedCategoryPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 1)
		require.Equal(t, model.ManagedCategoryPropertyFieldName, propertyFields[0].Name)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.NotEmpty(t, data.Value)
	})

	t.Run("should upgrade from a pre-v2 setup by incrementing the group version and updating the system key", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)

		// Simulate the pre-v2 state where the migration has run with the legacy "true" marker.
		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: "true"})
		require.NoError(t, sysErr)
		initialVersion := group.Version

		err := th.Server.doSetupManagedCategoryProperties()
		require.NoError(t, err)

		group, appErr = th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, initialVersion+1, group.Version)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, managedCategoryMigrationVersion, data.Value)
	})

	t.Run("should be idempotent when the system key is already at v2", func(t *testing.T) {
		th := Setup(t)

		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: managedCategoryMigrationVersion})
		require.NoError(t, sysErr)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		versionBefore := group.Version

		err := th.Server.doSetupManagedCategoryProperties()
		require.NoError(t, err)

		group, appErr = th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, versionBefore, group.Version)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, managedCategoryMigrationVersion, data.Value)
	})
}

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		//we need to call the Setup method and run the full setup instead of
		//just creating a new server via NewServer() because the Setup method
		//also takes care of using the correct database DSN based on environment,
		//settings, setting up the store and initializing services used in store such as property services.
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ContentFlaggingGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 11)

		data, sysErr := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "v5", data.Value)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		// Now we will remove the migration done key from systems table to allow the data migration to run again
		_, err := th.Store.System().PermanentDeleteByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)

		// Run the content flagging data migration again
		err = th.Server.doSetupContentFlaggingProperties()
		require.NoError(t, err)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ContentFlaggingGroupName)
		require.Nil(t, appErr)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 11)

		data, sysErr := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "v5", data.Value)
	})
}
