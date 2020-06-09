// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestMsgProvider(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	team := th.CreateTeam()
	th.LinkUserToTeam(th.BasicUser, team)
	cmd := &msgProvider{}

	// Check without permission to create a DM channel.
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: "",
		},
	}, "@"+th.BasicUser2.Username+" hello")

	channelName := model.GetDMNameFromIds(th.BasicUser.Id, th.BasicUser2.Id)
	assert.Equal(t, "api.command_msg.permission.app_error", resp.Text)
	assert.Equal(t, "", resp.GotoLocation)

	// Check with permission to create a DM channel.
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: model.SYSTEM_USER_ROLE_ID,
		},
	}, "@"+th.BasicUser2.Username+" hello")

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+team.Name+"/channels/"+channelName, resp.GotoLocation)

	// Check without permission to post to an existing DM channel.
	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  team.Id,
		UserId:  th.BasicUser.Id,
		Session: model.Session{
			Roles: "",
		},
	}, "@"+th.BasicUser2.Username+" hello")

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+team.Name+"/channels/"+channelName, resp.GotoLocation)

	// Check that a guest user cannot message a user who is not in a channel/team with him
	guest := th.CreateGuest()
	user := th.CreateUser()

	th.LinkUserToTeam(user, team)
	th.LinkUserToTeam(guest, th.BasicTeam)
	th.AddUserToChannel(guest, th.BasicChannel)

	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		UserId:  guest.Id,
		Session: model.Session{
			Roles: model.SYSTEM_GUEST_ROLE_ID,
		},
	}, "@"+user.Username+" hello")

	assert.Equal(t, "api.command_msg.missing.app_error", resp.Text)
	assert.Equal(t, "", resp.GotoLocation)

	// Check that a guest user can message a user who is in a channel/team with him
	th.LinkUserToTeam(user, th.BasicTeam)
	th.AddUserToChannel(user, th.BasicChannel)

	resp = cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		UserId:  guest.Id,
		Session: model.Session{
			Roles: model.SYSTEM_GUEST_ROLE_ID,
		},
	}, "@"+user.Username+" hello")

	channelName = model.GetDMNameFromIds(guest.Id, user.Id)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channelName, resp.GotoLocation)
}
