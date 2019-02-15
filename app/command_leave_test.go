// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestLeaveProviderDoCommand(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	lp := LeaveProvider{}

	publicChannel, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	privateChannel, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	th.App.AddUserToTeam(th.BasicTeam.Id, th.BasicUser.Id, th.BasicUser.Id)
	th.App.AddUserToChannel(th.BasicUser, publicChannel)
	th.App.AddUserToChannel(th.BasicUser, privateChannel)

	args := &model.CommandArgs{
		T: func(s string, args ...interface{}) string { return s },
	}

	// Should error when no Channel ID in args
	actual := lp.DoCommand(th.App, args, "")
	assert.Equal(t, "api.command_leave.fail.app_error", actual.Text)
	assert.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, actual.ResponseType)

	// Should error when no Team ID in args
	args.ChannelId = publicChannel.Id
	actual = lp.DoCommand(th.App, args, "")
	assert.Equal(t, "api.command_leave.fail.app_error", actual.Text)
	assert.Equal(t, model.COMMAND_RESPONSE_TYPE_EPHEMERAL, actual.ResponseType)

	// Leave a public channel
	siteURL := "http://localhost:8065"
	args.TeamId = th.BasicTeam.Id
	args.SiteURL = siteURL
	actual = lp.DoCommand(th.App, args, "")
	assert.Equal(t, "", actual.Text)
	assert.Equal(t, siteURL+"/"+th.BasicTeam.Name+"/channels/"+model.DEFAULT_CHANNEL, actual.GotoLocation)
	assert.Equal(t, "", actual.ResponseType)

	time.Sleep(100 * time.Millisecond)

	member, err := th.App.GetChannelMember(publicChannel.Id, th.BasicUser.Id)
	if member == nil {
		t.Errorf("Expected member object, got nil")
	}

	if err != nil {
		t.Errorf("Expected nil object, got %s", err)
	}

	// Leave a private channel
	args.ChannelId = privateChannel.Id
	actual = lp.DoCommand(th.App, args, "")
	assert.Equal(t, "", actual.Text)

	// Should not leave a default channel
	defaultChannel, _ := th.App.GetChannelByName(model.DEFAULT_CHANNEL, th.BasicTeam.Id, false)
	args.ChannelId = defaultChannel.Id
	actual = lp.DoCommand(th.App, args, "")
	assert.Equal(t, "api.channel.leave.default.app_error", actual.Text)
}
