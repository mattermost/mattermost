// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCheckIfRolesGrantPermission(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	cases := []struct {
		roles        []string
		permissionId string
		shouldGrant  bool
	}{
		{[]string{model.SYSTEM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.SYSTEM_ADMIN_ROLE_ID}, "non-existent-permission", false},
		{[]string{model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_READ_CHANNEL.Id, true},
		{[]string{model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, false},
		{[]string{model.SYSTEM_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.CHANNEL_USER_ROLE_ID, model.SYSTEM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.TEAM_USER_ROLE_ID, model.TEAM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
		{[]string{model.TEAM_ADMIN_ROLE_ID, model.TEAM_USER_ROLE_ID}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
	}

	for _, testcase := range cases {
		require.Equal(t, th.App.RolesGrantPermission(testcase.roles, testcase.permissionId), testcase.shouldGrant)
	}

}

func TestChannelRolesGrantPermission(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		require.Equal(t, testData.shouldHavePermission, th.App.RolesGrantPermission([]string{testData.channelRole.Name}, testData.permission.Id), "row: %+v\n", testData.truthTableRow)
	})
}

func TestHasPermissionToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	assert.True(t, th.App.HasPermissionToTeam(th.BasicUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))
	th.RemoveUserFromTeam(th.BasicUser, th.BasicTeam)
	assert.False(t, th.App.HasPermissionToTeam(th.BasicUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))

	assert.True(t, th.App.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	assert.True(t, th.App.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))
	th.RemovePermissionFromRole(model.PERMISSION_LIST_TEAM_CHANNELS.Id, model.TEAM_USER_ROLE_ID)
	assert.True(t, th.App.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))
	th.RemoveUserFromTeam(th.SystemAdminUser, th.BasicTeam)
	assert.True(t, th.App.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PERMISSION_LIST_TEAM_CHANNELS))
}
