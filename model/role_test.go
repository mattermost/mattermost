// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChannelModeratedPermissionsChangedByPatch(t *testing.T) {
	testCases := []struct {
		Name             string
		Permissions      []string
		PatchPermissions []string
		Expected         []string
	}{
		{
			"Empty patch returns empty slice",
			[]string{},
			[]string{},
			[]string{},
		},
		{
			"Adds permissions to empty initial permissions list",
			[]string{},
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_ADD_REACTION.Id},
			[]string{ChannelModeratedPermissions[0], ChannelModeratedPermissions[1]},
		},
		{
			"Ignores non moderated permissions in initial permissions list",
			[]string{PERMISSION_ASSIGN_BOT.Id},
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_REMOVE_REACTION.Id},
			[]string{ChannelModeratedPermissions[0], ChannelModeratedPermissions[1]},
		},
		{
			"Adds removed moderated permissions from initial permissions list",
			[]string{PERMISSION_CREATE_POST.Id},
			[]string{},
			[]string{PERMISSION_CREATE_POST.Id},
		},
		{
			"No changes returns empty slice",
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_ASSIGN_BOT.Id},
			[]string{PERMISSION_CREATE_POST.Id},
			[]string{},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			baseRole := &Role{Permissions: tc.Permissions}
			rolePatch := &RolePatch{Permissions: &tc.PatchPermissions}
			result := ChannelModeratedPermissionsChangedByPatch(baseRole, rolePatch)
			assert.ElementsMatch(t, tc.Expected, result)
		})
	}
}

func TestRolePatchFromChannelModerationsPatch(t *testing.T) {
	createPosts := ChannelModeratedPermissions[0]
	createReactions := ChannelModeratedPermissions[1]
	manageMembers := ChannelModeratedPermissions[2]
	channelMentions := ChannelModeratedPermissions[3]

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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
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
					Roles: &ChannelModeratedRolesPatch{Guests: NewBool(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
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
					Roles: &ChannelModeratedRolesPatch{Guests: NewBool(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Guests: NewBool(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Guests: NewBool(false)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
				},
				{
					Name:  &createPosts,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(false)},
				},
				{
					Name:  &createPosts,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
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

func TestGetChannelModeratedPermissions(t *testing.T) {
	tests := []struct {
		Name        string
		Permissions []string
		ChannelType string
		Expected    map[string]bool
	}{
		{
			"Filters non moderated permissions",
			[]string{PERMISSION_CREATE_BOT.Id},
			CHANNEL_OPEN,
			map[string]bool{},
		},
		{
			"Returns a map of moderated permissions",
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_ADD_REACTION.Id, PERMISSION_REMOVE_REACTION.Id, PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id, PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id, PERMISSION_USE_CHANNEL_MENTIONS.Id},
			CHANNEL_OPEN,
			map[string]bool{
				ChannelModeratedPermissions[0]: true,
				ChannelModeratedPermissions[1]: true,
				ChannelModeratedPermissions[2]: true,
				ChannelModeratedPermissions[3]: true,
			},
		},
		{
			"Returns a map of moderated permissions when non moderated present",
			[]string{PERMISSION_CREATE_POST.Id, PERMISSION_CREATE_DIRECT_CHANNEL.Id},
			CHANNEL_OPEN,
			map[string]bool{
				ChannelModeratedPermissions[0]: true,
			},
		},
		{
			"Returns a nothing when no permissions present",
			[]string{},
			CHANNEL_OPEN,
			map[string]bool{},
		},
	}
	for _, tc := range tests {
		t.Run(tc.Name, func(t *testing.T) {
			role := &Role{Permissions: tc.Permissions}
			moderatedPermissions := role.GetChannelModeratedPermissions(tc.ChannelType)
			for permission := range moderatedPermissions {
				assert.Equal(t, moderatedPermissions[permission], tc.Expected[permission])
			}
		})
	}
}
