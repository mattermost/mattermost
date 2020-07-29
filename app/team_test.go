// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestCreateTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	_, err := th.App.CreateTeam(team)
	require.Nil(t, err, "Should create a new team")

	_, err = th.App.CreateTeam(th.BasicTeam)
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
		Type:        model.TEAM_OPEN,
	}

	_, err := th.App.CreateTeamWithUser(team, th.BasicUser.Id)
	require.Nil(t, err, "Should create a new team with existing user")

	_, err = th.App.CreateTeamWithUser(team, model.NewId())
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
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err, "Should add user to the team")
	})

	t.Run("allow user by domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user")
	})

	t.Run("block user by domain but allow bot", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, err := th.App.CreateUser(&user)
		require.Nil(t, err, "Error creating user: %s", err)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")

		user = model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), AuthService: "notnil", AuthData: model.NewString("notnil")}
		ruser, err = th.App.CreateUser(&user)
		require.Nil(t, err, "Error creating authservice user: %s", err)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add authservice user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")

		bot, err := th.App.CreateBot(&model.Bot{
			Username:    "somebot",
			Description: "a bot",
			OwnerId:     th.BasicUser.Id,
		})
		require.Nil(t, err)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, bot.UserId, "")
		assert.Nil(t, err, "should be able to add bot to domain restricted team")
	})

	t.Run("block user with subdomain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("allow users by multiple domains", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "foo.com, bar.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@foo.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@bar.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)

		user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser3, _ := th.App.CreateUser(&user3)

		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)
		defer th.App.PermanentDeleteUser(&user3)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser1.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user1")

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser2.Id, "")
		require.Nil(t, err, "Should have allowed whitelisted user2")

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser3.Id, "")
		require.NotNil(t, err, "Should not have allowed restricted user3")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("should set up initial sidebar categories when joining a team", func(t *testing.T) {
		user := th.CreateUser()
		team := th.CreateTeam()

		_, err := th.App.AddUserToTeam(team.Id, user.Id, "")
		require.Nil(t, err)

		res, err := th.App.GetSidebarCategories(user.Id, team.Id)
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
	ruser, _ := th.App.CreateUser(&user)
	rguest := th.CreateGuest()

	t.Run("invalid token", func(t *testing.T) {
		_, err := th.App.AddUserToTeamByToken(ruser.Id, "123")
		require.NotNil(t, err, "Should fail on unexisting token")
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_VERIFY_EMAIL,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)

		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		defer th.App.DeleteToken(token)

		_, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on bad token type")
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)

		token.CreateAt = model.GetMillis() - INVITATION_EXPIRY_TIME - 1
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		defer th.App.DeleteToken(token)

		_, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on expired token")
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": model.NewId()}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		defer th.App.DeleteToken(token)

		_, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		require.NotNil(t, err, "Should fail on bad team id")
	})

	t.Run("invalid user id", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		defer th.App.DeleteToken(token)

		_, err := th.App.AddUserToTeamByToken(model.NewId(), token.Token)
		require.NotNil(t, err, "Should fail on bad user id")
	})

	t.Run("valid request", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		require.Nil(t, err, "Should add user to the team")

		_, nErr := th.App.Srv().Store.Token().GetByToken(token.Token)
		require.NotNil(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.BasicTeam.Id, ruser.Id)
		require.Nil(t, err)
		assert.Len(t, *members, 2)
	})

	t.Run("invalid add a guest using a regular invite", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err := th.App.AddUserToTeamByToken(rguest.Id, token.Token)
		assert.NotNil(t, err)
	})

	t.Run("invalid add a regular user using a guest invite", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_GUEST_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		assert.NotNil(t, err)
	})

	t.Run("invalid add a guest user with a non-granted email domain", func(t *testing.T) {
		restrictedDomain := *th.App.Config().GuestAccountsSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.GuestAccountsSettings.RestrictCreationToDomains = &restrictedDomain })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.RestrictCreationToDomains = "restricted.com" })
		token := model.NewToken(
			TOKEN_TYPE_GUEST_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err := th.App.AddUserToTeamByToken(rguest.Id, token.Token)
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
			TOKEN_TYPE_GUEST_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		guestEmail := rguest.Email
		rguest.Email = "test@restricted.com"
		_, err := th.App.Srv().Store.User().Update(rguest, false)
		th.App.InvalidateCacheForUser(rguest.Id)
		require.Nil(t, err)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err = th.App.AddUserToTeamByToken(rguest.Id, token.Token)
		require.Nil(t, err)
		rguest.Email = guestEmail
		_, err = th.App.Srv().Store.User().Update(rguest, false)
		require.Nil(t, err)
	})

	t.Run("add a guest user even though there are team and system domain restrictions", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "restricted-team.com"
		_, err := th.Server.Store.Team().Update(th.BasicTeam)
		require.Nil(t, err)
		restrictedDomain := *th.App.Config().TeamSettings.RestrictCreationToDomains
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.RestrictCreationToDomains = &restrictedDomain })
		}()
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.RestrictCreationToDomains = "restricted.com" })
		token := model.NewToken(
			TOKEN_TYPE_GUEST_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		_, err = th.App.Srv().Store.User().Update(rguest, false)
		require.Nil(t, err)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))
		_, err = th.App.AddUserToTeamByToken(rguest.Id, token.Token)
		require.Nil(t, err)
		th.BasicTeam.AllowedDomains = ""
		_, err = th.Server.Store.Team().Update(th.BasicTeam)
		require.Nil(t, err)
	})

	t.Run("valid request from guest invite", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_GUEST_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id, "channels": th.BasicChannel.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))

		_, err := th.App.AddUserToTeamByToken(rguest.Id, token.Token)
		require.Nil(t, err, "Should add user to the team")

		_, nErr := th.App.Srv().Store.Token().GetByToken(token.Token)
		require.NotNil(t, nErr, "The token must be deleted after be used")

		members, err := th.App.GetChannelMembersForUser(th.BasicTeam.Id, rguest.Id)
		require.Nil(t, err)
		require.Len(t, *members, 1)
		assert.Equal(t, (*members)[0].ChannelId, th.BasicChannel.Id)
	})

	t.Run("group-constrained team", func(t *testing.T) {
		th.BasicTeam.GroupConstrained = model.NewBool(true)
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))

		_, err = th.App.AddUserToTeamByToken(ruser.Id, token.Token)
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
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))

		_, err = th.App.AddUserToTeamByToken(ruser.Id, token.Token)
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

	t.Run("should set up initial sidebar categories when joining a team by token", func(t *testing.T) {
		user := th.CreateUser()
		team := th.CreateTeam()

		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": team.Id}),
		)
		require.Nil(t, th.App.Srv().Store.Token().Save(token))

		_, err := th.App.AddUserToTeamByToken(user.Id, token.Token)
		require.Nil(t, err)

		res, err := th.App.GetSidebarCategories(user.Id, team.Id)
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
		ruser, _ := th.App.CreateUser(&user)

		err := th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser)
		require.Nil(t, err, "Should add user to the team")
	})

	t.Run("block user", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		_, err := th.App.UpdateTeam(th.BasicTeam)
		require.Nil(t, err, "Should update the team")

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		err = th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser)
		require.NotNil(t, err, "Should not add restricted user")
		require.Equal(t, "JoinUserToTeam", err.Where, "Error should be JoinUserToTeam")
	})

}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team, err := th.App.CreateTeam(&model.Team{
		DisplayName: "deletion-test",
		Name:        "deletion-test",
		Email:       "foo@foo.com",
		Type:        model.TEAM_OPEN,
	})
	require.Nil(t, err, "Should create a team")

	defer func() {
		th.App.PermanentDeleteTeam(team)
	}()

	command, err := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team.Id,
		Trigger:   "foo",
		URL:       "http://foo",
		Method:    model.COMMAND_METHOD_POST,
	})
	require.Nil(t, err, "Should create a command")
	defer th.App.DeleteCommand(command.Id)

	command, err = th.App.GetCommand(command.Id)
	require.NotNil(t, command, "command should not be nil")
	require.Nil(t, err, "unable to get new command")

	err = th.App.PermanentDeleteTeam(team)
	require.Nil(t, err)

	command, err = th.App.GetCommand(command.Id)
	require.Nil(t, command, "command wasn't deleted")
	require.NotNil(t, err, "should not return an error")

	// Test deleting a team with no channels.
	team = th.CreateTeam()
	defer func() {
		th.App.PermanentDeleteTeam(team)
	}()

	channels, err := th.App.GetPublicChannelsForTeam(team.Id, 0, 1000)
	require.Nil(t, err)

	for _, channel := range *channels {
		err2 := th.App.PermanentDeleteChannel(channel)
		require.Nil(t, err2)
	}

	err = th.App.PermanentDeleteTeam(team)
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
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.Empty(t, sanitized.InviteId, "should've sanitized inviteid")
	})

	t.Run("user of the team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "should have not sanitized inviteid")
	})

	t.Run("team admin", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.NotEmpty(t, sanitized.Email, "shouldn't have sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "shouldn't have sanitized inviteid")
	})

	t.Run("team admin of another team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.Empty(t, sanitized.Email, "should've sanitized team")
		require.Empty(t, sanitized.InviteId, "should've sanitized inviteid")
	})

	t.Run("system admin, not a user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.TEAM_USER_ROLE_ID,
				},
			},
		}

		sanitized := th.App.SanitizeTeam(session, copyTeam())
		require.NotEmpty(t, sanitized.Email, "shouldn't have sanitized team")
		require.NotEmpty(t, sanitized.InviteId, "shouldn't have sanitized inviteid")
	})

	t.Run("system admin, user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.TEAM_USER_ROLE_ID,
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

		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.TEAM_USER_ROLE_ID,
				},
				{
					UserId: userId,
					TeamId: teams[1].Id,
					Roles:  model.TEAM_USER_ROLE_ID + " " + model.TEAM_ADMIN_ROLE_ID,
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

		userId := model.NewId()
		session := model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID + " " + model.SYSTEM_ADMIN_ROLE_ID,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.TEAM_USER_ROLE_ID,
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
		Type:        model.TEAM_OPEN,
	}

	_, err := th.App.CreateTeam(team)
	require.Nil(t, err, "Should create a new team")

	maxUsersPerTeam := th.App.Config().TeamSettings.MaxUsersPerTeam
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = maxUsersPerTeam })
		th.App.PermanentDeleteTeam(team)
	}()
	one := 1
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = &one })

	t.Run("new join", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		var alreadyAdded bool
		_, alreadyAdded, err = th.App.joinUserToTeam(team, ruser)
		require.False(t, alreadyAdded, "Should return already added equal to false")
		require.Nil(t, err, "Should return no error")
	})

	t.Run("join when you are a member", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)

		var alreadyAdded bool
		_, alreadyAdded, err = th.App.joinUserToTeam(team, ruser)
		require.True(t, alreadyAdded, "Should return already added")
		require.Nil(t, err, "Should return no error")
	})

	t.Run("re-join after leaving", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)
		th.App.LeaveTeam(team, ruser, ruser.Id)

		var alreadyAdded bool
		_, alreadyAdded, err = th.App.joinUserToTeam(team, ruser)
		require.False(t, alreadyAdded, "Should return already added equal to false")
		require.Nil(t, err, "Should return no error")
	})

	t.Run("new join with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)

		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)
		th.App.joinUserToTeam(team, ruser1)

		_, _, err = th.App.joinUserToTeam(team, ruser2)
		require.NotNil(t, err, "Should fail")
	})

	t.Run("re-join alfter leaving with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)

		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)

		th.App.joinUserToTeam(team, ruser1)
		th.App.LeaveTeam(team, ruser1, ruser1.Id)
		th.App.joinUserToTeam(team, ruser2)

		_, _, err = th.App.joinUserToTeam(team, ruser1)
		require.NotNil(t, err, "Should fail")
	})

	t.Run("new join with correct scheme_admin value from group syncable", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		defer th.App.PermanentDeleteUser(&user1)

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

		tm1, _, err := th.App.joinUserToTeam(team, ruser1)
		require.Nil(t, err)
		require.False(t, tm1.SchemeAdmin)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)
		defer th.App.PermanentDeleteUser(&user2)

		_, err = th.App.UpsertGroupMember(group.Id, user2.Id)
		require.Nil(t, err)

		gs.SchemeAdmin = true
		_, err = th.App.UpdateGroupSyncable(gs)
		require.Nil(t, err)

		tm2, _, err := th.App.joinUserToTeam(team, ruser2)
		require.Nil(t, err)
		require.True(t, tm2.SchemeAdmin)
	})
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
		ruser, err := th.App.CreateUser(&user)
		require.Nil(t, err)
		require.NotNil(t, ruser)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
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

		// Fetch team members multipile times
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
		members, err := th.App.GetChannelMembersPage(th.BasicChannel.Id, 0, 5)
		require.Nil(t, err)
		assert.Equal(t, int64(len(*members)), teamStats.TotalMemberCount)
		assert.Equal(t, int64(len(*members)), teamStats.ActiveMemberCount)
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
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_user")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to guest", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest")
		require.NotNil(t, err, "Should fail when try to modify the guest role")
	})

	t.Run("from user to admin", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_user team_admin")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("from guest to guest plus custom", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.CreateRole(&model.Role{Name: "custom", DisplayName: "custom", Description: "custom"})
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest custom")
		require.Nil(t, err, "Should work when you not modify guest role")
	})

	t.Run("a guest cant have user role", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateGuest(&user)

		_, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		_, err = th.App.UpdateTeamMemberRoles(th.BasicTeam.Id, ruser.Id, "team_guest team_user")
		require.NotNil(t, err, "Should work when you not modify guest role")
	})
}

