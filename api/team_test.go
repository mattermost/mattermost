// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"strings"
	"testing"
)

func TestSignupTeam(t *testing.T) {
	Setup()

	_, err := Client.SignupTeam("test@nowhere.com", "name")
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreateFromSignupTeam(t *testing.T) {
	Setup()

	props := make(map[string]string)
	props["email"] = strings.ToLower(model.NewId()) + "corey@test.com"
	props["name"] = "Test Company name"
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.InviteSalt))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	user := model.User{Email: props["email"], Nickname: "Corey Hulen", Password: "hello"}

	ts := model.TeamSignup{Team: team, User: user, Invites: []string{"corey@test.com"}, Data: data, Hash: hash}

	rts, err := Client.CreateTeamFromSignup(&ts)
	if err != nil {
		t.Fatal(err)
	}

	if rts.Data.(*model.TeamSignup).Team.DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	ruser := rts.Data.(*model.TeamSignup).User

	if result, err := Client.LoginById(ruser.Id, user.Password); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	if len(c1.Channels) != 2 {
		t.Fatal("default channels not created")
	}

	ts.Data = "garbage"
	_, err = Client.CreateTeamFromSignup(&ts)
	if err == nil {
		t.Fatal(err)
	}
}

func TestCreateTeam(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, err := Client.CreateTeam(&team)
	if err != nil {
		t.Fatal(err)
	}

	user := &model.User{TeamId: rteam.Data.(*model.Team).Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)
	if len(c1.Channels) != 2 {
		t.Fatal("default channels not created")
	}

	if rteam.Data.(*model.Team).DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	if _, err := Client.CreateTeam(rteam.Data.(*model.Team)); err == nil {
		t.Fatal("Cannot create an existing")
	}

	rteam.Data.(*model.Team).Id = ""
	if _, err := Client.CreateTeam(rteam.Data.(*model.Team)); err != nil {
		if err.Message != "A team with that domain already exists" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/teams/create", "garbage"); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestFindTeamByEmail(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if r1, err := Client.FindTeams(user.Email); err != nil {
		t.Fatal(err)
	} else {
		domains := r1.Data.([]string)
		if domains[0] != team.Name {
			t.Fatal(domains)
		}
	}

	if _, err := Client.FindTeams("missing"); err != nil {
		t.Fatal(err)
	}
}

/*

XXXXXX investigate and fix failing test

func TestFindTeamByDomain(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if r1, err := Client.FindTeamByDomain(team.Name, false); err != nil {
		t.Fatal(err)
	} else {
		val := r1.Data.(bool)
		if !val {
			t.Fatal("should be a valid domain")
		}
	}

	if r1, err := Client.FindTeamByDomain(team.Name, true); err != nil {
		t.Fatal(err)
	} else {
		val := r1.Data.(bool)
		if !val {
			t.Fatal("should be a valid domain")
		}
	}

	if r1, err := Client.FindTeamByDomain("a"+model.NewId()+"a", false); err != nil {
		t.Fatal(err)
	} else {
		val := r1.Data.(bool)
		if val {
			t.Fatal("shouldn't be a valid domain")
		}
	}
}

*/

func TestFindTeamByEmailSend(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.FindTeamsSendEmail(user.Email); err != nil {
		t.Fatal(err)
	} else {
	}

	if _, err := Client.FindTeamsSendEmail("missing"); err != nil {

		// It should actually succeed at sending the email since it doesn't exist
		if !strings.Contains(err.DetailedError, "Failed to add to email address") {
			t.Fatal(err)
		}
	}
}

func TestInviteMembers(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	invite := make(map[string]string)
	invite["email"] = model.NewId() + "corey@test.com"
	invite["first_name"] = "Test"
	invite["last_name"] = "Guy"
	invites := &model.Invites{Invites: []map[string]string{invite}}
	invites.Invites = append(invites.Invites, invite)

	if _, err := Client.InviteMembers(invites); err != nil {
		t.Fatal(err)
	}

	invites = &model.Invites{Invites: []map[string]string{}}
	if _, err := Client.InviteMembers(invites); err == nil {
		t.Fatal("Should have errored out on no invites to send")
	}
}

