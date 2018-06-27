// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"
	"github.com/mattermost/mattermost-server/model"
	"github.com/nicksnyder/go-i18n/i18n"
	"github.com/stretchr/testify/assert"
)

func TestJoinCommandNoChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if testing.Short() {
		t.SkipNow()
	}

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:      th.BasicTeam.Id,
	}, "asdsad")

	assert.Equal(t, "api.command_join.list.app_error", resp.Text)
}

func TestJoinCommandForExistingChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(&model.Channel{
	  DisplayName: "AA",
	  Name:        "aa" + model.NewId() + "a",
	  Type:        model.CHANNEL_OPEN,
	  TeamId:      th.BasicTeam.Id,
	  CreatorId:   th.BasicUser.Id,
	}, false)


	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:      th.BasicTeam.Id,
	}, channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandWithTilde(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(&model.Channel{
	  DisplayName: "AA",
	  Name:        "aa" + model.NewId() + "a",
	  Type:        model.CHANNEL_OPEN,
	  TeamId:      th.BasicTeam.Id,
	  CreatorId:   th.BasicUser.Id,
	}, false)


	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:      i18n.IdentityTfunc(),
		UserId: th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:      th.BasicTeam.Id,
	}, "~"+channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}
