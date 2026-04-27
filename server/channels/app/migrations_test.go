// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestDoSetupChannelPostProperties(t *testing.T) {
	t.Run("should register the channel post properties group", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ChannelPostPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.ChannelPostPropertyGroupName, group.Name)
		require.Equal(t, model.PropertyGroupVersionV2, group.Version)

		data, sysErr := th.Store.System().GetByName(channelPostPropertiesSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "true", data.Value)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ChannelPostPropertyGroupName)
		require.Nil(t, appErr)
		originalGroupID := group.ID

		// Remove the migration done key from systems table to allow the
		// migration to run again.
		_, err := th.Store.System().PermanentDeleteByName(channelPostPropertiesSetupDoneKey)
		require.NoError(t, err)

		err = th.Server.doSetupChannelPostProperties()
		require.NoError(t, err)

		group, appErr = th.App.GetPropertyGroup(th.Context, model.ChannelPostPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, originalGroupID, group.ID, "re-running the migration must not create a new group")

		data, sysErr := th.Store.System().GetByName(channelPostPropertiesSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "true", data.Value)
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
