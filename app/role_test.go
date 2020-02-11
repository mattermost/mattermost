// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
)

func TestGetChannelModeratedPermissions(t *testing.T) {
	tests := []struct {
		Name        string
		Permissions []string
		Expected    map[string]bool
	}{
		{
			"Filters non moderated permissions",
			[]string{model.PERMISSION_CREATE_BOT.Id},
			map[string]bool{},
		},
		{
			"Returns a map of moderated permissions",
			[]string{model.PERMISSION_CREATE_POST.Id, model.PERMISSION_ADD_REACTION.Id, model.PERMISSION_REMOVE_REACTION.Id, model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id, model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id, model.PERMISSION_USE_CHANNEL_MENTIONS.Id},
			map[string]bool{
				model.CHANNEL_MODERATED_PERMISSIONS[0]: true,
				model.CHANNEL_MODERATED_PERMISSIONS[1]: true,
				model.CHANNEL_MODERATED_PERMISSIONS[2]: true,
				model.CHANNEL_MODERATED_PERMISSIONS[3]: true,
			},
		},
		{
			"Returns a map of moderated permissions when non moderated present",
			[]string{model.PERMISSION_CREATE_POST.Id, model.PERMISSION_CREATE_DIRECT_CHANNEL.Id},
			map[string]bool{
				model.CHANNEL_MODERATED_PERMISSIONS[0]: true,
			},
		},
		{
			"Returns a nothing when no permissions present",
			[]string{},
			map[string]bool{},
		},
	}
	for _, tc := range tests {
		t.Run(tc.Name, func(t *testing.T) {
			moderatedPermissions := GetChannelModeratedPermissions(tc.Permissions)
			for permission := range moderatedPermissions {
				assert.Equal(t, moderatedPermissions[permission], tc.Expected[permission])
			}
		})
	}
}
