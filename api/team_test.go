// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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

	_, err := Client.SignupTeam("test@nowhere.com", "name", T)
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreateFromSignupTeam(t *testing.T) {
	Setup()

	props := make(map[string]string)
	props["email"] = strings.ToLower(model.NewId()) + "corey+test@test.com"
	props["name"] = "Test Company name"
	props["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(props)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	user := model.User{Email: props["email"], Nickname: "Corey Hulen", Password: "hello"}

	ts := model.TeamSignup{Team: team, User: user, Invites: []string{"corey+test@test.com"}, Data: data, Hash: hash}

	rts, err := Client.CreateTeamFromSignup(&ts, T)
	if err != nil {
		t.Fatal(err)
	}

	if rts.Data.(*model.TeamSignup).Team.DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	ruser := rts.Data.(*model.TeamSignup).User

	if result, err := Client.LoginById(ruser.Id, user.Password, T); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.User).Email != user.Email {
			t.Fatal("email's didn't match")
		}
	}

	c1 := Client.Must(Client.GetChannels("", T)).Data.(*model.ChannelList)
	if len(c1.Channels) != 2 {
		t.Fatal("default channels not created")
	}

	ts.Data = "garbage"
	_, err = Client.CreateTeamFromSignup(&ts, T)
	if err == nil {
		t.Fatal(err)
	}
}

func TestCreateTeam(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, err := Client.CreateTeam(&team, T)
	if err != nil {
		t.Fatal(err)
	}

	user := &model.User{TeamId: rteam.Data.(*model.Team).Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	c1 := Client.Must(Client.GetChannels("", T)).Data.(*model.ChannelList)
	if len(c1.Channels) != 2 {
		t.Fatal("default channels not created")
	}

	if rteam.Data.(*model.Team).DisplayName != team.DisplayName {
		t.Fatal("full name didn't match")
	}

	if _, err := Client.CreateTeam(rteam.Data.(*model.Team), T); err == nil {
		t.Fatal("Cannot create an existing")
	}

	rteam.Data.(*model.Team).Id = ""
	if _, err := Client.CreateTeam(rteam.Data.(*model.Team), T); err != nil {
		if err.Message != "A team with that domain already exists" {
			t.Fatal(err)
		}
	}

	if _, err := Client.DoApiPost("/teams/create", "garbage", T); err == nil {
		t.Fatal("should have been an error")
	}
}

func TestFindTeamByEmail(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	if r1, err := Client.FindTeams(user.Email, T); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal()
		}
		if teams[team.Id].DisplayName != team.DisplayName {
			t.Fatal()
		}
	}

	if _, err := Client.FindTeams("missing", T); err != nil {
		t.Fatal(err)
	}
}

func TestGetAllTeams(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.GetAllTeams(T); err == nil {
		t.Fatal("you shouldn't have permissions")
	}

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "cmd_line"
	UpdateRoles(c, user, model.ROLE_SYSTEM_ADMIN, T)

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if r1, err := Client.GetAllTeams(T); err != nil {
		t.Fatal(err)
	} else {
		teams := r1.Data.(map[string]*model.Team)
		if teams[team.Id].Name != team.Name {
			t.Fatal()
		}
	}
}

func TestTeamPermDelete(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id, T))

	Client.LoginByEmail(team.Name, user1.Email, "pwd", T)

	channel1 := &model.Channel{DisplayName: "TestGetPosts", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1, T)).Data.(*model.Channel)

	post1 := &model.Post{ChannelId: channel1.Id, Message: "search for post1"}
	post1 = Client.Must(Client.CreatePost(post1, T)).Data.(*model.Post)

	post2 := &model.Post{ChannelId: channel1.Id, Message: "search for post2"}
	post2 = Client.Must(Client.CreatePost(post2, T)).Data.(*model.Post)

	post3 := &model.Post{ChannelId: channel1.Id, Message: "#hashtag search for post3"}
	post3 = Client.Must(Client.CreatePost(post3, T)).Data.(*model.Post)

	post4 := &model.Post{ChannelId: channel1.Id, Message: "hashtag for post4"}
	post4 = Client.Must(Client.CreatePost(post4, T)).Data.(*model.Post)

	c := &Context{}
	c.RequestId = model.NewId()
	c.IpAddress = "test"

	err := PermanentDeleteTeam(c, team, T)
	if err != nil {
		t.Fatal(err)
	}

	Client.ClearOAuthToken()
}

/*

XXXXXX investigate and fix failing test

func TestFindTeamByDomain(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
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
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))
	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	if _, err := Client.FindTeamsSendEmail(user.Email, T); err != nil {
		t.Fatal(err)
	} else {
	}

	if _, err := Client.FindTeamsSendEmail("missing", T); err != nil {

		// It should actually succeed at sending the email since it doesn't exist
		if !strings.Contains(err.DetailedError, "Failed to add to email address") {
			t.Fatal(err)
		}
	}
}

func TestInviteMembers(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	invite := make(map[string]string)
	invite["email"] = model.NewId() + "corey+test@test.com"
	invite["first_name"] = "Test"
	invite["last_name"] = "Guy"
	invites := &model.Invites{Invites: []map[string]string{invite}}
	invites.Invites = append(invites.Invites, invite)

	if _, err := Client.InviteMembers(invites, T); err != nil {
		t.Fatal(err)
	}

	invites = &model.Invites{Invites: []map[string]string{}}
	if _, err := Client.InviteMembers(invites, T); err == nil {
		t.Fatal("Should have errored out on no invites to send")
	}
}

func TestUpdateTeamDisplayName(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team, T)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: "test@nowhere.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id, T))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "", T)).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id, T))

	Client.LoginByEmail(team.Name, user2.Email, "pwd", T)

	vteam := &model.Team{DisplayName: team.DisplayName, Name: team.Name, Email: team.Email, Type: team.Type}
	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam, T); err == nil {
		t.Fatal("Should have errored, not admin")
	}

	Client.LoginByEmail(team.Name, user.Email, "pwd", T)

	vteam.DisplayName = ""
	if _, err := Client.UpdateTeam(vteam, T); err == nil {
		t.Fatal("Should have errored, empty name")
	}

	vteam.DisplayName = "NewName"
	if _, err := Client.UpdateTeam(vteam, T); err != nil {
		t.Fatal(err)
	}
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

		_, err := Client.CreateTeam(&team, T)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestGetMyTeam(t *testing.T) {
	Setup()

	team := model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	rteam, _ := Client.CreateTeam(&team, T)

	user := model.User{TeamId: rteam.Data.(*model.Team).Id, Email: strings.ToLower(model.NewId()) + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	ruser, _ := Client.CreateUser(&user, "", T)
	store.Must(Srv.Store.User().VerifyEmail(ruser.Data.(*model.User).Id, T))

	Client.LoginByEmail(team.Name, user.Email, user.Password, T)

	if result, err := Client.GetMyTeam("", T); err != nil {
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
