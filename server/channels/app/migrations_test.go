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

		propertyFields, err := th.Server.propertyService.SearchPropertyFields(group.ID, "", model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 9)
	})
}
