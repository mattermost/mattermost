// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestShrugCommand(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	testString := "/shrug"

	r1 := Client.Must(Client.Command(channel1.Id, testString, false)).Data.(*model.CommandResponse)
	if r1 == nil {
		t.Fatal("Command failed to execute")
	}

	time.Sleep(100 * time.Millisecond)

	p1 := Client.Must(Client.GetPosts(channel1.Id, 0, 2, "")).Data.(*model.PostList)
	if len(p1.Order) != 1 {
		t.Fatal("Command failed to send")
	} else {
		if p1.Posts[p1.Order[0]].Message != `¯\\\_(ツ)\_/¯` {
			t.Log(p1.Posts[p1.Order[0]].Message)
			t.Fatal("invalid shrug reponse")
		}
	}
}
