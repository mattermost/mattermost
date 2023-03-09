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
			[]string{PermissionCreatePost.Id, PermissionAddReaction.Id},
			[]string{ChannelModeratedPermissions[0], ChannelModeratedPermissions[1]},
		},
		{
			"Ignores non moderated permissions in initial permissions list",
			[]string{PermissionAssignBot.Id},
			[]string{PermissionCreatePost.Id, PermissionRemoveReaction.Id},
			[]string{ChannelModeratedPermissions[0], ChannelModeratedPermissions[1]},
		},
		{
			"Adds removed moderated permissions from initial permissions list",
			[]string{PermissionCreatePost.Id},
			[]string{},
			[]string{PermissionCreatePost.Id},
		},
		{
			"No changes returns empty slice",
			[]string{PermissionCreatePost.Id, PermissionAssignBot.Id},
			[]string{PermissionCreatePost.Id},
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
		PermissionAddReaction.Id,
		PermissionRemoveReaction.Id,
		PermissionCreatePost.Id,
		PermissionUseChannelMentions.Id,
		PermissionManagePublicChannelMembers.Id,
		PermissionUploadFile.Id,
		PermissionGetPublicLink.Id,
		PermissionUseSlashCommands.Id,
	}

	baseModeratedPermissions := []string{
		PermissionAddReaction.Id,
		PermissionRemoveReaction.Id,
		PermissionCreatePost.Id,
		PermissionManagePublicChannelMembers.Id,
		PermissionUseChannelMentions.Id,
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
			[]string{PermissionCreatePost.Id},
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
			[]string{PermissionCreatePost.Id},
		},
		{
			"Patch enabling and removing multiple channel moderated permissions ",
			[]string{PermissionAddReaction.Id, PermissionManagePublicChannelMembers.Id},
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
			[]string{PermissionCreatePost.Id, PermissionUseChannelMentions.Id},
		},
		{
			"Patch enabling a partially enabled permission",
			[]string{PermissionAddReaction.Id},
			[]*ChannelModerationPatch{
				{
					Name:  &createReactions,
					Roles: &ChannelModeratedRolesPatch{Members: NewBool(true)},
				},
			},
			"members",
			[]string{PermissionAddReaction.Id, PermissionRemoveReaction.Id},
		},
		{
			"Patch disabling a partially disabled permission",
			[]string{PermissionAddReaction.Id},
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
			[]string{PermissionCreatePost.Id},
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
		ChannelType ChannelType
		Expected    map[string]bool
	}{
		{
			"Filters non moderated permissions",
			[]string{PermissionCreateBot.Id},
			ChannelTypeOpen,
			map[string]bool{},
		},
		{
			"Returns a map of moderated permissions",
			[]string{PermissionCreatePost.Id, PermissionAddReaction.Id, PermissionRemoveReaction.Id, PermissionManagePublicChannelMembers.Id, PermissionManagePrivateChannelMembers.Id, PermissionUseChannelMentions.Id},
			ChannelTypeOpen,
			map[string]bool{
				ChannelModeratedPermissions[0]: true,
				ChannelModeratedPermissions[1]: true,
				ChannelModeratedPermissions[2]: true,
				ChannelModeratedPermissions[3]: true,
			},
		},
		{
			"Returns a map of moderated permissions when non moderated present",
			[]string{PermissionCreatePost.Id, PermissionCreateDirectChannel.Id},
			ChannelTypeOpen,
			map[string]bool{
				ChannelModeratedPermissions[0]: true,
			},
		},
		{
			"Returns a nothing when no permissions present",
			[]string{},
			ChannelTypeOpen,
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
