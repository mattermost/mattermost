// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestLeaveCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	team := th.BasicTeam
	user2 := th.BasicUser2

	channel1 := &model.Channel{DisplayName: "AA", Name: "aa" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)
	Client.Must(Client.JoinChannel(channel1.Id))

	channel2 := &model.Channel{DisplayName: "BB", Name: "bb" + model.NewId() + "a", Type: model.CHANNEL_PRIVATE, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)
	Client.Must(Client.JoinChannel(channel2.Id))
	Client.Must(Client.AddChannelMember(channel2.Id, user2.Id))

	channel3 := Client.Must(Client.CreateDirectChannel(user2.Id)).Data.(*model.Channel)

	rs1 := Client.Must(Client.Command(channel1.Id, "/leave")).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs1.GotoLocation, "/"+team.Name+"/channels/"+model.DEFAULT_CHANNEL) {
		t.Fatal("failed to leave open channel 1")
	}

	rs2 := Client.Must(Client.Command(channel2.Id, "/leave")).Data.(*model.CommandResponse)
	if !strings.HasSuffix(rs2.GotoLocation, "/"+team.Name+"/channels/"+model.DEFAULT_CHANNEL) {
		t.Fatal("failed to leave private channel 1")
	}

	rs3 := Client.Must(Client.Command(channel3.Id, "/leave")).Data.(*model.CommandResponse)
	if strings.HasSuffix(rs3.GotoLocation, "/"+team.Name+"/channels/"+model.DEFAULT_CHANNEL) {
		t.Fatal("should not have left direct message channel")
	}

	cdata := Client.Must(Client.GetChannels("")).Data.(*model.ChannelList)

	found := false
	for _, c := range *cdata {
		if c.Id == channel1.Id || c.Id == channel2.Id {
			found = true
		}
	}

	if found {
		t.Fatal("did not leave right channels")
	}

	for _, c := range *cdata {
		if c.Name == model.DEFAULT_CHANNEL {
			if _, err := Client.LeaveChannel(c.Id); err == nil {
				t.Fatal("should have errored on leaving default channel")
			}
			break
		}
	}
}
