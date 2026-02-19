// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestDoSetupBoardsPropertyField(t *testing.T) {
	t.Run("should register property group and board field", func(t *testing.T) {
		th := Setup(t)

		group, err := th.Store.PropertyGroup().Get(model.BoardsPropertyGroupName)
		require.NoError(t, err)
		require.NotNil(t, group)
		require.Equal(t, model.BoardsPropertyGroupName, group.Name)

		field, err := th.Store.PropertyField().GetFieldByName(group.ID, "", model.BoardsPropertyFieldNameBoard)
		require.NoError(t, err)
		require.NotNil(t, field)
		require.Equal(t, model.BoardsPropertyFieldNameBoard, field.Name)
		require.Equal(t, "post", field.ObjectType)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		err := th.Server.doSetupBoardsPropertyField()
		require.NoError(t, err)

		group, err := th.Store.PropertyGroup().Get(model.BoardsPropertyGroupName)
		require.NoError(t, err)

		field, err := th.Store.PropertyField().GetFieldByName(group.ID, "", model.BoardsPropertyFieldNameBoard)
		require.NoError(t, err)
		require.Equal(t, model.BoardsPropertyFieldNameBoard, field.Name)
	})
}

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		//we need to call the Setup method and run the full setup instead of
		//just creating a new server via NewServer() because the Setup method
		//also takes care of using the correct database DSN based on environment,
		//settings, setting up the store and initializing services used in store such as property services.
		th := Setup(t)

		group, err := th.Server.propertyAccessService.GetPropertyGroup(model.ContentFlaggingGroupName)
		require.NoError(t, err)
		require.NotNil(t, group)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, err := th.Server.propertyAccessService.SearchPropertyFields(anonymousCallerId, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 11)

		data, err := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)
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

		group, err := th.Server.propertyAccessService.GetPropertyGroup(model.ContentFlaggingGroupName)
		require.NoError(t, err)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, err := th.Server.propertyAccessService.SearchPropertyFields(anonymousCallerId, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 11)

		data, err := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)
		require.Equal(t, "v5", data.Value)
	})
}
