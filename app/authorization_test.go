// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/stretchr/testify/assert"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestCheckIfRolesGrantPermission(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cases := []struct {
		roles        []string
		permissionId string
		shouldGrant  bool
	}{
		{[]string{model.SYSTEM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.SYSTEM_ADMIN_ROLE_ID}, "non-existent-permission", false},
		{[]string{model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_READ_CHANNEL.Id, true},
		{[]string{model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, false},
		{[]string{model.SYSTEM_ADMIN_ROLE_ID, model.CHANNEL_USER_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.CHANNEL_USER_ROLE_ID, model.SYSTEM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.TEAM_USER_ROLE_ID, model.TEAM_ADMIN_ROLE_ID}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
		{[]string{model.TEAM_ADMIN_ROLE_ID, model.TEAM_USER_ROLE_ID}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
	}

	for _, testcase := range cases {
		assert.Equal(t, th.App.RolesGrantPermission(testcase.roles, testcase.permissionId), testcase.shouldGrant)
	}

}