func TestInvalidateAllEmailInvites(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t1 := model.Token{
		Token:    "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
		CreateAt: model.GetMillis(),
		Type:     TOKEN_TYPE_GUEST_INVITATION,
		Extra:    "",
	}
	err := th.App.Srv().Store.Token().Save(&t1)
	require.Nil(t, err)

	t2 := model.Token{
		Token:    "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
		CreateAt: model.GetMillis(),
		Type:     TOKEN_TYPE_TEAM_INVITATION,
		Extra:    "",
	}
	err = th.App.Srv().Store.Token().Save(&t2)
	require.Nil(t, err)

	t3 := model.Token{
		Token:    "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
		CreateAt: model.GetMillis(),
		Type:     "other",
		Extra:    "",
	}
	err = th.App.Srv().Store.Token().Save(&t3)
	require.Nil(t, err)

	err = th.App.InvalidateAllEmailInvites()
	require.Nil(t, err)

	_, err = th.App.Srv().Store.Token().GetByToken(t1.Token)
	require.NotNil(t, err)

	_, err = th.App.Srv().Store.Token().GetByToken(t2.Token)
	require.NotNil(t, err)

	_, err = th.App.Srv().Store.Token().GetByToken(t3.Token)
	require.Nil(t, err)
}

func TestEmailInvites(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("Invites disabled", func(t *testing.T) {
		userInvites := []string{"newuser1@valid.com", "newuser2@valid.com"}
		_, err := th.App.InviteNewUsersToTeamGracefully(userInvites, th.BasicTeam.Id, th.BasicUser.Id)
		require.Equal(t, "api.team.invite_members.disabled.app_error", err.Id)
	})

	enableEmailInvitations := *th.App.Config().ServiceSettings.EnableEmailInvitations
	th.BasicTeam.AllowedDomains = "valid.com"
	_, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, err, "Should update the team")

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableEmailInvitations = &enableEmailInvitations })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })

	t.Run("Empty invite list", func(t *testing.T) {
		_, err := th.App.InviteNewUsersToTeamGracefully([]string{}, th.BasicTeam.Id, th.BasicUser.Id)
		require.Equal(t, "api.team.invite_members.no_one.app_error", err.Id)
	})

	t.Run("invites to disallowed domains", func(t *testing.T) {
		userInvites := []string{"newuser1@valid.com", "newuser2@invalid.com"}
		inviteResult, err := th.App.InviteNewUsersToTeamGracefully(userInvites, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, err)
		for _, invite := range inviteResult {
			if "newuser2@invalid.com" == invite.Email {
				require.Equal(t, "api.team.invite_members.invalid_email.app_error", invite.Error.Id)
			} else {
				require.Nil(t, invite.Error)
			}
		}
	})

	t.Run("Happy path", func(t *testing.T) {
		userInvites := []string{"newuser1@valid.com", "newuser2@valid.com"}
		inviteResult, err := th.App.InviteNewUsersToTeamGracefully(userInvites, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, err)
		for _, invite := range inviteResult {
			require.Nil(t, invite.Error)
		}
	})
}

