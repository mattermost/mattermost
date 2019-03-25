// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
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

	if _, err := th.App.CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

	if _, err := th.App.CreateTeam(th.BasicTeam); err == nil {
		t.Fatal("Should not create a new team - team already exist")
	}
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

	if _, err := th.App.CreateTeamWithUser(team, th.BasicUser.Id); err != nil {
		t.Fatal("Should create a new team with existing user", err)
	}

	if _, err := th.App.CreateTeamWithUser(team, model.NewId()); err == nil {
		t.Fatal("Should not create a new team - user does not exist")
	}
}

func TestUpdateTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.BasicTeam.DisplayName = "Testing 123"

	if updatedTeam, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
		t.Log(err)
		t.Fatal("Should update the team")
	} else {
		if updatedTeam.DisplayName != "Testing 123" {
			t.Fatal("Wrong Team DisplayName")
		}
	}
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("add user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err != nil {
			t.Log(err)
			t.Fatal("Should add user to the team")
		}
	})

	t.Run("allow user by domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err != nil {
			t.Log(err)
			t.Fatal("Should have allowed whitelisted user")
		}
	})

	t.Run("block user by domain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, err := th.App.CreateUser(&user)
		if err != nil {
			t.Fatalf("Error creating user: %s", err)
		}
		defer th.App.PermanentDeleteUser(&user)

		if _, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not add restricted user")
		}

		user = model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), AuthService: "notnil", AuthData: model.NewString("notnil")}
		ruser, err = th.App.CreateUser(&user)
		if err != nil {
			t.Fatalf("Error creating authservice user: %s", err)
		}
		defer th.App.PermanentDeleteUser(&user)

		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not add authservice user")
		}
	})

	t.Run("block user with subdomain", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not add restricted user")
		}
	})

	t.Run("allow users by multiple domains", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "foo.com, bar.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@foo.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@bar.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)
		user3 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser3, _ := th.App.CreateUser(&user3)
		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)
		defer th.App.PermanentDeleteUser(&user3)

		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser1.Id, ""); err != nil {
			t.Log(err)
			t.Fatal("Should have allowed whitelisted user1")
		}
		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser2.Id, ""); err != nil {
			t.Log(err)
			t.Fatal("Should have allowed whitelisted user2")
		}
		if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser3.Id, ""); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not have allowed restricted user3")
		}

	})
}

func TestAddUserToTeamByToken(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	t.Run("invalid token", func(t *testing.T) {
		if _, err := th.App.AddUserToTeamByToken(ruser.Id, "123"); err == nil {
			t.Fatal("Should fail on unexisting token")
		}
	})

	t.Run("invalid token type", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_VERIFY_EMAIL,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token); err == nil {
			t.Fatal("Should fail on bad token type")
		}
	})

	t.Run("expired token", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		token.CreateAt = model.GetMillis() - TEAM_INVITATION_EXPIRY_TIME - 1
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token); err == nil {
			t.Fatal("Should fail on expired token")
		}
	})

	t.Run("invalid team id", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": model.NewId()}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token); err == nil {
			t.Fatal("Should fail on bad team id")
		}
	})

	t.Run("invalid user id", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		defer th.App.DeleteToken(token)
		if _, err := th.App.AddUserToTeamByToken(model.NewId(), token.Token); err == nil {
			t.Fatal("Should fail on bad user id")
		}
	})

	t.Run("valid request", func(t *testing.T) {
		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		<-th.App.Srv.Store.Token().Save(token)
		if _, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token); err != nil {
			t.Log(err)
			t.Fatal("Should add user to the team")
		}
		if result := <-th.App.Srv.Store.Token().GetByToken(token.Token); result.Err == nil {
			t.Fatal("The token must be deleted after be used")
		}
	})

	t.Run("block user", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		token := model.NewToken(
			TOKEN_TYPE_TEAM_INVITATION,
			model.MapToJson(map[string]string{"teamId": th.BasicTeam.Id}),
		)
		<-th.App.Srv.Store.Token().Save(token)

		if _, err := th.App.AddUserToTeamByToken(ruser.Id, token.Token); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not add restricted user")
		}
	})
}

