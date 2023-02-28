// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/shared/i18n"
)

func TestJoinCommandNoChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, "asdsad")

	assert.Equal(t, "api.command_join.list.app_error", resp.Text)
}

func TestJoinCommandForExistingChannel(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandWithTilde(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	if testing.Short() {
		t.SkipNow()
	}

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, th.Context, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}, "~"+channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandPermissions(t *testing.T) {
	th := setup(t).initBasic()
	defer th.tearDown()

	channel2, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypeOpen,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}

	user3 := th.createUser()

	// Try a public channel *without* permission.
	args := &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  user3.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual := cmd.DoCommand(th.App, th.Context, args, "~"+channel2.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)

	// Try a public channel with permission.
	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual = cmd.DoCommand(th.App, th.Context, args, "~"+channel2.Name).Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	channel3, _ := th.App.CreateChannel(th.Context, &model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.ChannelTypePrivate,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
	}

	actual = cmd.DoCommand(th.App, th.Context, args, "~"+channel3.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)
}
