// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/nicksnyder/go-i18n/i18n"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestMsgProvider(t *testing.T) {
	th := Setup().InitBasic()
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
}
