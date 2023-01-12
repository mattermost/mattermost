// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/app/email"
	emailmocks "github.com/mattermost/mattermost-server/v6/app/email/mocks"
	"github.com/mattermost/mattermost-server/v6/app/teams"
	"github.com/mattermost/mattermost-server/v6/app/users"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
	"github.com/mattermost/mattermost-server/v6/testlib"
)

func TestCreateTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	_, err := th.App.CreateTeam(th.Context, team)
	require.Nil(t, err, "Should create a new team")

	_, err = th.App.CreateTeam(th.Context, th.BasicTeam)
	require.NotNil(t, err, "Should not create a new team - team already exist")
}

func TestCreateTeamWithUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	_, err := th.App.CreateTeamWithUser(th.Context, team, th.BasicUser.Id)
	require.Nil(t, err, "Should create a new team with existing user")

	_, err = th.App.CreateTeamWithUser(th.Context, team, model.NewId())
	require.NotNil(t, err, "Should not create a new team - user does not exist")
}

func TestUpdateTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.BasicTeam.DisplayName = "Testing 123"

	updatedTeam, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, err, "Should update the team")
	require.Equal(t, "Testing 123", updatedTeam.DisplayName, "Wrong Team DisplayName")
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("add user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err, "Should add user to the team")
	})

	t.Run("allow user by domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user")
	})

	t.Run("block user by domain but allow bot", func(t *testing.T) {
		t.Skip("MM-48973")
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, err := th.App.CreateUser(th.Context, &user)
		require.Nil(t, err, "Error creating user: %s", err)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")

		user = model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), AuthService: "notnil", AuthData: model.NewString("notnil")}
		ruser, err = th.App.CreateUser(th.Context, &user)
		require.Nil(t, err, "Error creating authservice user: %s", err)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add authservice user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")

		bot, err := th.App.CreateBot(th.Context, &model.Bot{
			Username:    "somebot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, bot.UserId, "")
		assert.Nil(t, err, "should be able to add bot to domain restricted team")
	})

	t.Run("block user with subdomain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("allow users by multiple domains", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "foo.com, bar.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@foo.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(th.Context, &user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@bar.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(th.Context, &user2)

		user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser3, _ := th.App.CreateUser(th.Context, &user3)

		defer th.App.PermanentDeleteUser(th.Context, &user1)
		defer th.App.PermanentDeleteUser(th.Context, &user2)
		defer th.App.PermanentDeleteUser(th.Context, &user3)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser1.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user1")

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser2.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user2")

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser3.Id, "")
		require.NotNil(t, err, "Should not have allowed restricted user3")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("should set up initial sidebar categories when joining a team", func(t *testing.T) {
		user := th.CreateUser()
		team := th.CreateTeam()

		_, _, err := th.App.AddUserToTeam(th.Context, team.Id, user.Id, "")
		require.Nil(t, err)

		res, err := th.App.GetSidebarCategoriesForTeamForUser(th.Context, user.Id, team.Id)
		require.Nil(t, err)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)
	})
}

func TestAddUserToTeamByToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(th.Context, &user)
	rguest := th.CreateGuest()

	t.Run("invalid token", func(t *testing.T) {
		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, "123")
		require.NotNil(t, err, "Should fail on unexisting token")
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeVerifyEmail,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)

		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on bad token type")
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)

		token.CreateAt = model.GetMillis() - InvitationExpiryTime - 1
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on expired token")
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": model.NewId()}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on bad team id")
	})

	t.Run("invalid user id", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		defer th.App.DeleteToken(token)

		_, _, err := th.App.AddUserToTeamByToken(th.Context, model.NewId(), token.Token)
		require.NotNil(t, err, "Should fail on bad user id")
	})

	t.Run("valid request", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.Nil(t, err, "Should add user to the team")

		_, nErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, ruser.Id)
		require.Nil(t, err)
		assert.Len(t, members, 2)
	})

	t.Run("invalid add a guest using a regular invite", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, err := th.App.AddUserToTeamByToken(th.Context, rguest.Id, token.Token)
		assert.NotNil(t, err)
	})

	t.Run("invalid add a regular user using a guest invite", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, err := th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		assert.NotNil(t, err)
	})

	t.Run("invalid add a guest user with a non-granted email domain", func(t *testing.T) {
		restrictedDomain := *th.App.Config().GuestAccountsSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.RestrictCreationToDomains = &restrictedDomain })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "restricted.com" })
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, err := th.App.AddUserToTeamByToken(th.Context, rguest.Id, token.Token)
		require.NotNil(t, err)
		assert.Equal(t, "api.team.join_user_to_team.allowed_domains.app_error", err.Id)
	})

	t.Run("add a guest user with a granted email domain", func(t *testing.T) {
		restrictedDomain := *th.App.Config().GuestAccountsSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.RestrictCreationToDomains = &restrictedDomain })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "restricted.com" })
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		guestEmail := rguest.Email
		rguest.Email = "test@restricted.com"
		_, err := th.App.Srv().Store().User().Update(rguest, false)
		th.App.InvalidateCacheForUser(rguest.Id)
		require.NoError(t, err)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, appErr := th.App.AddUserToTeamByToken(th.Context, rguest.Id, token.Token)
		require.Nil(t, appErr)
		rguest.Email = guestEmail
		_, err = th.App.Srv().Store().User().Update(rguest, false)
		require.NoError(t, err)
	})

	t.Run("add a guest user even though there are team and system domain restrictions", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "restricted-team.com"
		_, err := th.Server.Store().Team().Update(th.BasicTeam)
		require.NoError(t, err)
		restrictedDomain := *th.App.Config().TeamSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.RestrictCreationToDomains = &restrictedDomain })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "restricted.com" })
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		_, err = th.App.Srv().Store().User().Update(rguest, false)
		require.NoError(t, err)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		_, _, appErr := th.App.AddUserToTeamByToken(th.Context, rguest.Id, token.Token)
		require.Nil(t, appErr)
		th.BasicTeam.AllowedDomains = ""
		_, err = th.Server.Store().Team().Update(th.BasicTeam)
		require.NoError(t, err)
	})

	t.Run("valid request from guest invite", func(t *testing.T) {
		token := model.NewToken(
			TokenTypeGuestInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		_, _, err := th.App.AddUserToTeamByToken(th.Context, rguest.Id, token.Token)
		require.Nil(t, err, "Should add user to the team")

		_, nErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		require.Error(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.Context, th.BasicTeam.Id, rguest.Id)
		require.Nil(t, err)
		require.Len(t, members, 1)
		assert.Equal(t, members[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("group-constrained team", func(t *testing.T) {
		th.BasicTeam.GroupConstrained = model.NewBool(true)
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		_, _, err = th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.NotNil(t, err, "Should return an error when trying to join a group-constrained team.")
		require.Equal(t, "app.team.invite_token.group_constrained.error", err.Id)

		th.BasicTeam.GroupConstrained = model.NewBool(false)
		_, err = th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")
	})

	t.Run("block user", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		_, _, err = th.App.AddUserToTeamByToken(th.Context, ruser.Id, token.Token)
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("should set up initial sidebar categories when joining a team by token", func(t *testing.T) {
		user := th.CreateUser()
		team := th.CreateTeam()

		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{"teamId": team.Id}),
		)
		require.NoError(t, th.App.Srv().Store().Token().Save(token))

		_, _, err := th.App.AddUserToTeamByToken(th.Context, user.Id, token.Token)
		require.Nil(t, err)

		res, err := th.App.GetSidebarCategoriesForTeamForUser(th.Context, user.Id, team.Id)
		require.Nil(t, err)
		assert.Len(t, res.Categories, 3)
		assert.Equal(t, model.SidebarCategoryFavorites, res.Categories[0].Type)
		assert.Equal(t, model.SidebarCategoryChannels, res.Categories[1].Type)
		assert.Equal(t, model.SidebarCategoryDirectMessages, res.Categories[2].Type)
	})
}

func TestAddUserToTeamByTeamId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("add user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		err := th.App.AddUserToTeamByTeamId(th.Context, th.BasicTeam.Id, ruser)
		require.Nil(t, err, "Should add user to the team")
	})

	t.Run("block user", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		err = th.App.AddUserToTeamByTeamId(th.Context, th.BasicTeam.Id, ruser)
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

}

func TestSoftDeleteAllTeamsExcept(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	teams := []*model.Team{
		{
			DisplayName: "team-1",
			Name:        "team-1",
			Email:       "foo@foo.com",
			Type:        model.TeamOpen,
		},
	}
	teamId := ""
	for _, create := range teams {
		team, err := th.App.CreateTeam(th.Context, create)
		require.Nil(t, err)
		teamId = team.Id
	}

	err := th.App.SoftDeleteAllTeamsExcept(teamId)
	assert.Nil(t, err)
	allTeams, err := th.App.GetAllTeams()
	require.Nil(t, err)
	for _, team := range allTeams {
		if team.Id == teamId {
			require.Equal(t, int64(0), team.DeleteAt)
			require.Equal(t, false, team.CloudLimitsArchived)
		} else {
			require.NotEqual(t, int64(0), team.DeleteAt)
			require.Equal(t, true, team.CloudLimitsArchived)
		}
	}

}

func TestAdjustTeamsFromProductLimits(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	teams := []*model.Team{
		{
			DisplayName: "team-1",
			Name:        "team-1",
			Email:       "foo@foo.com",
			Type:        model.TeamOpen,
		},
		{
			DisplayName: "team-2",
			Name:        "team-2",
			Email:       "foo@foo.com",
			Type:        model.TeamOpen,
		},
		{
			DisplayName: "team-3",
			Name:        "team-3",
			Email:       "foo@foo.com",
			Type:        model.TeamOpen,
		},
	}
	teamIds := []string{}
	for _, create := range teams {
		team, err := th.App.CreateTeam(th.Context, create)
		require.Nil(t, err)
		teamIds = append(teamIds, team.Id)
	}
	t.Run("Should soft delete teams if there are more teams than the limit", func(t *testing.T) {
		activeLimit := 1
		teamLimits := &model.TeamsLimits{Active: &activeLimit}

		err := th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)

		teamsList, err := th.App.GetTeams(teamIds)

		require.Nil(t, err)

		// Sort the list of teams based on their creation date
		sort.Slice(teamsList, func(i, j int) bool {
			return teamsList[i].CreateAt < teamsList[j].CreateAt
		})

		for i := range teamsList {
			require.Equal(t, teamsList[i].DisplayName, teams[i].DisplayName)
			require.NotEqual(t, 0, teamsList[i].DeleteAt)
			require.Equal(t, true, teamsList[i].CloudLimitsArchived)
		}
	})

	t.Run("Should not do anything if the amount of teams is equal to the limit", func(t *testing.T) {

		expectedTeamsList, err := th.App.GetAllTeams()

		var expectedActiveTeams []*model.Team
		var expectedCloudArchivedTeams []*model.Team
		for _, team := range expectedTeamsList {
			if team.DeleteAt == 0 {
				expectedActiveTeams = append(expectedActiveTeams, team)
			}
			if team.DeleteAt > 0 && team.CloudLimitsArchived {
				expectedCloudArchivedTeams = append(expectedCloudArchivedTeams, team)
			}
		}

		require.Nil(t, err)

		activeLimit := len(expectedActiveTeams)
		teamLimits := &model.TeamsLimits{Active: &activeLimit}
		err = th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)

		actualTeamsList, err := th.App.GetAllTeams()

		require.Nil(t, err)
		var actualActiveTeams []*model.Team
		var actualCloudArchivedTeams []*model.Team
		for _, team := range actualTeamsList {
			if team.DeleteAt == 0 {
				actualActiveTeams = append(actualActiveTeams, team)
			}
			if team.DeleteAt > 0 && team.CloudLimitsArchived {
				actualCloudArchivedTeams = append(actualCloudArchivedTeams, team)
			}
		}

		require.Equal(t, len(expectedActiveTeams), len(actualActiveTeams))
		require.Equal(t, len(expectedCloudArchivedTeams), len(actualCloudArchivedTeams))
	})

	t.Run("Should restore archived teams if limit increases", func(t *testing.T) {
		activeLimit := 1
		teamLimits := &model.TeamsLimits{Active: &activeLimit}

		err := th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)
		activeLimit = 10000 // make the limit extremely high so all teams are enabled
		teamLimits = &model.TeamsLimits{Active: &activeLimit}

		err = th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)

		teamsList, err := th.App.GetTeams(teamIds)

		require.Nil(t, err)

		// Sort the list of teams based on their creation date
		sort.Slice(teamsList, func(i, j int) bool {
			return teamsList[i].CreateAt < teamsList[j].CreateAt
		})

		for i := range teamsList {
			require.Equal(t, teamsList[i].DisplayName, teams[i].DisplayName)
			require.Equal(t, int64(0), teamsList[i].DeleteAt)
			require.Equal(t, false, teamsList[i].CloudLimitsArchived)
		}
	})

	t.Run("Should only restore teams that were archived by cloud limits", func(t *testing.T) {

		activeLimit := 1
		teamLimits := &model.TeamsLimits{Active: &activeLimit}

		err := th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)

		cloudLimitsArchived := false
		patch := &model.TeamPatch{CloudLimitsArchived: &cloudLimitsArchived}
		team, err := th.App.PatchTeam(teamIds[0], patch)
		require.Nil(t, err)
		require.Equal(t, false, team.CloudLimitsArchived)

		activeLimit = 10000 // make the limit extremely high so all teams are enabled
		teamLimits = &model.TeamsLimits{Active: &activeLimit}

		err = th.App.AdjustTeamsFromProductLimits(teamLimits)
		require.Nil(t, err)

		teamsList, err := th.App.GetTeams(teamIds)

		require.Nil(t, err)

		// Sort the list of teams based on their creation date
		sort.Slice(teamsList, func(i, j int) bool {
			return teamsList[i].CreateAt < teamsList[j].CreateAt
		})

		require.NotEqual(t, int64(0), teamsList[0].DeleteAt)
		require.Equal(t, int64(0), teamsList[1].DeleteAt)
		require.Equal(t, int64(0), teamsList[2].DeleteAt)
	})

}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, err := th.App.CreateTeam(th.Context, &model.Team{
		DisplayName: "deletion-test",
		Name:        "deletion-test",
		Email:       "foo@foo.com",
		Type:        model.TeamOpen,
	})
	require.Nil(t, err, "Should create a team")

	defer func() {
		th.App.PermanentDeleteTeam(th.Context, team)
	}()

	command, err := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team.Id,
		Trigger:   "foo",
		URL:       "http://foo",
		Method:    model.CommandMethodPost,
	})
	require.Nil(t, err, "Should create a command")
	defer th.App.DeleteCommand(command.Id)

	command, err = th.App.GetCommand(command.Id)
	require.NotNil(t, command, "command should not be nil")
	require.Nil(t, err, "unable to get new command")

	err = th.App.PermanentDeleteTeam(th.Context, team)
	require.Nil(t, err)

	command, err = th.App.GetCommand(command.Id)
	require.Nil(t, command, "command wasn't deleted")
	require.NotNil(t, err, "should not return an error")

	// Test deleting a team with no channels.
	team = th.CreateTeam()
	defer func() {
		th.App.PermanentDeleteTeam(th.Context, team)
	}()

	channels, err := th.App.GetPublicChannelsForTeam(th.Context, team.Id, 0, 1000)
	require.Nil(t, err)

	for _, channel := range channels {
		err2 := th.App.PermanentDeleteChannel(th.Context, channel)
		require.Nil(t, err2)
	}

	err = th.App.PermanentDeleteTeam(th.Context, team)
	require.Nil(t, err)
}

func TestSanitizeTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := &model.Team{
		Id:             model.NewId(),
		Email:          th.MakeEmail(),
		InviteId:       model.NewId(),
		AllowedDomains: "example.com",
	}

	copyTeam := func() *model.Team {
		copy := &model.Team{}
		*copy = *team
		return copy
	}

	t.Run("not a user of the team", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: model.NewId(),
					Roles:  model.TeamUserRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.Empty(t, sanitized.InviteId, "should've sanitized inviteid")
	})

	t.Run("user of the team", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: team.Id,
					Roles:  model.TeamUserRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "should have not sanitized inviteid")
	})

	t.Run("team admin", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: team.Id,
					Roles:  model.TeamUserRoleId + " " + model.TeamAdminRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.NotEmpty(t, sanitized.Email, "shouldn't have sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "shouldn't have sanitized inviteid")
	})

	t.Run("team admin of another team", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: model.NewId(),
					Roles:  model.TeamUserRoleId + " " + model.TeamAdminRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.Empty(t, sanitized.InviteId, "should've sanitized inviteid")
	})

	t.Run("system admin, not a user of team", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId + " " + model.SystemAdminRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: model.NewId(),
					Roles:  model.TeamUserRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.NotEmpty(t, sanitized.Email, "shouldn't have sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "shouldn't have sanitized inviteid")
	})

	t.Run("system admin, user of team", func(t *testing.T) {
		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId + " " + model.SystemAdminRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: team.Id,
					Roles:  model.TeamUserRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.NotEmpty(t, sanitized.Email, "shouldn't have sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "shouldn't have sanitized inviteid")
	})
}

