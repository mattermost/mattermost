// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestCheckIfRolesGrantPermission(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	cases := []struct {
		roles        []string
		permissionId string
		shouldGrant  bool
	}{
		{[]string{model.SystemAdminRoleId}, model.PermissionManageSystem.Id, true},
		{[]string{model.SystemAdminRoleId}, "non-existent-permission", false},
		{[]string{model.ChannelUserRoleId}, model.PermissionReadChannel.Id, true},
		{[]string{model.ChannelUserRoleId}, model.PermissionManageSystem.Id, false},
		{[]string{model.SystemAdminRoleId, model.ChannelUserRoleId}, model.PermissionManageSystem.Id, true},
		{[]string{model.ChannelUserRoleId, model.SystemAdminRoleId}, model.PermissionManageSystem.Id, true},
		{[]string{model.TeamUserRoleId, model.TeamAdminRoleId}, model.PermissionManageSlashCommands.Id, true},
		{[]string{model.TeamAdminRoleId, model.TeamUserRoleId}, model.PermissionManageSlashCommands.Id, true},
	}

	for _, testcase := range cases {
		require.Equal(t, th.Suite.RolesGrantPermission(testcase.roles, testcase.permissionId), testcase.shouldGrant)
	}

}

func TestChannelRolesGrantPermission(t *testing.T) {
	testPermissionInheritance(t, func(t *testing.T, th *TestHelper, testData permissionInheritanceTestData) {
		require.Equal(t, testData.shouldHavePermission, th.Suite.RolesGrantPermission([]string{testData.channelRole.Name}, testData.permission.Id), "row: %+v\n", testData.truthTableRow)
	})
}

func TestHasPermissionToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	assert.True(t, th.Suite.HasPermissionToTeam(th.BasicUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))
	th.RemoveUserFromTeam(th.BasicUser, th.BasicTeam)
	assert.False(t, th.Suite.HasPermissionToTeam(th.BasicUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))

	assert.True(t, th.Suite.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
	assert.True(t, th.Suite.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))
	th.RemovePermissionFromRole(model.PermissionListTeamChannels.Id, model.TeamUserRoleId)
	assert.True(t, th.Suite.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))
	th.RemoveUserFromTeam(th.SystemAdminUser, th.BasicTeam)
	assert.True(t, th.Suite.HasPermissionToTeam(th.SystemAdminUser.Id, th.BasicTeam.Id, model.PermissionListTeamChannels))
}

func TestSessionHasPermissionToGroup(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	file, e := os.Open("tests/group-role-has-permission.csv")
	require.NoError(t, e)
	defer file.Close()

	b, e := io.ReadAll(file)
	require.NoError(t, e)

	r := csv.NewReader(strings.NewReader(string(b)))
	records, e := r.ReadAll()
	require.NoError(t, e)

	systemRole, err := th.Suite.GetRoleByName(context.Background(), model.SystemUserRoleId)
	require.Nil(t, err)

	groupRole, err := th.Suite.GetRoleByName(context.Background(), model.CustomGroupUserRoleId)
	require.Nil(t, err)

	group, err := th.Suite.CreateGroup(&model.Group{
		Name:           model.NewString(model.NewId()),
		DisplayName:    model.NewId(),
		Source:         model.GroupSourceCustom,
		AllowReference: true,
	})
	require.Nil(t, err)

	permission := model.PermissionDeleteCustomGroup

	for i, row := range records {
		// skip csv header
		if i == 0 {
			continue
		}

		systemRoleHasPermission, e := strconv.ParseBool(row[0])
		require.NoError(t, e)

		isGroupMember, e := strconv.ParseBool(row[1])
		require.NoError(t, e)

		groupRoleHasPermission, e := strconv.ParseBool(row[2])
		require.NoError(t, e)

		permissionShouldBeGranted, e := strconv.ParseBool(row[3])
		require.NoError(t, e)

		if systemRoleHasPermission {
			th.AddPermissionToRole(permission.Id, systemRole.Name)
		} else {
			th.RemovePermissionFromRole(permission.Id, systemRole.Name)
		}

		if isGroupMember {
			_, err := th.Suite.UpsertGroupMember(group.Id, th.BasicUser.Id)
			require.Nil(t, err)
		} else {
			_, err := th.Suite.DeleteGroupMember(group.Id, th.BasicUser.Id)
			if err != nil && err.Id != "app.group.no_rows" {
				t.Error(err)
			}
		}

		if groupRoleHasPermission {
			th.AddPermissionToRole(permission.Id, groupRole.Name)
		} else {
			th.RemovePermissionFromRole(permission.Id, groupRole.Name)
		}

		session, err := th.Suite.CreateSession(&model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}, Roles: systemRole.Name})
		require.Nil(t, err)

		result := th.Suite.SessionHasPermissionToGroup(*session, group.Id, permission)

		if permissionShouldBeGranted {
			require.True(t, result, fmt.Sprintf("row: %v", row))
		} else {
			require.False(t, result, fmt.Sprintf("row: %v", row))
		}
	}
}