func TestEmailGuestInvites(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	userInvites := model.GuestsInvite{
		Emails:   []string{"newuser1@valid.com", "newuser2@valid.com"},
		Channels: []string{th.BasicChannel.Id},
		Message:  "Welcome!",
	}

	t.Run("Invites disabled", func(t *testing.T) {
		_, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &userInvites, th.BasicUser.Id)
		require.Equal(t, "api.team.invite_members.disabled.app_error", err.Id)
	})

	enableEmailInvitations := *th.App.Config().ServiceSettings.EnableEmailInvitations
	th.BasicTeam.AllowedDomains = "valid.com"
	_, err := th.App.UpdateTeam(th.BasicTeam)
	require.Nil(t, err, "Should update the team")

	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableEmailInvitations = &enableEmailInvitations })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableEmailInvitations = true })

	t.Run("Empty invite list", func(t *testing.T) {
		userInvites.Emails = []string{}
		_, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &userInvites, th.BasicUser.Id)
		require.Equal(t, "api.team.invite_members.no_one.app_error", err.Id)
	})

	t.Run("invites to disallowed domains", func(t *testing.T) {
		userInvites.Emails = []string{"newuser1@valid.com", "newuser2@invalid.com"}
		inviteResult, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &userInvites, th.BasicUser.Id)
		require.Nil(t, err)
		for _, invite := range inviteResult {
			if "newuser2@invalid.com" == invite.Email {
				require.Equal(t, "api.team.invite_members.invalid_email.app_error", invite.Error.Id)
			} else {
				require.Nil(t, invite.Error)
			}
		}
	})

	t.Run("Happy path", func(t *testing.T) {
		userInvites.Emails = []string{"newuser1@valid.com", "newuser2@valid.com"}
		inviteResult, err := th.App.InviteGuestsToChannelsGracefully(th.BasicTeam.Id, &userInvites, th.BasicUser.Id)
		require.Nil(t, err)
		for _, invite := range inviteResult {
			require.Nil(t, invite.Error)
		}
	})
}

func TestClearTeamMembersCache(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Store.(*mocks.Store)
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

	th.App.ClearTeamMembersCache("teamID")
}