func TestSanitizeTeams(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("not a system admin", func(t *testing.T) {
		teams := []*model.Team{
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
		}

		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: teams[0].Id,
					Roles:  model.TeamUserRoleId,
				},
				{
					UserId: userID,
					TeamId: teams[1].Id,
					Roles:  model.TeamUserRoleId + " " + model.TeamAdminRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeams(session, teams)

		require.Empty(t, sanitized[0].Email, "should've sanitized first team")
		require.NotEmpty(t, sanitized[1].Email, "shouldn't have sanitized second team")
	})

	t.Run("system admin", func(t *testing.T) {
		teams := []*model.Team{
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
			{
				Id:             model.NewId(),
				Email:          th.MakeEmail(),
				AllowedDomains: "example.com",
			},
		}

		userID := model.NewId()
		session := model.Session{
			Roles: model.SystemUserRoleId + " " + model.SystemAdminRoleId,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userID,
					TeamId: teams[0].Id,
					Roles:  model.TeamUserRoleId,
				},
			},
		}

		sanitized := th.App.SanitizeTeams(session, teams)
		assert.NotEmpty(t, sanitized[0].Email, "shouldn't have sanitized first team")
		assert.NotEmpty(t, sanitized[1].Email, "shouldn't have sanitized second team")
	})
}

func TestJoinUserToTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	_, err := th.App.CreateTeam(th.Context, team)
	require.Nil(t, err, "Should create a new team")

	maxUsersPerTeam := th.App.Config().TeamSettings.MaxUsersPerTeam
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = maxUsersPerTeam })
		th.App.PermanentDeleteTeam(th.Context, team)
	}()
	one := 1
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = &one })

	t.Run("new join", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, appErr := th.App.JoinUserToTeam(th.Context, team, ruser, "")
		require.Nil(t, appErr, "Should return no error")
	})

	t.Run("new join with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(th.Context, &user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(th.Context, &user2)

		defer th.App.PermanentDeleteUser(th.Context, &user1)
		defer th.App.PermanentDeleteUser(th.Context, &user2)

		_, appErr := th.App.JoinUserToTeam(th.Context, team, ruser1, ruser2.Id)
		require.Nil(t, appErr, "Should return no error")

		_, appErr = th.App.JoinUserToTeam(th.Context, team, ruser2, ruser1.Id)
		require.NotNil(t, appErr, "Should fail")
	})

	t.Run("re-join after leaving with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(th.Context, &user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(th.Context, &user2)

		defer th.App.PermanentDeleteUser(th.Context, &user1)
		defer th.App.PermanentDeleteUser(th.Context, &user2)

		_, appErr := th.App.JoinUserToTeam(th.Context, team, ruser1, ruser2.Id)
		require.Nil(t, appErr, "Should return no error")
		appErr = th.App.LeaveTeam(th.Context, team, ruser1, ruser1.Id)
		require.Nil(t, appErr, "Should return no error")
		_, appErr = th.App.JoinUserToTeam(th.Context, team, ruser2, ruser2.Id)
		require.Nil(t, appErr, "Should return no error")

		_, appErr = th.App.JoinUserToTeam(th.Context, team, ruser1, ruser2.Id)
		require.NotNil(t, appErr, "Should fail")
	})

	t.Run("new join with correct scheme_admin value from group syncable", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(th.Context, &user1)
		defer th.App.PermanentDeleteUser(th.Context, &user1)

		group := th.CreateGroup()

		_, err = th.App.UpsertGroupMember(group.Id, user1.Id)
		require.Nil(t, err)

		gs, err := th.App.UpsertGroupSyncable(&model.GroupSyncable{
			AutoAdd:     true,
			SyncableId:  team.Id,
			Type:        model.GroupSyncableTypeTeam,
			GroupId:     group.Id,
			SchemeAdmin: false,
		})
		require.Nil(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = model.NewInt(999) })

		tm1, appErr := th.App.JoinUserToTeam(th.Context, team, ruser1, "")
		require.Nil(t, appErr)
		require.False(t, tm1.SchemeAdmin)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(th.Context, &user2)
		defer th.App.PermanentDeleteUser(th.Context, &user2)

		_, err = th.App.UpsertGroupMember(group.Id, user2.Id)
		require.Nil(t, err)

		gs.SchemeAdmin = true
		_, err = th.App.UpdateGroupSyncable(gs)
		require.Nil(t, err)

		tm2, appErr := th.App.JoinUserToTeam(th.Context, team, ruser2, "")
		require.Nil(t, appErr)
		require.True(t, tm2.SchemeAdmin)
	})
}

func TestLeaveTeamPanic(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Get", context.Background(), "userID").Return(&model.User{Id: "userID"}, nil)
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)

	mockChannelStore := mocks.ChannelStore{}
	mockChannelStore.On("Get", "channelID", true).Return(&model.Channel{Id: "channelID"}, nil)
	mockChannelStore.On("GetMember", context.Background(), "channelID", "userID").Return(&model.ChannelMember{
		NotifyProps: model.StringMap{
			model.PushNotifyProp: model.ChannelNotifyDefault,
		}}, nil)
	mockChannelStore.On("GetChannels", "myteam", "userID", mock.Anything).Return(model.ChannelList{}, nil)

	var err error
	th.App.ch.srv.userService, err = users.New(users.ServiceConfig{
		UserStore:    &mockUserStore,
		SessionStore: &mocks.SessionStore{},
		OAuthStore:   &mocks.OAuthStore{},
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)

	mockPreferenceStore := mocks.PreferenceStore{}
	mockPreferenceStore.On("Get", "userID", model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapsedThreadsEnabled).Return(&model.Preference{Value: "on"}, nil)

	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)

	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)
	mockLicenseStore := mocks.LicenseStore{}
	mockLicenseStore.On("Get", "").Return(&model.LicenseRecord{}, nil)

	mockTeamStore := mocks.TeamStore{}
	mockTeamStore.On("GetMember", sqlstore.WithMaster(context.Background()), "myteam", "userID").Return(&model.TeamMember{TeamId: "myteam", UserId: "userID"}, nil)
	mockTeamStore.On("UpdateMember", mock.Anything).Return(nil, errors.New("repro error")) // This is the line that triggers the error

	mockStore.On("Channel").Return(&mockChannelStore)
	mockStore.On("Preference").Return(&mockPreferenceStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("License").Return(&mockLicenseStore)
	mockStore.On("Team").Return(&mockTeamStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	team := &model.Team{Id: "myteam"}
	user := &model.User{Id: "userID"}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages = false
	})

	th.App.ch.srv.teamService, err = teams.New(teams.ServiceConfig{
		TeamStore:    &mockTeamStore,
		ChannelStore: &mockChannelStore,
		GroupStore:   &mocks.GroupStore{},
		Users:        th.App.ch.srv.userService,
		WebHub:       th.App.ch.srv.platform,
		ConfigFn:     th.App.ch.srv.platform.Config,
		LicenseFn:    th.App.ch.srv.License,
	})
	require.NoError(t, err)

	require.NotPanics(t, func() {
		th.App.LeaveTeam(th.Context, team, user, user.Id)
	}, "unexpected panic from LeaveTeam")
}

func TestAppUpdateTeamScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.BasicTeam
	mockID := model.NewString("x")
	team.SchemeId = mockID

	updatedTeam, err := th.App.UpdateTeamScheme(th.BasicTeam)
	require.Nil(t, err)
	require.Equal(t, mockID, updatedTeam.SchemeId, "Wrong Team SchemeId")

	// Test that a newly applied team scheme applies the new permissions to a team member
	th.App.SetPhase2PermissionsMigrationStatus(true)

	team2Scheme := th.SetupTeamScheme()
	channelUser, err := th.App.GetRoleByName(context.Background(), team2Scheme.DefaultChannelUserRole)
	require.Nil(t, err)
	channelUser.Permissions = []string{}
	_, err = th.App.UpdateRole(channelUser) // Remove all permissions from the team user role of the scheme
	require.Nil(t, err)

	channelAdmin, err := th.App.GetRoleByName(context.Background(), team2Scheme.DefaultChannelAdminRole)
	require.Nil(t, err)
	channelAdmin.Permissions = []string{}
	_, err = th.App.UpdateRole(channelAdmin) // Remove all permissions from the team admin role of the scheme
	require.Nil(t, err)

	team2 := th.CreateTeam()
	th.App.AddUserToTeam(th.Context, team2.Id, th.BasicUser.Id, "")
	channel := th.CreateChannel(th.Context, team2)
	th.App.AddUserToChannel(th.Context, th.BasicUser, channel, true)
	session := model.Session{
		Roles:  model.SystemUserRoleId,
		UserId: th.BasicUser.Id,
		TeamMembers: []*model.TeamMember{
			{
				UserId:     th.BasicUser.Id,
				TeamId:     team2.Id,
				SchemeUser: true,
			},
		},
	}
	// ensure user can update channel properties before applying the scheme
	require.True(t, th.App.SessionHasPermissionToChannel(th.Context, session, channel.Id, model.PermissionManagePublicChannelProperties))
	// apply the team scheme
	team2.SchemeId = &team2Scheme.Id
	_, err = th.App.UpdateTeamScheme(team2)
	require.Nil(t, err)
	require.False(t, th.App.SessionHasPermissionToChannel(th.Context, session, channel.Id, model.PermissionManagePublicChannelProperties))
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var users []model.User
	users = append(users, *th.BasicUser)
	users = append(users, *th.BasicUser2)

	for i := 0; i < 8; i++ {
		user := model.User{
			Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
			Username: fmt.Sprintf("user%v", i),
			Password: "passwd1",
			DeleteAt: int64(rand.Intn(2)),
		}
		ruser, err := th.App.CreateUser(th.Context, &user)
		require.Nil(t, err)
		require.NotNil(t, ruser)
		defer th.App.PermanentDeleteUser(th.Context, &user)

		_, _, err = th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		// Store the users for comparison later
		users = append(users, *ruser)
	}

	t.Run("Ensure Sorted By Username when TeamMemberGet options is passed", func(t *testing.T) {
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 100, &model.TeamMembersGetOptions{Sort: model.USERNAME})
		require.Nil(t, err)

		// Sort the users array by username
		sort.Slice(users, func(i, j int) bool {
			return users[i].Username < users[j].Username
		})

		// We should have the same number of users in both users and members array as we have not excluded any deleted members
		require.Equal(t, len(users), len(members))
		for i, member := range members {
			assert.Equal(t, users[i].Id, member.UserId)
		}
	})

	t.Run("Ensure ExcludedDeletedUsers when TeamMemberGetOptions is passed", func(t *testing.T) {
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 100, &model.TeamMembersGetOptions{ExcludeDeletedUsers: true})
		require.Nil(t, err)

		// Choose all users who aren't deleted from our users array
		var usersNotDeletedIDs []string
		var membersIDs []string
		for _, u := range users {
			if u.DeleteAt == 0 {
				usersNotDeletedIDs = append(usersNotDeletedIDs, u.Id)
			}
		}

		for _, m := range members {
			membersIDs = append(membersIDs, m.UserId)
		}

		require.Equal(t, len(usersNotDeletedIDs), len(membersIDs))
		require.ElementsMatch(t, usersNotDeletedIDs, membersIDs)
	})

	t.Run("Ensure Sorted By Username and ExcludedDeletedUsers when TeamMemberGetOptions is passed", func(t *testing.T) {
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 100, &model.TeamMembersGetOptions{Sort: model.USERNAME, ExcludeDeletedUsers: true})
		require.Nil(t, err)

		var usersNotDeleted []model.User
		for _, u := range users {
			if u.DeleteAt == 0 {
				usersNotDeleted = append(usersNotDeleted, u)
			}
		}

		// Sort our non deleted members by username
		sort.Slice(usersNotDeleted, func(i, j int) bool {
			return usersNotDeleted[i].Username < usersNotDeleted[j].Username
		})

		require.Equal(t, len(usersNotDeleted), len(members))
		for i, member := range members {
			assert.Equal(t, usersNotDeleted[i].Id, member.UserId)
		}
	})

	t.Run("Ensure Sorted By User ID when no TeamMemberGetOptions is passed", func(t *testing.T) {

		// Sort them by UserID because the result of GetTeamMembers() is also sorted
		sort.Slice(users, func(i, j int) bool {
			return users[i].Id < users[j].Id
		})

		// Fetch team members multiple times
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 5, nil)
		require.Nil(t, err)

		// This should return 5 members
		members2, err := th.App.GetTeamMembers(th.BasicTeam.Id, 5, 6, nil)
		require.Nil(t, err)
		members = append(members, members2...)

		require.Equal(t, len(users), len(members))
		for i, member := range members {
			assert.Equal(t, users[i].Id, member.UserId)
		}
	})
}

func TestGetTeamStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("without view restrictions", func(t *testing.T) {
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, nil)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 5, nil)
		require.Nil(t, err)
		assert.Equal(t, int64(len(members)), teamStats.TotalMemberCount)
		assert.Equal(t, int64(len(members)), teamStats.ActiveMemberCount)
	})

	t.Run("with view restrictions by this team", func(t *testing.T) {
		restrictions := &model.ViewUsersRestrictions{Teams: []string{th.BasicTeam.Id}}
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, restrictions)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 5, nil)
		require.Nil(t, err)
		assert.Equal(t, int64(len(members)), teamStats.TotalMemberCount)
		assert.Equal(t, int64(len(members)), teamStats.ActiveMemberCount)
	})

	t.Run("with view restrictions by valid channel", func(t *testing.T) {
		restrictions := &model.ViewUsersRestrictions{Teams: []string{}, Channels: []string{th.BasicChannel.Id}}
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, restrictions)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		members, err := th.App.GetChannelMembersPage(th.Context, th.BasicChannel.Id, 0, 5)
		require.Nil(t, err)
		assert.Equal(t, int64(len(members)), teamStats.TotalMemberCount)
		assert.Equal(t, int64(len(members)), teamStats.ActiveMemberCount)
	})

	t.Run("with view restrictions to not see anything", func(t *testing.T) {
		restrictions := &model.ViewUsersRestrictions{Teams: []string{}, Channels: []string{}}
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, restrictions)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		assert.Equal(t, int64(0), teamStats.TotalMemberCount)
		assert.Equal(t, int64(0), teamStats.ActiveMemberCount)
	})

	t.Run("with view restrictions by other team", func(t *testing.T) {
		restrictions := &model.ViewUsersRestrictions{Teams: []string{"other-team-id"}}
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, restrictions)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		assert.Equal(t, int64(0), teamStats.TotalMemberCount)
		assert.Equal(t, int64(0), teamStats.ActiveMemberCount)
	})

	t.Run("with view restrictions by not-existing channel", func(t *testing.T) {
		restrictions := &model.ViewUsersRestrictions{Teams: []string{}, Channels: []string{"test"}}
		teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id, restrictions)
		require.Nil(t, err)
		require.NotNil(t, teamStats)
		assert.Equal(t, int64(0), teamStats.TotalMemberCount)
		assert.Equal(t, int64(0), teamStats.ActiveMemberCount)
	})
}

func TestUpdateTeamMemberRolesChangingGuest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("from guest to user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_user")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to guest", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to admin", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_user team_admin")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("from guest to guest plus custom", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.CreateRole(&model.Role{Name: "custom", DisplayName: "custom", Description: "custom"})
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest custom")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("a guest cant have user role", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(th.Context, &user)

		_, _, err := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest team_user")
		require.NotNil(t, err, "Should work when you not modify guest role")
	})
}

func TestInvalidateAllResendInviteEmailJobs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	job, err := th.App.Srv().Jobs.CreateJob(model.JobTypeResendInvitationEmail, map[string]string{})
	require.Nil(t, err)

	sysVar := &model.System{Name: job.Id, Value: "0"}
	e := th.App.Srv().Store().System().SaveOrUpdate(sysVar)
	require.NoError(t, e)

	appErr := th.App.InvalidateAllResendInviteEmailJobs()
	require.Nil(t, appErr)

	j, e := th.App.Srv().Store().Job().Get(job.Id)
	require.NoError(t, e)
	require.Equal(t, j.Status, model.JobStatusCanceled)

	_, sysValErr := th.App.Srv().Store().System().GetByName(job.Id)
	var errNotFound *store.ErrNotFound
	require.ErrorAs(t, sysValErr, &errNotFound)
}

func TestInvalidateAllEmailInvites(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t1 := model.Token{
		Token:    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
		CreateAt: model.GetMillis(),
		Type:     TokenTypeGuestInvitation,
		Extra:    "",
	}
	err := th.App.Srv().Store().Token().Save(&t1)
	require.NoError(t, err)

	t2 := model.Token{
		Token:    "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
		CreateAt: model.GetMillis(),
		Type:     TokenTypeTeamInvitation,
		Extra:    "",
	}
	err = th.App.Srv().Store().Token().Save(&t2)
	require.NoError(t, err)

	t3 := model.Token{
		Token:    "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
		CreateAt: model.GetMillis(),
		Type:     "other",
		Extra:    "",
	}
	err = th.App.Srv().Store().Token().Save(&t3)
	require.NoError(t, err)

	appErr := th.App.InvalidateAllEmailInvites()
	require.Nil(t, appErr)

	_, err = th.App.Srv().Store().Token().GetByToken(t1.Token)
	require.Error(t, err)

	_, err = th.App.Srv().Store().Token().GetByToken(t2.Token)
	require.Error(t, err)

	_, err = th.App.Srv().Store().Token().GetByToken(t3.Token)
	require.NoError(t, err)
}

