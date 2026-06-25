// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
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
					Roles: &ChannelModeratedRolesPatch{Guests: NewPointer(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
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
					Roles: &ChannelModeratedRolesPatch{Guests: NewPointer(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Guests: NewPointer(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Guests: NewPointer(false)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
				},
				{
					Name:  &manageMembers,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
				},
				{
					Name:  &channelMentions,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
				},
				{
					Name:  &createPosts,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
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
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(false)},
				},
				{
					Name:  &createPosts,
					Roles: &ChannelModeratedRolesPatch{Members: NewPointer(true)},
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

func TestAddAncillaryPermissions(t *testing.T) {
	tests := []struct {
		Name        string
		Permissions []string
		Expected    []string
	}{
		{
			"Add For ReadUserManagementUsers",
			[]string{PermissionSysconsoleReadUserManagementUsers.Id},
			[]string{PermissionSysconsoleReadUserManagementUsers.Id, PermissionReadOtherUsersTeams.Id},
		},
		{
			"Add For ReadCompliance",
			[]string{PermissionSysconsoleReadComplianceComplianceMonitoring.Id},
			[]string{PermissionSysconsoleReadComplianceComplianceMonitoring.Id, PermissionReadAudits.Id},
		},
		{
			"Add None",
			[]string{PermissionSysconsoleReadComplianceCustomTermsOfService.Id},
			[]string{PermissionSysconsoleReadComplianceCustomTermsOfService.Id},
		},
	}
	for _, tc := range tests {
		t.Run(tc.Name, func(t *testing.T) {
			permissions := AddAncillaryPermissions(tc.Permissions)
			assert.Equal(t, permissions, tc.Expected)
		})
	}
}

func TestMakeDefaultRolesContainsNewManagerRoles(t *testing.T) {
	roles := MakeDefaultRoles()

	t.Run("system_shared_channel_manager role exists with correct permissions", func(t *testing.T) {
		role, ok := roles[SharedChannelManagerRoleId]
		require.True(t, ok, "system_shared_channel_manager role should exist in MakeDefaultRoles")
		assert.Equal(t, "system_shared_channel_manager", role.Name)
		assert.True(t, role.BuiltIn, "role should be built-in")
		assert.False(t, role.SchemeManaged, "role should not be scheme-managed")
		assert.True(t, slices.Contains(role.Permissions, PermissionManageSharedChannels.Id),
			"role should have manage_shared_channels permission")
		assert.False(t, slices.Contains(role.Permissions, PermissionManageSecureConnections.Id),
			"role should NOT have manage_secure_connections permission")
	})

	t.Run("roles are included in NewSystemRoleIDs", func(t *testing.T) {
		assert.True(t, slices.Contains(NewSystemRoleIDs, SharedChannelManagerRoleId),
			"system_shared_channel_manager should be in NewSystemRoleIDs")
	})

	t.Run("system_admin includes manage_oauth by default", func(t *testing.T) {
		role, ok := roles[SystemAdminRoleId]
		require.True(t, ok, "system_admin role should exist in MakeDefaultRoles")
		assert.True(t, slices.Contains(role.Permissions, PermissionManageOAuth.Id),
			"system_admin should include manage_oauth")
		assert.True(t, slices.ContainsFunc(AllPermissions, func(permission *Permission) bool {
			return permission.Id == PermissionManageOAuth.Id
		}), "manage_oauth should be part of AllPermissions")
		assert.False(t, slices.ContainsFunc(DeprecatedPermissions, func(permission *Permission) bool {
			return permission.Id == PermissionManageOAuth.Id
		}), "manage_oauth should not remain deprecated")
	})
}

func TestIsValidChannelMemberRoles(t *testing.T) {
	tests := []struct {
		name  string
		roles string
		valid bool
	}{
		{name: "channel user only", roles: ChannelUserRoleId, valid: true},
		{name: "channel user and admin", roles: ChannelUserRoleId + " " + ChannelAdminRoleId, valid: true},
		{name: "channel guest only", roles: ChannelGuestRoleId, valid: true},
		{name: "custom role with channel user", roles: ChannelUserRoleId + " custom_role", valid: true},
		{name: "prefixed custom team role with channel user", roles: ChannelUserRoleId + " team_custom", valid: true},
		{name: "prefixed custom system role with channel user", roles: ChannelUserRoleId + " system_custom", valid: true},
		{name: "team user with channel user", roles: ChannelUserRoleId + " " + TeamUserRoleId, valid: false},
		{name: "team post all with channel user", roles: ChannelUserRoleId + " " + TeamPostAllRoleId, valid: false},
		{name: "system user with channel user", roles: ChannelUserRoleId + " " + SystemUserRoleId, valid: false},
		{name: "system manager with channel user", roles: ChannelUserRoleId + " " + SystemManagerRoleId, valid: false},
		{name: "system post all with channel user", roles: ChannelUserRoleId + " " + SystemPostAllRoleId, valid: false},
		{name: "system read only admin with channel user", roles: ChannelUserRoleId + " " + SystemReadOnlyAdminRoleId, valid: false},
		{name: "custom group user with channel user", roles: ChannelUserRoleId + " " + CustomGroupUserRoleId, valid: false},
		{name: "system custom group admin with channel user", roles: ChannelUserRoleId + " " + SystemCustomGroupAdminRoleId, valid: false},
		{name: "invalid role name", roles: "invalid-role", valid: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.valid, IsValidChannelMemberRoles(tc.roles))
		})
	}
}

func TestIsBuiltInRole(t *testing.T) {
	tests := []struct {
		name     string
		roleName string
		builtIn  bool
	}{
		{name: "channel user", roleName: ChannelUserRoleId, builtIn: true},
		{name: "system manager", roleName: SystemManagerRoleId, builtIn: true},
		{name: "system custom group admin", roleName: SystemCustomGroupAdminRoleId, builtIn: true},
		// custom_group_user is built-in even though its role.BuiltIn flag is false.
		{name: "custom group user", roleName: CustomGroupUserRoleId, builtIn: true},
		{name: "custom role", roleName: "custom_role", builtIn: false},
		{name: "prefixed custom system role", roleName: "system_custom", builtIn: false},
		{name: "empty", roleName: "", builtIn: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.builtIn, IsBuiltInRole(tc.roleName))
		})
	}
}
