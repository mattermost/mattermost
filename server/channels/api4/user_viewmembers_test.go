// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestAPIRestrictedViewMembers(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create first account for system admin
	_, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user0", Password: "test-password-0", Username: "test-user-0", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)

	user1, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user1", Password: "test-password-1", Username: "test-user-1", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)
	user2, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user2", Password: "test-password-2", Username: "test-user-2", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)
	user3, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user3", Password: "test-password-3", Username: "test-user-3", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)
	user4, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user4", Password: "test-password-4", Username: "test-user-4", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)
	user5, appErr := th.App.CreateUser(th.Context, &model.User{Email: th.GenerateTestEmail(), Nickname: "test user5", Password: "test-password-5", Username: "test-user-5", Roles: model.SystemUserRoleId})
	require.Nil(t, appErr)

	team1, appErr := th.App.CreateTeam(th.Context, &model.Team{DisplayName: "dn_" + model.NewId(), Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen})
	require.Nil(t, appErr)
	team2, appErr := th.App.CreateTeam(th.Context, &model.Team{DisplayName: "dn_" + model.NewId(), Name: GenerateTestTeamName(), Email: th.GenerateTestEmail(), Type: model.TeamOpen})
	require.Nil(t, appErr)

	channel1, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "dn_" + model.NewId(), Name: "name_" + model.NewId(), Type: model.ChannelTypeOpen, TeamId: team1.Id, CreatorId: model.NewId()}, false)
	require.Nil(t, appErr)
	channel2, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "dn_" + model.NewId(), Name: "name_" + model.NewId(), Type: model.ChannelTypeOpen, TeamId: team1.Id, CreatorId: model.NewId()}, false)
	require.Nil(t, appErr)
	channel3, appErr := th.App.CreateChannel(th.Context, &model.Channel{DisplayName: "dn_" + model.NewId(), Name: "name_" + model.NewId(), Type: model.ChannelTypeOpen, TeamId: team2.Id, CreatorId: model.NewId()}, false)
	require.Nil(t, appErr)

	th.LinkUserToTeam(user1, team1)
	th.LinkUserToTeam(user2, team1)
	th.LinkUserToTeam(user3, team2)
	th.LinkUserToTeam(user4, team1)
	th.LinkUserToTeam(user4, team2)

	th.AddUserToChannel(user1, channel1)
	th.AddUserToChannel(user2, channel2)
	th.AddUserToChannel(user3, channel3)
	th.AddUserToChannel(user4, channel1)
	th.AddUserToChannel(user4, channel3)

	th.App.SetStatusOnline(user1.Id, true)
	th.App.SetStatusOnline(user2.Id, true)
	th.App.SetStatusOnline(user3.Id, true)
	th.App.SetStatusOnline(user4.Id, true)
	th.App.SetStatusOnline(user5.Id, true)

	_, _, err := th.Client.Login(user1.Username, "test-password-1")
	require.NoError(t, err)

	t.Run("getUser", func(t *testing.T) {
		testCases := []struct {
			Name          string
			RestrictedTo  string
			UserId        string
			ExpectedError string
		}{
			{
				"Get visible user without restrictions",
				"",
				user5.Id,
				"",
			},
			{
				"Get not existing user without restrictions",
				"",
				model.NewId(),
				"app.user.missing_account.const",
			},
			{
				"Get not existing user with restrictions to teams",
				"teams",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to teams",
				"teams",
				user2.Id,
				"",
			},
			{
				"Get not visible user with restrictions to teams",
				"teams",
				user5.Id,
				"api.context.permissions.app_error",
			},
			{
				"Get not existing user with restrictions to channels",
				"channels",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to channels",
				"channels",
				user4.Id,
				"",
			},
			{
				"Get not visible user with restrictions to channels",
				"channels",
				user3.Id,
				"api.context.permissions.app_error",
			},
		}
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				if tc.RestrictedTo == "channels" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else if tc.RestrictedTo == "teams" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
				}

				_, _, err := th.Client.GetUser(tc.UserId, "")
				if tc.ExpectedError != "" {
					CheckErrorID(t, err, tc.ExpectedError)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})

	t.Run("getUserByUsername", func(t *testing.T) {
		testCases := []struct {
			Name          string
			RestrictedTo  string
			Username      string
			ExpectedError string
		}{
			{
				"Get visible user without restrictions",
				"",
				user5.Username,
				"",
			},
			{
				"Get not existing user without restrictions",
				"",
				model.NewId(),
				"app.user.get_by_username.app_error",
			},
			{
				"Get not existing user with restrictions to teams",
				"teams",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to teams",
				"teams",
				user2.Username,
				"",
			},
			{
				"Get not visible user with restrictions to teams",
				"teams",
				user5.Username,
				"api.context.permissions.app_error",
			},
			{
				"Get not existing user with restrictions to channels",
				"channels",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to channels",
				"channels",
				user4.Username,
				"",
			},
			{
				"Get not visible user with restrictions to channels",
				"channels",
				user3.Username,
				"api.context.permissions.app_error",
			},
		}
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				if tc.RestrictedTo == "channels" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else if tc.RestrictedTo == "teams" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
				}

				_, _, err := th.Client.GetUserByUsername(tc.Username, "")
				if tc.ExpectedError != "" {
					CheckErrorID(t, err, tc.ExpectedError)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})

	t.Run("getUserByEmail", func(t *testing.T) {
		testCases := []struct {
			Name          string
			RestrictedTo  string
			Email         string
			ExpectedError string
		}{
			{
				"Get visible user without restrictions",
				"",
				user5.Email,
				"",
			},
			{
				"Get not existing user without restrictions",
				"",
				th.GenerateTestEmail(),
				"app.user.missing_account.const",
			},
			{
				"Get not existing user with restrictions to teams",
				"teams",
				th.GenerateTestEmail(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to teams",
				"teams",
				user2.Email,
				"",
			},
			{
				"Get not visible user with restrictions to teams",
				"teams",
				user5.Email,
				"api.context.permissions.app_error",
			},
			{
				"Get not existing user with restrictions to channels",
				"channels",
				th.GenerateTestEmail(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to channels",
				"channels",
				user4.Email,
				"",
			},
			{
				"Get not visible user with restrictions to channels",
				"channels",
				user3.Email,
				"api.context.permissions.app_error",
			},
		}
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				if tc.RestrictedTo == "channels" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else if tc.RestrictedTo == "teams" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
				}

				_, _, err := th.Client.GetUserByEmail(tc.Email, "")
				if tc.ExpectedError != "" {
					CheckErrorID(t, err, tc.ExpectedError)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})

	t.Run("getDefaultProfileImage", func(t *testing.T) {
		testCases := []struct {
			Name          string
			RestrictedTo  string
			UserId        string
			ExpectedError string
		}{
			{
				"Get visible user without restrictions",
				"",
				user5.Id,
				"",
			},
			{
				"Get not existing user without restrictions",
				"",
				model.NewId(),
				"app.user.missing_account.const",
			},
			{
				"Get not existing user with restrictions to teams",
				"teams",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to teams",
				"teams",
				user2.Id,
				"",
			},
			{
				"Get not visible user with restrictions to teams",
				"teams",
				user5.Id,
				"api.context.permissions.app_error",
			},
			{
				"Get not existing user with restrictions to channels",
				"channels",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to channels",
				"channels",
				user4.Id,
				"",
			},
			{
				"Get not visible user with restrictions to channels",
				"channels",
				user3.Id,
				"api.context.permissions.app_error",
			},
		}
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				if tc.RestrictedTo == "channels" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else if tc.RestrictedTo == "teams" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
				}

				_, _, err := th.Client.GetDefaultProfileImage(tc.UserId)
				if tc.ExpectedError != "" {
					CheckErrorID(t, err, tc.ExpectedError)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})

	t.Run("getProfileImage", func(t *testing.T) {
		testCases := []struct {
			Name          string
			RestrictedTo  string
			UserId        string
			ExpectedError string
		}{
			{
				"Get visible user without restrictions",
				"",
				user5.Id,
				"",
			},
			{
				"Get not existing user without restrictions",
				"",
				model.NewId(),
				"app.user.missing_account.const",
			},
			{
				"Get not existing user with restrictions to teams",
				"teams",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to teams",
				"teams",
				user2.Id,
				"",
			},
			{
				"Get not visible user with restrictions to teams",
				"teams",
				user5.Id,
				"api.context.permissions.app_error",
			},
			{
				"Get not existing user with restrictions to channels",
				"channels",
				model.NewId(),
				"api.context.permissions.app_error",
			},
			{
				"Get visible user with restrictions to channels",
				"channels",
				user4.Id,
				"",
			},
			{
				"Get not visible user with restrictions to channels",
				"channels",
				user3.Id,
				"api.context.permissions.app_error",
			},
		}
		defer th.RestoreDefaultRolePermissions(th.SaveDefaultRolePermissions())

		for _, tc := range testCases {
			t.Run(tc.Name, func(t *testing.T) {
				if tc.RestrictedTo == "channels" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else if tc.RestrictedTo == "teams" {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
				} else {
					th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.TeamUserRoleId)
					th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
				}

				_, _, err := th.Client.GetProfileImage(tc.UserId, "")
				if tc.ExpectedError != "" {
					CheckErrorID(t, err, tc.ExpectedError)
				} else {
					require.NoError(t, err)
				}
			})
		}
	})
}
