// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestJoinCommands(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel0 := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel0 = Client.Must(Client.CreateChannel(channel0)).Data.(*model.Channel)

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel1.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel2.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	data := make(map[string]string)
	data["user_id"] = user2.Id
	channel3 := Client.Must(Client.CreateDirectChannel(data)).Data.(*model.Channel)

	rs5 := Client.Must(Client.Command(channel0.Id, "/join "+channel2.Name, false)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs5.GotoLocation, "/"+team.Name+"/channels/"+channel2.Name) {
		t.Fatal("failed to join channel")
	}

	rs6 := Client.Must(Client.Command(channel0.Id, "/join "+channel3.Name, false)).Data.(*model.CommandResponse)
	if strings.HasSuffix(rs6.GotoLocation, "/"+team.Name+"/channels/"+channel3.Name) {
		t.Fatal("should not have joined direct message channel")
	}

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)

	if len(c1.Channels) != 5 { // 4 because of town-square, off-topic and direct
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
