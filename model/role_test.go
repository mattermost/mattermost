// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRolePatchFromChannelModerationsPatch(t *testing.T) {
	createPosts := CHANNEL_MODERATED_PERMISSIONS[PERMISSION_CREATE_POST.Id]
	createReactions := CHANNEL_MODERATED_PERMISSIONS[PERMISSION_ADD_REACTION.Id]
	channelMentions := CHANNEL_MODERATED_PERMISSIONS[PERMISSION_USE_CHANNEL_MENTIONS.Id]
	manageMembers := CHANNEL_MODERATED_PERMISSIONS[PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id]

	basePermissions := []string{
		PERMISSION_ADD_REACTION.Id,
		PERMISSION_REMOVE_REACTION.Id,
		PERMISSION_CREATE_POST.Id,
		PERMISSION_USE_CHANNEL_MENTIONS.Id,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
		PERMISSION_UPLOAD_FILE.Id,
		PERMISSION_GET_PUBLIC_LINK.Id,
		PERMISSION_USE_SLASH_COMMANDS.Id,
	}

	baseModeratedPermissions := []string{
		PERMISSION_ADD_REACTION.Id,
		PERMISSION_REMOVE_REACTION.Id,
		PERMISSION_CREATE_POST.Id,
		PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
		PERMISSION_USE_CHANNEL_MENTIONS.Id,
	}

	testCases := []struct {
		Name                     string
		Permissions              []string
		ChannelModerationsPatch  []*ChannelModerationPatch
		RoleName                 string
		ExpectedPatchPermissions []string
	}{
		{
			"Patch to member role adding a permission that already exists",
			basePermissions,
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": true},
				},
			},
			"members",
			baseModeratedPermissions,
		},
		{
			"Patch to member role with moderation patch for guest role",
			basePermissions,
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"guests": true},
				},
			},
			"members",
			baseModeratedPermissions,
		},
		{
			"Patch to guest role with moderation patch for member role",
			basePermissions,
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": true},
				},
			},
			"guests",
			baseModeratedPermissions,
		},
		{
			"Patch to member role removing multiple channel moderated permissions",
			basePermissions,
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": false},
				},
				{
					Name:  &manageMembers,
					Roles: map[string]bool{"members": false},
				},
				{
					Name:  &channelMentions,
					Roles: map[string]bool{"members": false},
				},
			},
			"members",
			[]string{PERMISSION_CREATE_POST.Id},
		},
		{
			"Patch to guest role removing multiple channel moderated permissions",
			basePermissions,
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"guests": false},
				},
				{
					Name:  &manageMembers,
					Roles: map[string]bool{"guests": false},
				},
				{
					Name:  &channelMentions,
					Roles: map[string]bool{"guests": false},
				},
			},
			"guests",
			[]string{PERMISSION_CREATE_POST.Id},
		},
		{
			"Patch enabling and removing multiple channel moderated permissions ",
			[]string{PERMISSION_ADD_REACTION.Id, PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id},
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": false},
				},
				{
					Name:  &manageMembers,
					Roles: map[string]bool{"members": false},
				},
				{
					Name:  &channelMentions,
					Roles: map[string]bool{"members": true},
				},
				{
					Name:  &createPosts,
					Roles: map[string]bool{"members": true},
				},
			},
			"members",
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_USE_CHANNEL_MENTIONS.Id},
		},
		{
			"Patch enabling a partially enabled permission",
			[]string{PERMISSION_ADD_REACTION.Id},
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": true},
				},
			},
			"members",
			[]string{PERMISSION_ADD_REACTION.Id, PERMISSION_REMOVE_REACTION.Id},
		},
		{
			"Patch disabling a partially disabled permission",
			[]string{PERMISSION_ADD_REACTION.Id},
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: map[string]bool{"members": false},
				},
				{
					Name:  &createPosts,
					Roles: map[string]bool{"members": true},
				},
			},
			"members",
			[]string{PERMISSION_CREATE_POST.Id},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			baseRole := &Role{Permissions: tc.Permissions}
			rolePatch := baseRole.RolePatchFromChannelModerationsPatch(tc.ChannelModerationsPatch, tc.RoleName)
			assert.ElementsMatch(t, tc.ExpectedPatchPermissions, *rolePatch.Permissions)
		})
	}
}
