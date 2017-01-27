// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestCheckIfRolesGrantPermission(t *testing.T) {
	Setup()

	cases := []struct {
		roles        []string
		permissionId string
		shouldGrant  bool
	}{
		{[]string{model.ROLE_SYSTEM_ADMIN.Id}, model.ROLE_SYSTEM_ADMIN.Permissions[0], true},
		{[]string{model.ROLE_SYSTEM_ADMIN.Id}, "non-existant-permission", false},
		{[]string{model.ROLE_CHANNEL_USER.Id}, model.ROLE_CHANNEL_USER.Permissions[0], true},
		{[]string{model.ROLE_CHANNEL_USER.Id}, model.PERMISSION_MANAGE_SYSTEM.Id, false},
		{[]string{model.ROLE_SYSTEM_ADMIN.Id, model.ROLE_CHANNEL_USER.Id}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.ROLE_CHANNEL_USER.Id, model.ROLE_SYSTEM_ADMIN.Id}, model.PERMISSION_MANAGE_SYSTEM.Id, true},
		{[]string{model.ROLE_TEAM_USER.Id, model.ROLE_TEAM_ADMIN.Id}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
		{[]string{model.ROLE_TEAM_ADMIN.Id, model.ROLE_TEAM_USER.Id}, model.PERMISSION_MANAGE_SLASH_COMMANDS.Id, true},
	}

	for testnum, testcase := range cases {
		if CheckIfRolesGrantPermission(testcase.roles, testcase.permissionId) != testcase.shouldGrant {
			t.Fatal("Failed test case ", testnum)
		}
	}

}