func TestClearTeamMembersCache(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockTeamStore := mocks.TeamStore{}
	tms := []*model.TeamMember{}
	for i := 0; i < 200; i++ {
		tms = append(tms, &model.TeamMember{
			TeamId: "1",
		})
	}
	mockTeamStore.On("GetMembers", "teamID", 0, 100, mock.Anything).Return(tms, nil)
	mockTeamStore.On("GetMembers", "teamID", 100, 100, mock.Anything).Return([]*model.TeamMember{{
		TeamId: "1",
	}}, nil)
	mockStore.On("Team").Return(&mockTeamStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	require.NoError(t, th.App.ClearTeamMembersCache("teamID"))
}

func TestInviteNewUsersToTeamGracefully(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	t.Run("it return list of email with no error on success", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		memberInvite := &model.MemberInvite{
			Emails: []string{"idontexist@mattermost.com"},
		}
		emailServiceMock.On("SendInviteEmails",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			memberInvite.Emails,
			"",
			mock.Anything,
			true,
			false,
			false,
		).Once().Return(nil)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteNewUsersToTeamGracefully(memberInvite, th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Error)
	})

	t.Run("it should assign errors to emails when failing to send", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		memberInvite := &model.MemberInvite{
			Emails: []string{"idontexist@mattermost.com"},
		}
		emailServiceMock.On("SendInviteEmails",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			memberInvite.Emails,
			"",
			mock.Anything,
			true,
			false,
			false,
		).Once().Return(email.SendMailError)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteNewUsersToTeamGracefully(memberInvite, th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Error)
	})

	t.Run("it return list of email with no error when inviting to team and channels using memberInvite struct", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		memberInvite := &model.MemberInvite{
			Emails:     []string{"idontexist@mattermost.com"},
			ChannelIds: []string{th.BasicChannel.Id},
		}
		emailServiceMock.On("SendInviteEmailsToTeamAndChannels",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("[]*model.Channel"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("[]uint8"),
			memberInvite.Emails,
			"",
			mock.Anything,
			mock.AnythingOfType("string"),
			true,
			false,
			false,
		).Once().Return([]*model.EmailInviteWithError{}, nil)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteNewUsersToTeamGracefully(memberInvite, th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Error)
	})

	t.Run("it return list of email with no error when inviting to team and channels using plain emails array", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		memberInvite := &model.MemberInvite{
			Emails: []string{"idontexist@mattermost.com"},
		}
		emailServiceMock.On("SendInviteEmails",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			[]string{"idontexist@mattermost.com"},
			"",
			mock.Anything,
			true,
			false,
			false,
		).Once().Return(nil)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteNewUsersToTeamGracefully(memberInvite, th.BasicTeam.Id, th.BasicUser.Id, "")
		require.Nil(t, err)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Error)
	})
}

func TestInviteGuestsToChannelsGracefully(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	t.Run("it return list of email with no error on success", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		emailServiceMock.On("SendGuestInviteEmails",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("[]*model.Channel"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("[]uint8"),
			[]string{"idontexist@mattermost.com"},
			"",
			"",
			true,
			false,
			false,
		).Once().Return(nil)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &model.GuestsInvite{
			Emails:   []string{"idontexist@mattermost.com"},
			Channels: []string{th.BasicChannel.Id},
		}, th.BasicUser.Id)
		require.Nil(t, err)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Error)
	})

	t.Run("it should assign errors to emails when failing to send", func(t *testing.T) {
		emailServiceMock := emailmocks.ServiceInterface{}
		emailServiceMock.On("SendGuestInviteEmails",
			mock.AnythingOfType("*model.Team"),
			mock.AnythingOfType("[]*model.Channel"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("string"),
			mock.AnythingOfType("[]uint8"),
			[]string{"idontexist@mattermost.com"},
			"",
			"",
			true,
			false,
			false,
		).Once().Return(email.SendMailError)
		th.App.Srv().EmailService = &emailServiceMock

		res, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &model.GuestsInvite{
			Emails:   []string{"idontexist@mattermost.com"},
			Channels: []string{th.BasicChannel.Id},
		}, th.BasicUser.Id)

		require.Nil(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Error)
	})
}

