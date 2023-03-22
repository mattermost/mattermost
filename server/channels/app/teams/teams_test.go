// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
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

	_, err := th.service.CreateTeam(team)
	require.NoError(t, err, "Should create a new team")

	_, err = th.service.CreateTeam(team)
	require.Error(t, err, "Should not create a new team - team already exist")
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

	_, err := th.service.CreateTeam(team)
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

		_, alreadyAdded, err := th.service.JoinUserToTeam(team, ruser)
		require.False(t, alreadyAdded, "Should return already added equal to false")
		require.NoError(t, err)
	})

	t.Run("join when you are a member", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser := th.CreateUser(&user)
		defer th.DeleteUser(&user)

		_, _, err := th.service.JoinUserToTeam(team, ruser)
		require.NoError(t, err)

		_, alreadyAdded, err := th.service.JoinUserToTeam(team, ruser)
		require.True(t, alreadyAdded, "Should return already added")
		require.NoError(t, err)
	})

	t.Run("re-join after leaving", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser := th.CreateUser(&user)
		defer th.DeleteUser(&user)

		member, _, err := th.service.JoinUserToTeam(team, ruser)
		require.NoError(t, err)
		err = th.service.RemoveTeamMember(member)
		require.NoError(t, err)

		_, alreadyAdded, err := th.service.JoinUserToTeam(team, ruser)
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

		_, _, err := th.service.JoinUserToTeam(team, ruser1)
		require.NoError(t, err)

		_, _, err = th.service.JoinUserToTeam(team, ruser2)
		require.Error(t, err, "Should fail")
	})

	t.Run("re-join after leaving with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1 := th.CreateUser(&user1)

		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2 := th.CreateUser(&user2)

		defer th.DeleteUser(&user1)
		defer th.DeleteUser(&user2)

		member, _, err := th.service.JoinUserToTeam(team, ruser1)
		require.NoError(t, err)
		err = th.service.RemoveTeamMember(member)
		require.NoError(t, err)
		_, _, err = th.service.JoinUserToTeam(team, ruser2)
		require.NoError(t, err)

		_, _, err = th.service.JoinUserToTeam(team, ruser1)
		require.Error(t, err, "Should fail")
	})
}
