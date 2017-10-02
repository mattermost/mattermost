// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

// also used to test /open (see command_open_test.go)
func testJoinCommands(t *testing.T, alias string) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel0 := &model.Channel{DisplayName: "00", Name: "00" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel0 = Client.Must(Client.CreateChannel(channel0)).Data.(*model.Channel)

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel1.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	Client.Must(Client.LeaveChannel(channel2.Id))

	channel3 := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)

	rs5 := Client.Must(Client.Command(channel0.Id, "/"+alias+" "+channel2.Name)).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs5.GotoLocation, "/"+team.Name+"/channels/"+channel2.Name) {
		t.Fatal("failed to join channel")
	}

	rs6 := Client.Must(Client.Command(channel0.Id, "/"+alias+" "+channel3.Name)).Data.(*model.CommandResponse)
	if strings.HasSuffix(rs6.GotoLocation, "/"+team.Name+"/channels/"+channel3.Name) {
		t.Fatal("should not have joined direct message channel")
	}

	c1 := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)

	found := false
	for _, c := range *c1 {
		if c.Id == channel2.Id {
			found = true
		}
	}

	if !found {
		t.Fatal("did not join channel")
	}
}

func TestJoinCommands(t *testing.T) {
	testJoinCommands(t, "join")
}