func TestUpdateTeamDisplayName(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	data := make(map[string]string)
	data["new_name"] = "NewName"
	if _, err := Client.UpdateTeamDisplayName(data); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	data["new_name"] = ""
	if _, err := Client.UpdateTeamDisplayName(data); err == nil {
		t.Fatal("Should have errored, empty name")
	}

	data["new_name"] = "NewName"
	if _, err := Client.UpdateTeamDisplayName(data); err != nil {
		t.Fatal(err)
	}
	// No GET team web service, so hard to confirm here that team name updated

	data["team_id"] = "junk"
	if _, err := Client.UpdateTeamDisplayName(data); err == nil {
		t.Fatal("Should have errored, junk team id")
	}

	data["team_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateTeamDisplayName(data); err == nil {
		t.Fatal("Should have errored, bad team id")
	}

	data["team_id"] = team.Id
	data["new_name"] = "NewNameAgain"
	if _, err := Client.UpdateTeamDisplayName(data); err != nil {
		t.Fatal(err)
	}
	// No GET team web service, so hard to confirm here that team name updated
}

func TestFuzzyTeamCreate(t *testing.T) {

	for i := 0; i < len(utils.FUZZY_STRINGS_NAMES) || i < len(utils.FUZZY_STRINGS_EMAILS); i++ {
		testDisplayName := "Name"
		testEmail := "test@nowhere.com"

		if i < len(utils.FUZZY_STRINGS_NAMES) {
			testDisplayName = utils.FUZZY_STRINGS_NAMES[i]
		}
		if i < len(utils.FUZZY_STRINGS_EMAILS) {
			testEmail = utils.FUZZY_STRINGS_EMAILS[i]
		}

		team := model.Team{DisplayName: testDisplayName, Name: "z-z-" + model.NewId() + "a", Email: testEmail, Type: model.TEAM_OPEN}

		_, err := Client.CreateTeam(&team)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetMyTeam(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser, _ := Client.CreateUser(&user, "")
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id))

	Client.LoginByEmail(team.Name, user.Email, user.Password)

	if result, err := Client.GetMyTeam(""); err != nil {
		t.Fatal("Failed to get user")
	} else {
		if result.Data.(*model.Team).DisplayName != team.DisplayName {
			t.Fatal("team names did not match")
		}
		if result.Data.(*model.Team).Name != team.Name {
			t.Fatal("team domains did not match")
		}
		if result.Data.(*model.Team).Type != team.Type {
			t.Fatal("team types did not match")
		}
	}
}

func TestUpdateValetFeature(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

	user3 := &model.User{TeamId: team2.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user3 = Client.Must(Client.CreateUser(user3, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user3.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	data := make(map[string]string)
	data["allow_valet"] = "true"
	if _, err := Client.UpdateValetFeature(data); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	data["allow_valet"] = ""
	if _, err := Client.UpdateValetFeature(data); err == nil {
		t.Fatal("Should have errored, empty allow_valet field")
	}

	data["allow_valet"] = "true"
	if _, err := Client.UpdateValetFeature(data); err != nil {
		t.Fatal(err)
	}

	rteam := Client.Must(Client.GetMyTeam("")).Data.(*model.Team)
	if rteam.AllowValet != true {
		t.Fatal("Should have errored - allow valet property not updated")
	}

	data["team_id"] = "junk"
	if _, err := Client.UpdateValetFeature(data); err == nil {
		t.Fatal("Should have errored, junk team id")
	}

	data["team_id"] = "12345678901234567890123456"
	if _, err := Client.UpdateValetFeature(data); err == nil {
		t.Fatal("Should have errored, bad team id")
	}

	data["team_id"] = team.Id
	data["allow_valet"] = "false"
	if _, err := Client.UpdateValetFeature(data); err != nil {
		t.Fatal(err)
	}

	rteam = Client.Must(Client.GetMyTeam("")).Data.(*model.Team)
	if rteam.AllowValet != false {
		t.Fatal("Should have errored - allow valet property not updated")
	}

	Client.LoginByEmail(team2.Name, user3.Email, "pwd")

	data["team_id"] = team.Id
	data["allow_valet"] = "true"
	if _, err := Client.UpdateValetFeature(data); err == nil {
		t.Fatal("Should have errored, not part of team")
	}
}
