// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
)

func TestCreateTeam(t *testing.T) {
	th := Setup().InitBasic()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

	if _, err := CreateTeam(th.BasicTeam); err == nil {
		t.Fatal("Should not create a new team - team already exist")
	}
}

func TestCreateTeamWithUser(t *testing.T) {
	th := Setup().InitBasic()

	id := model.NewId()
	team := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	if _, err := CreateTeamWithUser(team, th.BasicUser.Id); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team with existing user")
	}

	if _, err := CreateTeamWithUser(team, model.NewId()); err == nil {
		t.Fatal("Should not create a new team - user does not exist")
	}

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := CreateUser(&user)

	id = model.NewId()
	team2 := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success2+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	//Fail to create a team with user when user has set email without domain
	if _, err := CreateTeamWithUser(team2, ruser.Id); err == nil {
		t.Log(err.Message)
		t.Fatal("Should not create a team with user when user has set email without domain")
	} else {
		if err.Message != "model.team.is_valid.email.app_error" {
			t.Log(err)
			t.Fatal("Invalid error message")
		}
	}
}

func TestUpdateTeam(t *testing.T) {
	th := Setup().InitBasic()

	th.BasicTeam.DisplayName = "Testing 123"

	if updatedTeam, err := UpdateTeam(th.BasicTeam); err != nil {
		t.Log(err)
		t.Fatal("Should update the team")
	} else {
		if updatedTeam.DisplayName != "Testing 123" {
			t.Fatal("Wrong Team DisplayName")
		}
	}
}

func TestAddUserToTeam(t *testing.T) {
	th := Setup().InitBasic()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := CreateUser(&user)

	if _, err := AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestAddUserToTeamByTeamId(t *testing.T) {
	th := Setup().InitBasic()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := CreateUser(&user)

	if err := AddUserToTeamByTeamId(th.BasicTeam.Id, ruser); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup().InitBasic()

	team, err := CreateTeam(&model.Team{
		DisplayName: "deletion-test",
		Name:        "deletion-test",
		Email:       "foo@foo.com",
		Type:        model.TEAM_OPEN,
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer func() {
		PermanentDeleteTeam(team)
	}()

	command, err := CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    team.Id,
		Trigger:   "foo",
		URL:       "http://foo",
		Method:    model.COMMAND_METHOD_POST,
	})
	if err != nil {
		t.Fatal(err.Error())
	}
	defer DeleteCommand(command.Id)

	if command, err = GetCommand(command.Id); command == nil || err != nil {
		t.Fatal("unable to get new command")
	}

	if err := PermanentDeleteTeam(team); err != nil {
		t.Fatal(err.Error())
	}

	if command, err = GetCommand(command.Id); command != nil || err == nil {
		t.Fatal("command wasn't deleted")
	}
}

func TestSanitizeTeam(t *testing.T) {
	th := Setup()

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
			Roles: model.ROLE_SYSTEM_USER.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.ROLE_TEAM_USER.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("user of the team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.ROLE_SYSTEM_USER.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.ROLE_TEAM_USER.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("team admin", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.ROLE_SYSTEM_USER.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.ROLE_TEAM_USER.Id + " " + model.ROLE_TEAM_ADMIN.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})

	t.Run("team admin of another team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.ROLE_SYSTEM_USER.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.ROLE_TEAM_USER.Id + " " + model.ROLE_TEAM_ADMIN.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email != "" && sanitized.AllowedDomains != "" {
			t.Fatal("should've sanitized team")
		}
	})

	t.Run("system admin, not a user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.ROLE_SYSTEM_USER.Id + " " + model.ROLE_SYSTEM_ADMIN.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: model.NewId(),
					Roles:  model.ROLE_TEAM_USER.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})

	t.Run("system admin, user of team", func(t *testing.T) {
		userId := model.NewId()
		session := model.Session{
			Roles: model.ROLE_SYSTEM_USER.Id + " " + model.ROLE_SYSTEM_ADMIN.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: team.Id,
					Roles:  model.ROLE_TEAM_USER.Id,
				},
			},
		}

		sanitized := SanitizeTeam(session, copyTeam())
		if sanitized.Email == "" && sanitized.AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized team")
		}
	})
}

func TestSanitizeTeams(t *testing.T) {
	th := Setup()

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
			Roles: model.ROLE_SYSTEM_USER.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.ROLE_TEAM_USER.Id,
				},
				{
					UserId: userId,
					TeamId: teams[1].Id,
					Roles:  model.ROLE_TEAM_USER.Id + " " + model.ROLE_TEAM_ADMIN.Id,
				},
			},
		}

		sanitized := SanitizeTeams(session, teams)

		if sanitized[0].Email != "" && sanitized[0].AllowedDomains != "" {
			t.Fatal("should've sanitized first team")
		}

		if sanitized[1].Email == "" && sanitized[1].AllowedDomains == "" {
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
			Roles: model.ROLE_SYSTEM_USER.Id + " " + model.ROLE_SYSTEM_ADMIN.Id,
			TeamMembers: []*model.TeamMember{
				{
					UserId: userId,
					TeamId: teams[0].Id,
					Roles:  model.ROLE_TEAM_USER.Id,
				},
			},
		}

		sanitized := SanitizeTeams(session, teams)

		if sanitized[0].Email == "" && sanitized[0].AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized first team")
		}

		if sanitized[1].Email == "" && sanitized[1].AllowedDomains == "" {
			t.Fatal("shouldn't have sanitized second team")
		}
	})
}
