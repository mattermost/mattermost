// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestRegisterPluginPermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	t.Cleanup(model.ResetPluginPermissionRegistryForTest)

	pluginID := "com.example.plugin"
	permission := &model.PluginPermission{
		Id:           "manage_thing",
		Name:         "Manage thing",
		Description:  "Allows managing things",
		Scope:        model.PermissionScopeChannel,
		DefaultRoles: []string{model.ChannelAdminRoleId},
	}

	appErr := th.App.RegisterPluginPermission(th.Context, pluginID, permission)
	require.Nil(t, appErr)
	require.Equal(t, model.PluginPermissionId(pluginID, "manage_thing"), permission.PermissionId)

	assert.True(t, model.IsRegisteredPluginPermission(permission.PermissionId))

	systemAdmin, appErr := th.App.GetRoleByName(th.Context, model.SystemAdminRoleId)
	require.Nil(t, appErr)
	assert.Contains(t, systemAdmin.Permissions, permission.PermissionId)

	channelAdmin, appErr := th.App.GetRoleByName(th.Context, model.ChannelAdminRoleId)
	require.Nil(t, appErr)
	assert.Contains(t, channelAdmin.Permissions, permission.PermissionId)

	t.Run("second register does not reapply defaults", func(t *testing.T) {
		channelAdmin.Permissions = sliceWithout(channelAdmin.Permissions, permission.PermissionId)
		_, appErr = th.App.UpdateRole(channelAdmin)
		require.Nil(t, appErr)

		appErr = th.App.RegisterPluginPermission(th.Context, pluginID, permission)
		require.Nil(t, appErr)

		channelAdmin, appErr = th.App.GetRoleByName(th.Context, model.ChannelAdminRoleId)
		require.Nil(t, appErr)
		assert.NotContains(t, channelAdmin.Permissions, permission.PermissionId)
	})

	t.Run("rejects core permission collision via local id", func(t *testing.T) {
		appErr := th.App.RegisterPluginPermission(th.Context, pluginID, &model.PluginPermission{
			Id:    "Manage_System",
			Name:  "Nope",
			Scope: model.PermissionScopeSystem,
		})
		require.NotNil(t, appErr)
	})

	t.Run("rejects invalid scope", func(t *testing.T) {
		appErr := th.App.RegisterPluginPermission(th.Context, pluginID, &model.PluginPermission{
			Id:    "other_thing",
			Name:  "Other",
			Scope: model.PermissionScopePlaybook,
		})
		require.NotNil(t, appErr)
	})
}

func TestRegisterPluginRoleAndAssignment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	t.Cleanup(model.ResetPluginPermissionRegistryForTest)

	pluginID := "com.example.roles"
	appErr := th.App.RegisterPluginPermission(th.Context, pluginID, &model.PluginPermission{
		Id:    "manage_thing",
		Name:  "Manage thing",
		Scope: model.PermissionScopeSystem,
	})
	require.Nil(t, appErr)

	role, appErr := th.App.RegisterPluginRole(th.Context, pluginID, &model.PluginRole{
		Name:        "admin",
		DisplayName: "Thing Admin",
		Description: "Administer things",
		Permissions: []string{"manage_thing"},
	})
	require.Nil(t, appErr)
	require.Equal(t, model.PluginRoleName(pluginID, "admin"), role.Name)
	assert.Contains(t, role.Permissions, model.PluginPermissionId(pluginID, "manage_thing"))

	user, appErr := th.App.AssignPluginRole(th.Context, pluginID, th.BasicUser.Id, "admin")
	require.Nil(t, appErr)
	assert.Contains(t, user.GetRoles(), role.Name)
	assert.True(t, th.App.HasPermissionTo(th.BasicUser.Id, &model.Permission{Id: model.PluginPermissionId(pluginID, "manage_thing")}))

	user, appErr = th.App.RemovePluginRole(th.Context, pluginID, th.BasicUser.Id, "admin")
	require.Nil(t, appErr)
	assert.NotContains(t, user.GetRoles(), role.Name)

	t.Run("cannot put another plugin's permission on the role", func(t *testing.T) {
		other := "com.example.other"
		require.Nil(t, th.App.RegisterPluginPermission(th.Context, other, &model.PluginPermission{
			Id:    "manage_thing",
			Name:  "Other",
			Scope: model.PermissionScopeSystem,
		}))
		_, appErr := th.App.RegisterPluginRole(th.Context, pluginID, &model.PluginRole{
			Name:        "admin",
			DisplayName: "Thing Admin",
			Permissions: []string{model.PluginPermissionId(other, "manage_thing")},
		})
		require.NotNil(t, appErr)
	})
}

func TestPurgePluginRBAC(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	t.Cleanup(model.ResetPluginPermissionRegistryForTest)

	pluginID := "com.example.purge"
	permission := &model.PluginPermission{
		Id:           "manage_thing",
		Name:         "Manage thing",
		Scope:        model.PermissionScopeChannel,
		DefaultRoles: []string{model.ChannelAdminRoleId},
	}
	require.Nil(t, th.App.RegisterPluginPermission(th.Context, pluginID, permission))
	role, appErr := th.App.RegisterPluginRole(th.Context, pluginID, &model.PluginRole{
		Name:        "admin",
		DisplayName: "Thing Admin",
		Permissions: []string{"manage_thing"},
	})
	require.Nil(t, appErr)

	require.Nil(t, th.App.PurgePluginRBAC(th.Context, pluginID))
	assert.False(t, model.IsRegisteredPluginPermission(permission.PermissionId))

	channelAdmin, appErr := th.App.GetRoleByName(th.Context, model.ChannelAdminRoleId)
	require.Nil(t, appErr)
	assert.NotContains(t, channelAdmin.Permissions, permission.PermissionId)

	deleted, appErr := th.App.GetRoleByName(th.Context, role.Name)
	require.Nil(t, appErr)
	assert.NotEqual(t, int64(0), deleted.DeleteAt)
}

func sliceWithout(in []string, drop string) []string {
	out := make([]string, 0, len(in))
	for _, v := range in {
		if v != drop {
			out = append(out, v)
		}
	}
	return out
}
