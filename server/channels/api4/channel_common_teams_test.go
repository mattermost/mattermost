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

func TestGetGroupMessageMembersCommonTeams(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic()
	client := th.Client

	t.Run("requires authentication", func(t *testing.T) {
		user1 := th.BasicUser
		user2 := th.BasicUser2
		user3 := th.CreateUser()

		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		gmChannel, _, err := testClient.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		_, err = testClient.Logout(context.Background())
		require.NoError(t, err)

		_, resp, err := testClient.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
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
		th.LinkUserToTeam(guestUser, team1)

		user2 := th.BasicUser2
		th.LinkUserToTeam(user2, team1)

		user3 := th.CreateUser()
		th.LinkUserToTeam(user3, team1)

		gmChannel, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{guestUser.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		_, resp, err := guestClient.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("requires read permission on channel", func(t *testing.T) {
		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()
		team1 := th.CreateTeam()

		th.LinkUserToTeam(user1, team1)
		th.LinkUserToTeam(user2, team1)
		th.LinkUserToTeam(user3, team1)

		gmChannel, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		otherUser := th.CreateUser()
		th.LinkUserToTeam(otherUser, team1)

		otherClient := th.CreateClient()
		_, _, err = otherClient.Login(context.Background(), otherUser.Email, otherUser.Password)
		require.NoError(t, err)

		_, resp, err := otherClient.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("returns bad request for non-GM channel", func(t *testing.T) {
		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)

		_, resp, err := testClient.GetGroupMessageMembersCommonTeams(context.Background(), th.BasicChannel.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns common teams for GM channel members", func(t *testing.T) {
		user1 := th.BasicUser
		user2 := th.BasicUser2
		user3 := th.CreateUser()
		team1 := th.BasicTeam
		team2 := th.CreateTeam()
		team3 := th.CreateTeam()

		th.LinkUserToTeam(user1, team1)
		th.LinkUserToTeam(user1, team2)
		th.LinkUserToTeam(user2, team1)
		th.LinkUserToTeam(user2, team3)
		th.LinkUserToTeam(user3, team1)

		gmChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		teams, _, err := client.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.NoError(t, err)
		require.Len(t, teams, 1, "should only return team1 since it's the only team all three users share")
		assert.Equal(t, team1.Id, teams[0].Id)
	})

	t.Run("returns empty list when requesting user in channel but has no common teams with other members", func(t *testing.T) {
		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()
		team1 := th.CreateTeam()
		team2 := th.CreateTeam()

		th.LinkUserToTeam(user1, team1)
		th.LinkUserToTeam(user2, team2)
		th.LinkUserToTeam(user3, team1)

		testClient := th.CreateClient()
		_, _, err := testClient.Login(context.Background(), user1.Email, user1.Password)
		require.NoError(t, err)

		gmChannel, _, err := testClient.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		teams, _, err := testClient.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.NoError(t, err)
		require.Empty(t, teams)
	})

	t.Run("filters teams to only those common with requesting user", func(t *testing.T) {
		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.BasicUser
		team1 := th.CreateTeam()
		team2 := th.CreateTeam()
		team3 := th.CreateTeam()

		th.LinkUserToTeam(user1, team1)
		th.LinkUserToTeam(user1, team2)
		th.LinkUserToTeam(user2, team1)
		th.LinkUserToTeam(user2, team3)
		th.LinkUserToTeam(user3, team1)
		th.LinkUserToTeam(user3, team3)

		gmChannel, _, err := client.CreateGroupChannel(context.Background(), []string{user1.Id, user2.Id, user3.Id})
		require.NoError(t, err)

		teams, _, err := client.GetGroupMessageMembersCommonTeams(context.Background(), gmChannel.Id)
		require.NoError(t, err)
		require.Len(t, teams, 1)
		assert.Equal(t, team1.Id, teams[0].Id)
	})
}
