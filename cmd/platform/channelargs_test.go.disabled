// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
)

func TestParseChannelArg(t *testing.T) {
	if team, channel := parseChannelArg("channel"); team != "" {
		t.Fatal("got incorrect team", team)
	} else if channel != "channel" {
		t.Fatal("got incorrect channel", channel)
	}

	if team, channel := parseChannelArg("team:channel"); team != "team" {
		t.Fatal("got incorrect team", team)
	} else if channel != "channel" {
		t.Fatal("got incorrect channel", channel)
	}
}

func TestGetChannelFromChannelArg(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.BasicTeam
	channel := th.BasicChannel

	if found := getChannelFromChannelArg(""); found != nil {
		t.Fatal("shoudn't have gotten a channel", found)
	}

	if found := getChannelFromChannelArg(channel.Id); found == nil || found.Id != channel.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelFromChannelArg(model.NewId()); found != nil {
		t.Fatal("shouldn't have gotten a channel that doesn't exist", found)
	}

	if found := getChannelFromChannelArg(channel.Name); found != nil {
		t.Fatal("shouldn't have gotten a channel by name without team", found)
	}

	if found := getChannelFromChannelArg(team.Id + ":" + channel.Name); found == nil || found.Id != channel.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelFromChannelArg(team.Name + ":" + channel.Name); found == nil || found.Id != channel.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelFromChannelArg(team.Name + ":" + channel.Id); found == nil || found.Id != channel.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelFromChannelArg("notateam" + ":" + channel.Name); found != nil {
		t.Fatal("shouldn't have gotten a channel by name on incorrect team", found)
	}

	if found := getChannelFromChannelArg(team.Name + ":" + "notachannel"); found != nil {
		t.Fatal("shouldn't have gotten a channel that doesn't exist", found)
	}
}

func TestGetChannelsFromChannelArg(t *testing.T) {
	th := app.Setup().InitBasic()

	team := th.BasicTeam
	channel := th.BasicChannel
	channel2 := th.CreateChannel(team)

	if found := getChannelsFromChannelArgs([]string{}); len(found) != 0 {
		t.Fatal("shoudn't have gotten any channels", found)
	}

	if found := getChannelsFromChannelArgs([]string{channel.Id}); len(found) == 1 && found[0].Id != channel.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelsFromChannelArgs([]string{team.Name + ":" + channel2.Name}); len(found) == 1 && found[0].Id != channel2.Id {
		t.Fatal("got incorrect channel", found)
	}

	if found := getChannelsFromChannelArgs([]string{team.Name + ":" + channel.Name, team.Name + ":" + channel2.Name}); len(found) != 2 {
		t.Fatal("got incorrect number of channels", found)
	} else if !(found[0].Id == channel.Id && found[1].Id == channel2.Id) && !(found[1].Id == channel.Id && found[0].Id == channel2.Id) {
		t.Fatal("got incorrect channels", found[0], found[1])
	}

	if found := getChannelsFromChannelArgs([]string{channel.Id, channel2.Id}); len(found) != 2 {
		t.Fatal("got incorrect number of channels", found)
	} else if !(found[0].Id == channel.Id && found[1].Id == channel2.Id) && !(found[1].Id == channel.Id && found[0].Id == channel2.Id) {
		t.Fatal("got incorrect channels", found[0], found[1])
	}

	if found := getChannelsFromChannelArgs([]string{channel.Id, team.Name + ":" + channel2.Name}); len(found) != 2 {
		t.Fatal("got incorrect number of channels", found)
	} else if !(found[0].Id == channel.Id && found[1].Id == channel2.Id) && !(found[1].Id == channel.Id && found[0].Id == channel2.Id) {
		t.Fatal("got incorrect channels", found[0], found[1])
	}
}
