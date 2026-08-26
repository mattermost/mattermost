// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "slices"

// Space (docs) permissions. The page-operation permissions and admin_space are
// channel-scoped and resolve on a space's backing channel; the space-lifecycle
// permissions are team-scoped.
var PermissionCreatePage *Permission
var PermissionReadPage *Permission
var PermissionEditPage *Permission
var PermissionDeleteOwnPage *Permission
var PermissionDeletePage *Permission
var PermissionCommentPage *Permission
var PermissionAdminSpace *Permission
var PermissionReadSpace *Permission
var PermissionCreateSpace *Permission
var PermissionManageSpace *Permission
var PermissionDeleteSpace *Permission

// SpaceChannelScopedPermissions is the canonical membership set of the seven
// channel-scoped space permissions. The role-write scope guard, the higher-scope
// merge exemption and the permissions migration all decide "is this a space
// permission" through it.
var SpaceChannelScopedPermissions []*Permission

var spaceTeamScopedPermissions []*Permission
var spaceChannelScopedPermissionIDs map[string]bool

// IsSpaceChannelScopedPermissionID reports whether id is one of the seven
// channel-scoped space permissions in SpaceChannelScopedPermissions.
func IsSpaceChannelScopedPermissionID(id string) bool {
	return spaceChannelScopedPermissionIDs[id]
}

// SpaceCapabilityRolePermissions maps each space capability role to what it
// grants. A capability role is self-contained: read_page plus its one capability.
var SpaceCapabilityRolePermissions map[string][]*Permission

// spaceCapabilityRolePermissions builds the grant of a single capability role.
func spaceCapabilityRolePermissions(capability *Permission) []*Permission {
	return []*Permission{PermissionReadPage, capability}
}

// SpaceAdminRolePermissions contains every channel-scoped space permission granted
// to SchemeAdmin.
var SpaceAdminRolePermissions []*Permission

// The all-members baselines the seeded preset schemes grant.
var SpaceDefaultContributePermissions []*Permission
var SpaceDefaultCommentPermissions []*Permission
var SpaceDefaultReadOnlyPermissions []*Permission

func initializeSpacePermissions() {
	PermissionCreatePage = &Permission{
		"create_page",
		"authentication.permissions.create_page.name",
		"authentication.permissions.create_page.description",
		PermissionScopeChannel,
	}
	PermissionReadPage = &Permission{
		"read_page",
		"authentication.permissions.read_page.name",
		"authentication.permissions.read_page.description",
		PermissionScopeChannel,
	}
	PermissionEditPage = &Permission{
		"edit_page",
		"authentication.permissions.edit_page.name",
		"authentication.permissions.edit_page.description",
		PermissionScopeChannel,
	}
	PermissionDeleteOwnPage = &Permission{
		"delete_own_page",
		"authentication.permissions.delete_own_page.name",
		"authentication.permissions.delete_own_page.description",
		PermissionScopeChannel,
	}
	PermissionDeletePage = &Permission{
		"delete_page",
		"authentication.permissions.delete_page.name",
		"authentication.permissions.delete_page.description",
		PermissionScopeChannel,
	}
	PermissionCommentPage = &Permission{
		"comment_page",
		"authentication.permissions.comment_page.name",
		"authentication.permissions.comment_page.description",
		PermissionScopeChannel,
	}
	PermissionAdminSpace = &Permission{
		"admin_space",
		"authentication.permissions.admin_space.name",
		"authentication.permissions.admin_space.description",
		PermissionScopeChannel,
	}
	PermissionReadSpace = &Permission{
		"read_space",
		"authentication.permissions.read_space.name",
		"authentication.permissions.read_space.description",
		PermissionScopeTeam,
	}
	PermissionCreateSpace = &Permission{
		"create_space",
		"authentication.permissions.create_space.name",
		"authentication.permissions.create_space.description",
		PermissionScopeTeam,
	}
	PermissionManageSpace = &Permission{
		"manage_space",
		"authentication.permissions.manage_space.name",
		"authentication.permissions.manage_space.description",
		PermissionScopeTeam,
	}
	PermissionDeleteSpace = &Permission{
		"delete_space",
		"authentication.permissions.delete_space.name",
		"authentication.permissions.delete_space.description",
		PermissionScopeTeam,
	}

	SpaceChannelScopedPermissions = []*Permission{
		PermissionReadPage,
		PermissionCreatePage,
		PermissionCommentPage,
		PermissionEditPage,
		PermissionDeleteOwnPage,
		PermissionDeletePage,
		PermissionAdminSpace,
	}
	spaceTeamScopedPermissions = []*Permission{
		PermissionReadSpace,
		PermissionCreateSpace,
		PermissionManageSpace,
		PermissionDeleteSpace,
	}

	spaceChannelScopedPermissionIDs = make(map[string]bool, len(SpaceChannelScopedPermissions))
	for _, p := range SpaceChannelScopedPermissions {
		spaceChannelScopedPermissionIDs[p.Id] = true
	}

	SpaceCapabilityRolePermissions = map[string][]*Permission{
		SpacePageCreatorRoleId:    spaceCapabilityRolePermissions(PermissionCreatePage),
		SpacePageCommenterRoleId:  spaceCapabilityRolePermissions(PermissionCommentPage),
		SpacePageEditorRoleId:     spaceCapabilityRolePermissions(PermissionEditPage),
		SpacePageDeleterOwnRoleId: spaceCapabilityRolePermissions(PermissionDeleteOwnPage),
		SpacePageDeleterRoleId:    spaceCapabilityRolePermissions(PermissionDeletePage),
	}
	SpaceAdminRolePermissions = slices.Clone(SpaceChannelScopedPermissions)
	SpaceDefaultContributePermissions = []*Permission{
		PermissionReadPage,
		PermissionCommentPage,
		PermissionCreatePage,
		PermissionEditPage,
		PermissionDeleteOwnPage,
	}
	SpaceDefaultCommentPermissions = []*Permission{
		PermissionReadPage,
		PermissionCommentPage,
	}
	SpaceDefaultReadOnlyPermissions = []*Permission{
		PermissionReadPage,
	}
}
