// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
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

	if _, err := th.App.CreateTeam(team); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team")
	}

	if _, err := th.App.CreateTeam(th.BasicTeam); err == nil {
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

	if _, err := th.App.CreateTeamWithUser(team, th.BasicUser.Id); err != nil {
		t.Log(err)
		t.Fatal("Should create a new team with existing user")
	}

	if _, err := th.App.CreateTeamWithUser(team, model.NewId()); err == nil {
		t.Fatal("Should not create a new team - user does not exist")
	}

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	id = model.NewId()
	team2 := &model.Team{
		DisplayName: "dn_" + id,
		Name:        "name" + id,
		Email:       "success2+" + id + "@simulator.amazonses.com",
		Type:        model.TEAM_OPEN,
	}

	//Fail to create a team with user when user has set email without domain
	if _, err := th.App.CreateTeamWithUser(team2, ruser.Id); err == nil {
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
	th := Setup().InitBasic()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	if _, err := th.App.AddUserToTeam(th.BasicTeam.Id, ruser.Id, ""); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestAddUserToTeamByTeamId(t *testing.T) {
	th := Setup().InitBasic()

	user := model.User{Email: strings.ToLower(model.NewId()) + "success+test@example.com", Nickname: "Darth Vader", Username: "vader" + model.NewId(), Password: "passwd1", AuthService: ""}
	ruser, _ := th.App.CreateUser(&user)

	if err := th.App.AddUserToTeamByTeamId(th.BasicTeam.Id, ruser); err != nil {
		t.Log(err)
		t.Fatal("Should add user to the team")
	}
}

func TestPermanentDeleteTeam(t *testing.T) {
	th := Setup().InitBasic()

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

	if err := th.App.PermanentDeleteTeam(team); err != nil {
		t.Fatal(err.Error())
	}

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
