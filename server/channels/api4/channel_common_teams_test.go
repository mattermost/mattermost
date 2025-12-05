// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetDirectOrGroupMessageMembersCommonTeams(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	client := th.Client

	t.Run("requires authentication", func(t *testing.T) {
		user1 := th.BasicUser
		user2 := th.BasicUser2

		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		dmChannel, _, err := testClient.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		_, err = testClient.Logout(context.Background())
		require.NoError(t, err)

		_, resp, err := testClient.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), dmChannel.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("forbids guest users", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.GuestAccountsSettings.Enable = true
		})
		th.App.Srv().SetLicense(model.NewTestLicense())

		guestUser, guestClient := th.CreateGuestAndClient(t)
		team1 := th.BasicTeam
		th.LinkUserToTeam(t, guestUser, team1)

		user2 := th.BasicUser2
		th.LinkUserToTeam(t, user2, team1)

		dmChannel, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), guestUser.Id, user2.Id)
		require.NoError(t, err)

		_, resp, err := guestClient.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), dmChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("requires read permission on channel", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		team1 := th.CreateTeam(t)

		th.LinkUserToTeam(t, user1, team1)
		th.LinkUserToTeam(t, user2, team1)

		dmChannel, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		otherUser := th.CreateUser(t)
		th.LinkUserToTeam(t, otherUser, team1)

		otherClient := th.CreateClient()
		_, _, err = otherClient.Login(context.Background(), otherUser.Email, otherUser.Password)
		require.NoError(t, err)

		_, resp, err := otherClient.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), dmChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("returns bad request for non-DM/GM channel", func(t *testing.T) {
		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		_, resp, err := testClient.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), th.BasicChannel.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns common teams for DM channel members", func(t *testing.T) {
		user1 := th.BasicUser
		user2 := th.BasicUser2
		team1 := th.BasicTeam
		team2 := th.CreateTeam(t)

		th.LinkUserToTeam(t, user1, team1)
		th.LinkUserToTeam(t, user1, team2)
		th.LinkUserToTeam(t, user2, team1)

		dmChannel, _, err := client.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		teams, _, err := client.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), dmChannel.Id)
		require.NoError(t, err)
		require.Len(t, teams, 1, "should only return team1 since user2 is not in team2")
		assert.Equal(t, team1.Id, teams[0].Id)
	})

	t.Run("returns common teams for GM channel members", func(t *testing.T) {
		user1 := th.BasicUser
		user2 := th.BasicUser2
		user3 := th.CreateUser(t)
		team1 := th.BasicTeam
		team2 := th.CreateTeam(t)
		team3 := th.CreateTeam(t)

		th.LinkUserToTeam(t, user1, team1)
		th.LinkUserToTeam(t, user1, team2)
		th.LinkUserToTeam(t, user2, team1)
		th.LinkUserToTeam(t, user2, team3)
		th.LinkUserToTeam(t, user3, team1)

		gmChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		teams, _, err := client.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.NoError(t, err)
		require.Len(t, teams, 1, "should only return team1 since it's the only team all three users share")
		assert.Equal(t, team1.Id, teams[0].Id)
	})

	t.Run("returns empty list when requesting user in channel but has no common teams with other members", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)

		th.LinkUserToTeam(t, user1, team1)
		th.LinkUserToTeam(t, user2, team2)

		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		dmChannel, _, err := testClient.CreateDirectChannel(context.Background(), user1.Id, user2.Id)
		require.NoError(t, err)

		teams, _, err := testClient.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), dmChannel.Id)
		require.NoError(t, err)
		require.Empty(t, teams)
	})

	t.Run("filters teams to only those common with requesting user", func(t *testing.T) {
		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.BasicUser
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)
		team3 := th.CreateTeam(t)

		th.LinkUserToTeam(t, user1, team1)
		th.LinkUserToTeam(t, user1, team2)
		th.LinkUserToTeam(t, user2, team1)
		th.LinkUserToTeam(t, user2, team3)
		th.LinkUserToTeam(t, user3, team1)
		th.LinkUserToTeam(t, user3, team3)

		gmChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		teams, _, err := client.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.NoError(t, err)
		require.Len(t, teams, 1)
		assert.Equal(t, team1.Id, teams[0].Id)
	})
}