func TestGetNewTeamMembersSince(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()

	t.Run("counts team members", func(t *testing.T) {
		var originalExpectedCount int64
		var newTeamMemberJoinTime int64
		var anotherUser *model.User

		t.Run("since time 0", func(t *testing.T) {
			teamMembers, err := th.App.Srv().Store().Team().GetMembers(team.Id, 0, 1000, nil)
			require.NoError(t, err)
			originalExpectedCount = int64(len(teamMembers))
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, originalExpectedCount, actualCount)
		})

		t.Run("after a new team member was added", func(t *testing.T) {
			anotherUser = th.CreateUser()
			newTeamMember, appErr := th.App.JoinUserToTeam(th.Context, team, anotherUser, "")
			newTeamMemberJoinTime = newTeamMember.CreateAt
			require.Nil(t, appErr)
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, originalExpectedCount+1, actualCount)
		})

		t.Run("after a team member was added to a different team, ensuring the wrong team's member count isn't incremented", func(t *testing.T) {
			anotherUser2 := th.CreateUser()
			anotherTeam := th.CreateTeam()
			_, appErr := th.App.JoinUserToTeam(th.Context, anotherTeam, anotherUser2, "")
			require.Nil(t, appErr)
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, originalExpectedCount+1, actualCount)
		})

		t.Run("since a given time", func(t *testing.T) {
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: newTeamMemberJoinTime, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, int64(1), actualCount)
		})

		t.Run("after a team member was removed", func(t *testing.T) {
			th.RemoveUserFromTeam(anotherUser, team)
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, originalExpectedCount, actualCount)
		})

		t.Run("after a user was deactivated", func(t *testing.T) {
			_, appErr := th.App.JoinUserToTeam(th.Context, team, anotherUser, "")
			require.Nil(t, appErr)
			_, beforeCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			_, appErr = th.App.UpdateActive(th.Context, anotherUser, false)
			defer th.App.UpdateActive(th.Context, anotherUser, true)
			require.Nil(t, appErr)
			_, afterCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, beforeCount-1, afterCount)
		})

		t.Run("after a user was permanently deleted", func(t *testing.T) {
			_, beforeCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			appErr = th.App.PermanentDeleteUser(th.Context, anotherUser)
			require.Nil(t, appErr)
			_, afterCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, beforeCount-1, afterCount)
		})

		t.Run("exclude bots", func(t *testing.T) {
			user := th.CreateUser()
			_, appErr := th.App.ConvertUserToBot(user)
			require.Nil(t, appErr)
			_, appErr = th.App.JoinUserToTeam(th.Context, team, user, "")
			require.Nil(t, appErr)
			_, actualCount, appErr := th.App.GetNewTeamMembersSince(th.Context, team.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Equal(t, originalExpectedCount, actualCount)
		})
	})

	t.Run("returns the correct team members", func(t *testing.T) {
		var originalExpectedMembers []*model.TeamMember
		var newTeamMemberJoinTime int64
		var anotherUser *model.User

		uIDs := func(members []*model.TeamMember) []string {
			ids := []string{}
			for _, member := range members {
				ids = append(ids, member.UserId)
			}
			return ids
		}

		nUIDs := func(members []*model.NewTeamMember) []string {
			ids := []string{}
			for _, member := range members {
				ids = append(ids, member.Id)
			}
			return ids
		}

		t.Run("since time 0", func(t *testing.T) {
			var err error
			originalExpectedMembers, err = th.App.Srv().Store().Team().GetMembers(th.BasicTeam.Id, 0, 1000, nil)
			require.NoError(t, err)
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.ElementsMatch(t, uIDs(originalExpectedMembers), nUIDs(actualMembersList.Items))
		})

		t.Run("after a new team member was added", func(t *testing.T) {
			anotherUser = th.CreateUser()
			newTeamMember, appErr := th.App.JoinUserToTeam(th.Context, th.BasicTeam, anotherUser, "")
			newTeamMemberJoinTime = newTeamMember.CreateAt
			require.Nil(t, appErr)
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.ElementsMatch(t, append(uIDs(originalExpectedMembers), anotherUser.Id), nUIDs(actualMembersList.Items))
		})

		t.Run("after a team member was added to a different team, ensuring the wrong team's member count isn't incremented", func(t *testing.T) {
			anotherUser2 := th.CreateUser()
			anotherTeam := th.CreateTeam()
			_, appErr := th.App.JoinUserToTeam(th.Context, anotherTeam, anotherUser2, "")
			require.Nil(t, appErr)
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.ElementsMatch(t, append(uIDs(originalExpectedMembers), anotherUser.Id), nUIDs(actualMembersList.Items))
		})

		t.Run("since a given time", func(t *testing.T) {
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: newTeamMemberJoinTime, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Len(t, actualMembersList.Items, 1)
			require.Equal(t, anotherUser.Id, actualMembersList.Items[0].Id)
		})

		t.Run("after a team member was removed", func(t *testing.T) {
			th.RemoveUserFromTeam(anotherUser, th.BasicTeam)
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.ElementsMatch(t, uIDs(originalExpectedMembers), nUIDs(actualMembersList.Items))
		})

		t.Run("after a user was deactivated", func(t *testing.T) {
			_, appErr := th.App.JoinUserToTeam(th.Context, th.BasicTeam, anotherUser, "")
			require.Nil(t, appErr)
			beforeMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Contains(t, nUIDs(beforeMembersList.Items), anotherUser.Id)
			_, appErr = th.App.UpdateActive(th.Context, anotherUser, false)
			defer th.App.UpdateActive(th.Context, anotherUser, true)
			require.Nil(t, appErr)
			afterMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.NotContains(t, nUIDs(afterMembersList.Items), anotherUser.Id)
		})

		t.Run("after a user was permanently deleted", func(t *testing.T) {
			beforeMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.Contains(t, nUIDs(beforeMembersList.Items), anotherUser.Id)
			appErr = th.App.PermanentDeleteUser(th.Context, anotherUser)
			require.Nil(t, appErr)
			afterMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.NotContains(t, nUIDs(afterMembersList.Items), anotherUser.Id)
		})

		t.Run("exclude bots", func(t *testing.T) {
			user := th.CreateUser()
			_, appErr := th.App.ConvertUserToBot(user)
			require.Nil(t, appErr)
			_, appErr = th.App.JoinUserToTeam(th.Context, th.BasicTeam, user, "")
			require.Nil(t, appErr)
			actualMembersList, _, appErr := th.App.GetNewTeamMembersSince(th.Context, th.BasicTeam.Id, &model.InsightsOpts{StartUnixMilli: 0, Page: 0, PerPage: 1000})
			require.Nil(t, appErr)
			require.ElementsMatch(t, uIDs(originalExpectedMembers), nUIDs(actualMembersList.Items))
		})
	})
}

func TestTeamSendEvents(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testCluster := &testlib.FakeClusterInterface{}
	th.Server.Platform().SetCluster(testCluster)
	defer th.Server.Platform().SetCluster(nil)

	team := th.CreateTeam()

	testCluster.ClearMessages()

	wsEvents := []string{model.WebsocketEventUpdateTeam, model.WebsocketEventRestoreTeam, model.WebsocketEventDeleteTeam}
	for _, wsEvent := range wsEvents {
		appErr := th.App.sendTeamEvent(team, wsEvent)
		require.Nil(t, appErr)
	}

	msgs := testCluster.GetMessages()
	require.Len(t, msgs, len(wsEvents))

	for _, msg := range msgs {
		ev, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
		require.NoError(t, err)

		// The event should be a team event.
		require.Equal(t, team.Id, ev.GetBroadcast().TeamId)

		// Make sure we're hiding the sensitive fields.
		var teamFromEvent *model.Team
		err = json.Unmarshal([]byte(ev.GetData()["team"].(string)), &teamFromEvent)
		require.NoError(t, err)
		require.Equal(t, team.Id, teamFromEvent.Id)
		require.Equal(t, team.DisplayName, teamFromEvent.DisplayName)
		require.Equal(t, team.Name, teamFromEvent.Name)
		require.Equal(t, team.Description, teamFromEvent.Description)
		require.Equal(t, "", teamFromEvent.Email)
		require.Equal(t, "", teamFromEvent.InviteId)
	}
}
