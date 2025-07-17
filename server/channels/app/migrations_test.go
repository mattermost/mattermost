// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		server, err := NewServer()
		require.NoError(t, err)
		require.NotNil(t, server)

		group, err := server.propertyService.GetPropertyGroup(model.ContentFlaggingGroupName)
		require.NoError(t, err)
		require.NotNil(t, group)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, err := server.propertyService.SearchPropertyFields(group.ID, "", model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 9)
	})
}
