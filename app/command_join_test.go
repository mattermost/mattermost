// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestJoinCommandNoChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if testing.Short() {
		t.SkipNow()
	}

	cmd := &JoinProvider{}
	resp := cmd.DoCommand(th.App, &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}, "asdsad")

	assert.Equal(t, "api.command_join.list.app_error", resp.Text)
}

func TestJoinCommandForExistingChannel(t *testing.T) {
	th := Setup(t).InitBasic()
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
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}, channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandWithTilde(t *testing.T) {
	th := Setup(t).InitBasic()
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
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}, "~"+channel2.Name)

	assert.Equal(t, "", resp.Text)
	assert.Equal(t, "http://test.url/"+th.BasicTeam.Name+"/channels/"+channel2.Name, resp.GotoLocation)
}

func TestJoinCommandPermissions(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	channel2, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "AA",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	cmd := &JoinProvider{}

	// Try a public channel *without* permission.
	args := &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: ""}}},
	}

	actual := cmd.DoCommand(th.App, args, "~"+channel2.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)

	// Try a public channel with permission.
	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = cmd.DoCommand(th.App, args, "~"+channel2.Name).Text
	assert.Equal(t, "", actual)

	// Try a private channel *without* permission.
	channel3, _ := th.App.CreateChannel(&model.Channel{
		DisplayName: "BB",
		Name:        "aa" + model.NewId() + "a",
		Type:        model.CHANNEL_PRIVATE,
		TeamId:      th.BasicTeam.Id,
		CreatorId:   th.BasicUser.Id,
	}, false)

	args = &model.CommandArgs{
		T:       i18n.IdentityTfunc(),
		UserId:  th.BasicUser2.Id,
		SiteURL: "http://test.url",
		TeamId:  th.BasicTeam.Id,
		Session: model.Session{UserId: th.BasicUser.Id, TeamMembers: []*model.TeamMember{{TeamId: th.BasicTeam.Id, Roles: model.TEAM_USER_ROLE_ID}}},
	}

	actual = cmd.DoCommand(th.App, args, "~"+channel3.Name).Text
	assert.Equal(t, "api.command_join.fail.app_error", actual)
}
