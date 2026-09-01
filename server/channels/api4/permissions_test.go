// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetPluginPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	t.Cleanup(model.ResetPluginPermissionRegistryForTest)

	pluginID := "com.example.api"
	appErr := th.App.RegisterPluginPermission(th.Context, pluginID, &model.PluginPermission{
		Id:          "manage_thing",
		Name:        "Manage thing",
		Description: "Allows managing things",
		Scope:       model.PermissionScopeSystem,
	})
	require.Nil(t, appErr)

	t.Run("forbidden for regular user", func(t *testing.T) {
		_, resp, err := th.Client.GetPluginPermissions(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("system admin can list registered permissions", func(t *testing.T) {
		permissions, _, err := th.SystemAdminClient.GetPluginPermissions(context.Background())
		require.NoError(t, err)
		require.NotEmpty(t, permissions)

		var found *model.PluginPermission
		for _, p := range permissions {
			if p.PermissionId == model.PluginPermissionId(pluginID, "manage_thing") {
				found = p
				break
			}
		}
		require.NotNil(t, found)
		assert.Equal(t, "Manage thing", found.Name)
		assert.Equal(t, model.PermissionScopeSystem, found.Scope)
	})
}

func TestGetAncillaryPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var subsectionPermissions []string
	var expectedAncillaryPermissions []string
	t.Run("Valid Case, Passing in SubSection Permissions", func(t *testing.T) {
		subsectionPermissions = []string{model.PermissionSysconsoleReadReportingSiteStatistics.Id}
		expectedAncillaryPermissions = []string{model.PermissionGetAnalytics.Id}
		actualAncillaryPermissions, _, err := th.Client.GetAncillaryPermissions(context.Background(), subsectionPermissions)
		require.NoError(t, err)
		assert.Equal(t, append(subsectionPermissions, expectedAncillaryPermissions...), actualAncillaryPermissions)
	})

	t.Run("Invalid Case, Passing in SubSection Permissions That Don't Exist", func(t *testing.T) {
		subsectionPermissions = []string{"All", "The", "Things", "She", "Said", "Running", "Through", "My", "Head"}
		expectedAncillaryPermissions = []string{}
		actualAncillaryPermissions, _, err := th.Client.GetAncillaryPermissions(context.Background(), subsectionPermissions)
		require.NoError(t, err)
		assert.Equal(t, append(subsectionPermissions, expectedAncillaryPermissions...), actualAncillaryPermissions)
	})

	t.Run("Invalid Case, Passing in nothing", func(t *testing.T) {
		subsectionPermissions = []string{}
		expectedAncillaryPermissions = []string{}
		_, resp, err := th.Client.GetAncillaryPermissions(context.Background(), subsectionPermissions)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
