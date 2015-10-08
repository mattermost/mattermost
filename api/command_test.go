// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestSuggestRootCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	if _, err := Client.Command("", "", true); err == nil {
		t.Fatal("Should fail")
	}

	rs1 := Client.Must(Client.Command("", "/", true)).Data.(*model.Command)

	hasLogout := false
	for _, v := range rs1.Suggestions {
		if v.Suggestion == "/logout" {
			hasLogout = true
		}
	}

	if !hasLogout {
		t.Log(rs1.Suggestions)
		t.Fatal("should have logout cmd")
	}

	rs2 := Client.Must(Client.Command("", "/log", true)).Data.(*model.Command)

	if rs2.Suggestions[0].Suggestion != "/logout" {
		t.Fatal("should have logout cmd")
	}

	rs3 := Client.Must(Client.Command("", "/joi", true)).Data.(*model.Command)

	if rs3.Suggestions[0].Suggestion != "/join" {
		t.Fatal("should have join cmd")
	}

	rs4 := Client.Must(Client.Command("", "/ech", true)).Data.(*model.Command)

	if rs4.Suggestions[0].Suggestion != "/echo" {
		t.Fatal("should have echo cmd")
	}
}

func TestLogoutCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	rs1 := Client.Must(Client.Command("", "/logout", false)).Data.(*model.Command)
	if rs1.GotoLocation != "/logout" {
		t.Fatal("failed to logout")
	}
}

func TestJoinCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel1.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel2.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	data := make(map[string]string)
	data["user_id"] = user2.Id
	channel3 := Client.Must(Client.CreateDirectChannel(data)).Data.(*model.Channel)

	rs1 := Client.Must(Client.Command("", "/join aa", true)).Data.(*model.Command)
	if rs1.Suggestions[0].Suggestion != "/join "+channel1.Name {
		t.Fatal("should have join cmd")
	}

	rs2 := Client.Must(Client.Command("", "/join bb", true)).Data.(*model.Command)
	if rs2.Suggestions[0].Suggestion != "/join "+channel2.Name {
		t.Fatal("should have join cmd")
	}

	rs3 := Client.Must(Client.Command("", "/join", true)).Data.(*model.Command)
	if len(rs3.Suggestions) != 2 {
		t.Fatal("should have 2 join cmd")
	}

	rs4 := Client.Must(Client.Command("", "/join ", true)).Data.(*model.Command)
	if len(rs4.Suggestions) != 2 {
		t.Fatal("should have 2 join cmd")
	}

	rs5 := Client.Must(Client.Command("", "/join "+channel2.Name, false)).Data.(*model.Command)
	if !strings.HasSuffix(rs5.GotoLocation, "/"+team.Name+"/channels/"+channel2.Name) {
		t.Fatal("failed to join channel")
	}

	rs6 := Client.Must(Client.Command("", "/join "+channel3.Name, false)).Data.(*model.Command)
	if strings.HasSuffix(rs6.GotoLocation, "/"+team.Name+"/channels/"+channel3.Name) {
		t.Fatal("should not have joined direct message channel")
	}

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)

	if len(c1.Channels) != 4 { // 4 because of town-square, off-topic and direct
		t.Fatal("didn't join channel")
	}

	found := false
	for _, c := range c1.Channels {
		if c.Name == channel2.Name {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("didn't join channel")
	}
}

func TestEchoCommand(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	echoTestString := "/echo test"

	r1 := Client.Must(Client.Command(channel1.Id, echoTestString, false)).Data.(*model.Command)
	if r1.Response != model.RESP_EXECUTED {
		t.Fatal("Echo command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 1 {
		t.Fatal("Echo command failed to send")
	}
}
