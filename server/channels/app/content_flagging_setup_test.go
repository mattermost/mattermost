// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetContentFlaggingGroupID(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should register content flagging group", func(t *testing.T) {
		groupID, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.NotEmpty(t, groupID)

		// resetting cached value of group ID to ensure second function call goes to DB layer
		contentFlaggingGroupID = ""

		// should not update the group ID when called again
		groupID2, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.Equal(t, groupID, groupID2)
	})

	t.Run("returns cached value if it exists", func(t *testing.T) {
		contentFlaggingGroupID = "cached-group-id"
		groupID, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.Equal(t, "cached-group-id", groupID)
	})
}

func TestSetupContentFlaggingProperties(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cleanup := func() {
		contentFlaggingSetupOnce = sync.Once{} // Reset the once variable to allow re-running the setup

		// Remove the system variable if it exists
		_, err := th.App.Srv().Store().System().PermanentDeleteByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)

		// Remove the property fields
		if contentFlaggingGroupID != "" {
			propertyFields, err := th.App.Srv().propertyService.SearchPropertyFields(contentFlaggingGroupID, "", model.PropertyFieldSearchOpts{PerPage: 100})
			require.NoError(t, err)

			for _, propertyField := range propertyFields {
				fieldErr := th.App.Srv().propertyService.DeletePropertyField(contentFlaggingGroupID, propertyField.ID)
				require.NoError(t, fieldErr)
			}
		}

		// Reset the cached group ID
		contentFlaggingGroupID = ""
	}

	t.Run("should setup content flagging properties", func(t *testing.T) {
		cleanup()

		err := th.App.SetupContentFlaggingProperties()
		require.NoError(t, err)

		groupID, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.NotEmpty(t, groupID)

		propertyFields, err := th.App.Srv().propertyService.SearchPropertyFields(groupID, "", model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 9)
	})

	t.Run("should not setup properties if already done as per variable", func(t *testing.T) {
		cleanup()

		contentFlaggingSetupOnce.Do(func() {
			// no-op
		})

		err := th.App.SetupContentFlaggingProperties()
		require.NoError(t, err)

		groupID, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.NotEmpty(t, groupID)

		propertyFields, err := th.App.Srv().propertyService.SearchPropertyFields(groupID, "", model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 0) // No new properties should be created
	})

	t.Run("should not setup properties if already done in DB", func(t *testing.T) {
		cleanup()

		// Simulate that the setup is already done in the database
		err := th.App.Srv().Store().System().Save(&model.System{Name: contentFlaggingSetupDoneKey, Value: "true"})
		require.NoError(t, err)

		err = th.App.SetupContentFlaggingProperties()
		require.NoError(t, err)

		groupID, err := th.App.GetContentFlaggingGroupID()
		require.NoError(t, err)
		require.NotEmpty(t, groupID)

		propertyFields, err := th.App.Srv().propertyService.SearchPropertyFields(groupID, "", model.PropertyFieldSearchOpts{PerPage: 100})
		require.NoError(t, err)
		require.Len(t, propertyFields, 0) // No new properties should be created
	})
}
