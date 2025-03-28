// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	_, err := th.service.CreateTeam(th.Context, team)
	require.NoError(t, err, "Should create a new team")

	_, err = th.service.CreateTeam(th.Context, team)
	require.Error(t, err, "Should not create a new team - team already exist")
}

func TestCreateTeamWithExperimentalDefaultChannels(t *testing.T) {
	th := Setup(t)
	th.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.ExperimentalDefaultChannels = []string{"channel-1", "channel-2"}
	})
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TeamOpen,
	}

	_, err := th.service.CreateTeam(th.Context, team)
	require.NoError(t, err, "Should create a new team")

	createdTeam, err := th.service.GetTeam(team.Id)
	require.NoError(t, err)
	require.Equal(t, createdTeam.Name, "name"+id)

	channels, err := th.service.channelStore.GetAll(team.Id)
	require.NoError(t, err)
	require.Len(t, channels, 3)

	ch, err := th.service.channelStore.GetByName(team.Id, "town-square", false)
	require.NoError(t, err)
	require.NotNil(t, ch)

	ch, err = th.service.channelStore.GetByName(team.Id, "channel-1", false)
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, ch.DisplayName, "channel-1")

	ch, err = th.service.channelStore.GetByName(team.Id, "channel-2", false)
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, ch.DisplayName, "channel-2")
}

func TestPatchTeamTypeAndOpenInvite(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// Create test team first
	id := model.NewId()
	team := &model.Team{
		DisplayName:     "dn_" + id,
		Name:            "name" + id,
		Email:           "success+" + id + "@simulator.amazonses.com",
		Type:            model.TeamOpen,
		AllowOpenInvite: true,
	}

	createdTeam, err := th.service.CreateTeam(th.Context, team)
	require.NoError(t, err, "Should create a new team")

	// Test 1: Changing AllowOpenInvite to false should set Type to Invite
	patch := &model.TeamPatch{
		AllowOpenInvite: model.NewPointer(false),
	}

	updatedTeam, err := th.service.PatchTeam(createdTeam.Id, patch)
	require.NoError(t, err, "Should patch team successfully")

	require.Equal(t, model.TeamInvite, updatedTeam.Type, "Team type should be changed to Invite")
	require.Equal(t, false, updatedTeam.AllowOpenInvite, "AllowOpenInvite should be false")
	require.NotEqual(t, createdTeam.InviteId, updatedTeam.InviteId, "InviteId should be regenerated")

	// Test 2: Changing AllowOpenInvite to true should set Type to Open
	patch = &model.TeamPatch{
		AllowOpenInvite: model.NewPointer(true),
	}

	updatedTeam, err = th.service.PatchTeam(updatedTeam.Id, patch)
	require.NoError(t, err, "Should patch team successfully")

	require.Equal(t, model.TeamOpen, updatedTeam.Type, "Team type should be changed to Open")
	require.Equal(t, true, updatedTeam.AllowOpenInvite, "AllowOpenInvite should be true")

	// Test 3: Changing other fields should not affect Type or AllowOpenInvite
	patch = &model.TeamPatch{
		DisplayName: model.NewPointer("New Team Name"),
	}

	beforeType := updatedTeam.Type
	beforeAllowOpenInvite := updatedTeam.AllowOpenInvite

	updatedTeam, err = th.service.PatchTeam(updatedTeam.Id, patch)
	require.NoError(t, err, "Should patch team successfully")

	require.Equal(t, beforeType, updatedTeam.Type, "Team type should not change")
	require.Equal(t, beforeAllowOpenInvite, updatedTeam.AllowOpenInvite, "AllowOpenInvite should not change")
	require.Equal(t, "New Team Name", updatedTeam.DisplayName, "DisplayName should be updated")
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

	_, err := th.service.CreateTeam(th.Context, team)
	require.NoError(t, err, "Should create a new team")

	maxUsersPerTeam := th.service.config().TeamSettings.MaxUsersPerTeam
	defer func() {
		th.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = maxUsersPerTeam })
		th.DeleteTeam(team)
	}()
	one := 1
	th.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.MaxUsersPerTeam = &one })

	t.Run("new join", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser := th.CreateUser(&user)
		defer th.DeleteUser(&user)

		_, alreadyAdded, err := th.service.JoinUserToTeam(th.Context, team, ruser)
		require.False(t, alreadyAdded, "Should return already added equal to false")
		require.NoError(t, err)
	})

	t.Run("join when you are a member", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser := th.CreateUser(&user)
		defer th.DeleteUser(&user)

		_, _, err := th.service.JoinUserToTeam(th.Context, team, ruser)
		require.NoError(t, err)

		_, alreadyAdded, err := th.service.JoinUserToTeam(th.Context, team, ruser)
		require.True(t, alreadyAdded, "Should return already added")
		require.NoError(t, err)
	})

	t.Run("re-join after leaving", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser := th.CreateUser(&user)
		defer th.DeleteUser(&user)

		member, _, err := th.service.JoinUserToTeam(th.Context, team, ruser)
		require.NoError(t, err)
		err = th.service.RemoveTeamMember(th.Context, member)
		require.NoError(t, err)

		_, alreadyAdded, err := th.service.JoinUserToTeam(th.Context, team, ruser)
		require.False(t, alreadyAdded, "Should return already added equal to false")
		require.NoError(t, err)
	})

	t.Run("new join with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1 := th.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2 := th.CreateUser(&user2)

		defer th.DeleteUser(&user1)
		defer th.DeleteUser(&user2)

		_, _, err := th.service.JoinUserToTeam(th.Context, team, ruser1)
		require.NoError(t, err)

		_, _, err = th.service.JoinUserToTeam(th.Context, team, ruser2)
		require.Error(t, err, "Should fail")
	})

	t.Run("re-join after leaving with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1 := th.CreateUser(&user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2 := th.CreateUser(&user2)

		defer th.DeleteUser(&user1)
		defer th.DeleteUser(&user2)

		member, _, err := th.service.JoinUserToTeam(th.Context, team, ruser1)
		require.NoError(t, err)
		err = th.service.RemoveTeamMember(th.Context, member)
		require.NoError(t, err)
		_, _, err = th.service.JoinUserToTeam(th.Context, team, ruser2)
		require.NoError(t, err)

		_, _, err = th.service.JoinUserToTeam(th.Context, team, ruser1)
		require.Error(t, err, "Should fail")
	})
}
