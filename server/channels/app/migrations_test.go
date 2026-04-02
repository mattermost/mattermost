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

func TestDoSetupBoardsProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.BoardsPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.BoardsPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 2)

		fieldsByName := map[string]*model.PropertyField{}
		for _, f := range propertyFields {
			fieldsByName[f.Name] = f
		}

		assignee := fieldsByName[model.BoardsPropertyFieldAssignee]
		require.NotNil(t, assignee)
		require.Equal(t, model.PropertyFieldTypeUser, assignee.Type)
		require.True(t, assignee.Protected)

		status := fieldsByName[model.BoardsPropertyFieldStatus]
		require.NotNil(t, status)
		require.Equal(t, model.PropertyFieldTypeSelect, status.Type)
		require.True(t, status.Protected)
		require.NotNil(t, status.Attrs["options"])

		data, sysErr := th.Store.System().GetByName(boardsPropertySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, boardsPropertyMigrationVersion, data.Value)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		_, err := th.Store.System().PermanentDeleteByName(boardsPropertySetupDoneKey)
		require.NoError(t, err)

		err = th.Server.doSetupBoardsProperties()
		require.NoError(t, err)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.BoardsPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, model.BoardsPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 2)

		data, sysErr := th.Store.System().GetByName(boardsPropertySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, boardsPropertyMigrationVersion, data.Value)
	})
}
