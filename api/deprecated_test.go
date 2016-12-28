// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestGetMoreChannel(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam

	channel1 := &model.Channel{DisplayName: "A Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	channel2 := &model.Channel{DisplayName: "B Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel2 = Client.Must(Client.CreateChannel(channel2)).Data.(*model.Channel)

	th.LoginBasic2()

	rget := Client.Must(Client.GetMoreChannels(""))
	channels := rget.Data.(*model.ChannelList)

	if (*channels)[0].DisplayName != channel1.DisplayName {
		t.Fatal("full name didn't match")
	}

	if (*channels)[1].DisplayName != channel2.DisplayName {
		t.Fatal("full name didn't match")
	}

	// test etag caching
	if cache_result, err := Client.GetMoreChannels(rget.Etag); err != nil {
		t.Fatal(err)
	} else if cache_result.Data.(*model.ChannelList) != nil {
		t.Log(cache_result.Data)
		t.Fatal("cache should be empty")
	}
}

/*
func TestSetActiveChannel(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient

	if _, err := Client.SetActiveChannel(th.BasicChannel.Id); err != nil {
		t.Fatal(err)
	}

	status, _ := GetStatus(th.BasicUser.Id)
	if status.ActiveChannel != th.BasicChannel.Id {
		t.Fatal("active channel should be set")
	}

	if _, err := Client.SetActiveChannel(""); err != nil {
		t.Fatal(err)
	}

	status, _ = GetStatus(th.BasicUser.Id)
	if status.ActiveChannel != "" {
		t.Fatal("active channel should be blank")
	}

	if _, err := Client.SetActiveChannel("123456789012345678901234567890"); err == nil {
		t.Fatal("should have failed, id too long")
	}

	if _, err := Client.UpdateLastViewedAt(th.BasicChannel.Id, true); err != nil {
		t.Fatal(err)
	}

	time.Sleep(500 * time.Millisecond)

	status, _ = GetStatus(th.BasicUser.Id)
	 need to check if offline to catch race
	if status.Status != model.STATUS_OFFLINE && status.ActiveChannel != th.BasicChannel.Id {
		t.Fatal("active channel should be set")
	}
}
*/