func TestAddUserToTeamByTeamId(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("add user", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)

		if err := th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser); err != nil {
			t.Log(err)
			t.Fatal("Should add user to the team")
		}
	})

	t.Run("block user", func(t *testing.T) {
		th.BasicTeam.AllowedDomains = "example.com"
		if _, err := th.App.UpdateTeam(th.BasicTeam); err != nil {
			t.Log(err)
			t.Fatal("Should update the team")
		}

		user := model.User{Email: strings.ToLower(model.NewId()) + "test@invalid.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		if err := th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser); err == nil || err.Where != "JoinUserToTeam" {
			t.Log(err)
			t.Fatal("Should not add restricted user")
		}
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
	if err != nil {
		t.Fatal(err.Error())
	}
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
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.DeleteCommand(command.Id)

	if command, err = th.App.GetCommand(command.Id); command == nil || err != nil {
		t.Fatal("unable to get new command")
	}

	err = th.App.PermanentDeleteTeam(team)
	require.Nil(t, err)

	if command, err = th.App.GetCommand(command.Id); command != nil || err == nil {
		t.Fatal("command wasn't deleted")
	}

	// Test deleting a team with no channels.
	team = th.CreateTeam()
	defer func() {
		th.App.PermanentDeleteTeam(team)
	}()

	if channels, err := th.App.GetPublicChannelsForTeam(team.Id, 0, 1000); err != nil {
		t.Fatal(err)
	} else {
		for _, channel := range *channels {
			if err2 := th.App.PermanentDeleteChannel(channel); err2 != nil {
				t.Fatal(err)
			}
		}
	}

	if err := th.App.PermanentDeleteTeam(team); err != nil {
		t.Fatal(err)
	}
}

func TestSanitizeTeam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	team := &model.Team{
		Id:             model.NewId(),
		Email:          th.MakeEmail(),
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
		if sanitized.Email != "" {
			t.Fatal("should've sanitized team")
		}
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
		if sanitized.Email != "" {
			t.Fatal("should've sanitized team")
		}
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
		if sanitized.Email == "" {
			t.Fatal("shouldn't have sanitized team")
		}
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
		if sanitized.Email != "" {
			t.Fatal("should've sanitized team")
		}
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
		if sanitized.Email == "" {
			t.Fatal("shouldn't have sanitized team")
		}
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
		if sanitized.Email == "" {
			t.Fatal("shouldn't have sanitized team")
		}
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

		if sanitized[0].Email != "" {
			t.Fatal("should've sanitized first team")
		}

		if sanitized[1].Email == "" {
			t.Fatal("shouldn't have sanitized second team")
		}
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

		if sanitized[0].Email == "" {
			t.Fatal("shouldn't have sanitized first team")
		}

		if sanitized[1].Email == "" {
			t.Fatal("shouldn't have sanitized second team")
		}
	})
}

func TestJoinUserToTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := th.App.CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

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

		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); alreadyAdded || err != nil {
			t.Fatal("Should return already added equal to false and no error")
		}
	})

	t.Run("join when you are a member", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)
		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); !alreadyAdded || err != nil {
			t.Fatal("Should return already added and no error")
		}
	})

	t.Run("re-join after leaving", func(t *testing.T) {
		user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser, _ := th.App.CreateUser(&user)
		defer th.App.PermanentDeleteUser(&user)

		th.App.joinUserToTeam(team, ruser)
		th.App.LeaveTeam(team, ruser, ruser.Id)
		if _, alreadyAdded, err := th.App.joinUserToTeam(team, ruser); alreadyAdded || err != nil {
			t.Fatal("Should return already added equal to false and no error")
		}
	})

	t.Run("new join with limit problem", func(t *testing.T) {
		user1 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser1, _ := th.App.CreateUser(&user1)
		user2 := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
		ruser2, _ := th.App.CreateUser(&user2)
		defer th.App.PermanentDeleteUser(&user1)
		defer th.App.PermanentDeleteUser(&user2)
		th.App.joinUserToTeam(team, ruser1)
		if _, _, err := th.App.joinUserToTeam(team, ruser2); err == nil {
			t.Fatal("Should fail")
		}
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
		if _, _, err := th.App.joinUserToTeam(team, ruser1); err == nil {
			t.Fatal("Should fail")
		}
	})
}

func TestAppUpdateTeamScheme(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.BasicTeam
	mockID := model.NewString("x")
	team.SchemeId = mockID

	updatedTeam, err := th.App.UpdateTeamScheme(th.BasicTeam)
	if err != nil {
		t.Fatal(err)
	}

	if updatedTeam.SchemeId != mockID {
		t.Fatal("Wrong Team SchemeId")
	}
}

func TestGetTeamMembers(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var userIDs sort.StringSlice
	userIDs = append(userIDs, th.BasicUser.Id)
	userIDs = append(userIDs, th.BasicUser2.Id)

	for i := 0; i < 8; i++ {
		user := model.User{
			Email:    strings.ToLower(model.NewId()) + "success+test@example.com",
			Username: fmt.Sprintf("user%v", i),
			Password: "passwd1",
		}
		ruser, err := th.App.CreateUser(&user)
		require.Nil(t, err)
		require.NotNil(t, ruser)
		defer th.App.PermanentDeleteUser(&user)

		_, err = th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, "")
		require.Nil(t, err)

		// Store the user ids for comparison later
		userIDs = append(userIDs, ruser.Id)
	}
	// Sort them because the result of GetTeamMembers() is also sorted
	sort.Sort(userIDs)

	// Fetch team members multipile times
	members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 5, nil)
	require.Nil(t, err)
	// This should return 5 members
	members2, err := th.App.GetTeamMembers(th.BasicTeam.Id, 5, 6, nil)
	require.Nil(t, err)
	members = append(members, members2...)

	require.Equal(t, len(userIDs), len(members))
	for i, member := range members {
		assert.Equal(t, userIDs[i], member.UserId)
	}
}

func TestGetTeamStats(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	teamStats, err := th.App.GetTeamStats(th.BasicTeam.Id)
	require.Nil(t, err)
	require.NotNil(t, teamStats)
	members, err := th.App.GetTeamMembers(th.BasicTeam.Id, 0, 5, nil)
	require.Nil(t, err)
	assert.Equal(t, int64(len(members)), teamStats.TotalMemberCount)
}
