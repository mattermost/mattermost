// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSpaceChannelScopedPermissions(t *testing.T) {
	require.Len(t, SpaceChannelScopedPermissions, 7)

	for _, p := range SpaceChannelScopedPermissions {
		assert.Equal(t, PermissionScopeChannel, p.Scope, "space permission %q must be channel-scoped", p.Id)
		assert.True(t, IsSpaceChannelScopedPermissionID(p.Id))
		assert.NotContains(t, ChannelModeratedPermissionsMap, p.Id, "space permission %q must not be moderated", p.Id)
	}

	assert.False(t, IsSpaceChannelScopedPermissionID(PermissionReadSpace.Id))
	assert.False(t, IsSpaceChannelScopedPermissionID(PermissionCreatePost.Id))

	// Every space capability role slice is self-contained: read_page plus a
	// subset of the seven.
	slices := [][]*Permission{
		SpaceAdminRolePermissions,
		SpaceDefaultContributePermissions,
		SpaceDefaultCommentPermissions,
		SpaceDefaultReadOnlyPermissions,
	}
	for _, perms := range SpaceCapabilityRolePermissions {
		slices = append(slices, perms)
	}
	for _, slice := range slices {
		require.NotEmpty(t, slice)
		assert.Equal(t, PermissionReadPage.Id, slice[0].Id, "read_page is the baseline of every capability slice")
		for _, p := range slice {
			assert.True(t, IsSpaceChannelScopedPermissionID(p.Id))
		}
	}
}

// TestSpacePermissionsNotOnTeamOrSystemRoles mechanizes the scope invariant:
// no channel-scoped space permission may appear on any team- or system-scoped
// built-in role (system_admin excepted) nor on the global channel roles. The
// space capability roles are excluded by name — they must carry them.
func TestSpacePermissionsNotOnTeamOrSystemRoles(t *testing.T) {
	capabilityRoleNames := map[string]bool{
		SpacePageCreatorRoleId:    true,
		SpacePageCommenterRoleId:  true,
		SpacePageEditorRoleId:     true,
		SpacePageDeleterOwnRoleId: true,
		SpacePageDeleterRoleId:    true,
	}

	// Role has no scope field, so classify by name.
	globalChannelRoleNames := map[string]bool{
		ChannelGuestRoleId: true,
		ChannelUserRoleId:  true,
		ChannelAdminRoleId: true,
	}

	for name, role := range MakeDefaultRoles() {
		if name == SystemAdminRoleId || capabilityRoleNames[name] {
			continue
		}
		mustBeClean := globalChannelRoleNames[name] || IsBuiltInRole(name)
		if !mustBeClean {
			continue
		}
		for _, p := range role.Permissions {
			assert.False(t, IsSpaceChannelScopedPermissionID(p),
				"role %q must not carry channel-scoped space permission %q", name, p)
		}
	}
}

func TestMergeChannelHigherScopedPermissionsSpaceExemption(t *testing.T) {
	t.Run("space perm on own set survives without higher-scope presence", func(t *testing.T) {
		role := &Role{Permissions: []string{PermissionReadPage.Id, PermissionEditPage.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelUserRoleId, Permissions: []string{}})
		assert.Contains(t, role.Permissions, PermissionReadPage.Id)
		assert.Contains(t, role.Permissions, PermissionEditPage.Id)
	})

	t.Run("space perm on admin-branch role survives too", func(t *testing.T) {
		role := &Role{Permissions: []string{PermissionAdminSpace.Id, PermissionDeletePage.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelAdminRoleId, Permissions: []string{}})
		assert.Contains(t, role.Permissions, PermissionAdminSpace.Id)
		assert.Contains(t, role.Permissions, PermissionDeletePage.Id)
	})

	t.Run("downward propagation from the higher scope is left intact", func(t *testing.T) {
		role := &Role{Permissions: []string{}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelUserRoleId, Permissions: []string{PermissionReadPage.Id}})
		assert.Contains(t, role.Permissions, PermissionReadPage.Id)
	})

	t.Run("non-space non-moderated perm still loses to the ceiling", func(t *testing.T) {
		role := &Role{Permissions: []string{PermissionEditPost.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelUserRoleId, Permissions: []string{}})
		assert.NotContains(t, role.Permissions, PermissionEditPost.Id)
	})

	// The exemption is keyed on the permission, not the owning scheme, so the
	// property that keeps it safe for ordinary channels is that a role with no
	// space permission can never gain one here.
	t.Run("a role carrying no space permission gains none", func(t *testing.T) {
		role := &Role{Permissions: []string{PermissionEditPost.Id, PermissionCreatePost.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{
			RoleID:      ChannelUserRoleId,
			Permissions: []string{PermissionEditPost.Id, PermissionCreatePost.Id},
		})
		for _, p := range SpaceChannelScopedPermissions {
			assert.NotContains(t, role.Permissions, p.Id,
				"resolution must not inject %q into a role that never stored it", p.Id)
		}
		// The ordinary permissions still resolve normally, unaffected by the exemption.
		assert.Contains(t, role.Permissions, PermissionEditPost.Id)
		assert.Contains(t, role.Permissions, PermissionCreatePost.Id)
	})

	t.Run("moderated perm behavior untouched", func(t *testing.T) {
		// Moderated perms require presence on both the role and the higher scope.
		role := &Role{Permissions: []string{PermissionCreatePost.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelUserRoleId, Permissions: []string{}})
		assert.NotContains(t, role.Permissions, PermissionCreatePost.Id)

		role = &Role{Permissions: []string{PermissionCreatePost.Id}}
		role.MergeChannelHigherScopedPermissions(&RolePermissions{RoleID: ChannelUserRoleId, Permissions: []string{PermissionCreatePost.Id}})
		assert.Contains(t, role.Permissions, PermissionCreatePost.Id)
	})
}

func TestMakeDefaultRolesSpaceEntries(t *testing.T) {
	roles := MakeDefaultRoles()

	require.Len(t, SpaceCapabilityRolePermissions, len(SpaceCapabilityRoles))
	for name, perms := range SpaceCapabilityRolePermissions {
		role, ok := roles[name]
		require.True(t, ok, "MakeDefaultRoles must define %q", name)
		assert.Equal(t, PermissionIDs(perms), role.Permissions)
		assert.False(t, role.SchemeManaged, "%q must not be scheme-managed", name)
		assert.True(t, role.BuiltIn)
		// Deliberately NOT in the built-in scheme-managed list: membership
		// there would make UpdateChannelMemberRoles reject ExplicitRoles
		// assignments of these roles.
		assert.False(t, IsBuiltInRole(name))
		assert.True(t, IsValidRoleName(name))
	}

	// Team-scoped lifecycle grants for fresh installs.
	assert.Contains(t, roles[TeamGuestRoleId].Permissions, PermissionReadSpace.Id)
	assert.Contains(t, roles[TeamUserRoleId].Permissions, PermissionReadSpace.Id)
	assert.Contains(t, roles[TeamUserRoleId].Permissions, PermissionCreateSpace.Id)
	assert.Contains(t, roles[TeamAdminRoleId].Permissions, PermissionManageSpace.Id)
	assert.Contains(t, roles[TeamAdminRoleId].Permissions, PermissionDeleteSpace.Id)

	// system_admin gets everything via the AllPermissions loop on fresh installs.
	for _, p := range SpaceChannelScopedPermissions {
		assert.Contains(t, roles[SystemAdminRoleId].Permissions, p.Id)
	}
}

func TestIsSpaceSchemeName(t *testing.T) {
	assert.True(t, IsSpaceSchemeName(SchemeNameSpaceContribute))
	assert.True(t, IsSpaceSchemeName(SchemeNameSpaceComment))
	assert.True(t, IsSpaceSchemeName(SchemeNameSpaceReadOnly))
	assert.False(t, IsSpaceSchemeName("contribute"))
	assert.False(t, IsSpaceSchemeName("docs_space_"))
	assert.False(t, IsSpaceSchemeName(SchemeNameSpaceContribute+"_x"))
	assert.False(t, IsSpaceSchemeName(NewId()))
}

func TestSpacePermissionPresets(t *testing.T) {
	presets := SpacePermissionPresets()
	require.Len(t, presets, 3)

	names := make([]string, 0, len(presets))
	for _, preset := range presets {
		names = append(names, preset.SchemeName)
		assert.True(t, IsSpaceSchemeName(preset.SchemeName))
		assert.NotEmpty(t, preset.DisplayName)
		require.NotEmpty(t, preset.Permissions)
		assert.Equal(t, PermissionReadPage.Id, preset.Permissions[0].Id)
	}
	assert.Equal(t, SpaceSchemeNames, names)

	// Callers receive independent slices, not aliases of the canonical registry.
	presets[0].SchemeName = "changed"
	presets[0].Permissions[0] = PermissionCreatePost
	again := SpacePermissionPresets()
	assert.Equal(t, SchemeNameSpaceContribute, again[0].SchemeName)
	assert.Equal(t, PermissionReadPage, again[0].Permissions[0])
}

// TestSpaceSlicesMatchCanonicalSet pins the hand-written preset baselines against
// the canonical set. The capability slices are derived from it, so they need no
// pinning; the admin slice is the whole set by construction.
func TestSpaceSlicesMatchCanonicalSet(t *testing.T) {
	canonical := make(map[string]bool, len(SpaceChannelScopedPermissions))
	for _, p := range SpaceChannelScopedPermissions {
		canonical[p.Id] = true
	}

	for name, slice := range map[string][]*Permission{
		"SpaceDefaultContributePermissions": SpaceDefaultContributePermissions,
		"SpaceDefaultCommentPermissions":    SpaceDefaultCommentPermissions,
		"SpaceDefaultReadOnlyPermissions":   SpaceDefaultReadOnlyPermissions,
	} {
		for _, p := range slice {
			assert.True(t, canonical[p.Id], "%s carries %q, which is not in SpaceChannelScopedPermissions", name, p.Id)
		}
	}

	// The admin role contains the complete space permission set.
	assert.ElementsMatch(t, PermissionIDs(SpaceChannelScopedPermissions), PermissionIDs(SpaceAdminRolePermissions),
		"SpaceAdminRolePermissions must cover every channel-scoped space permission")

	// Each capability role is read_page plus exactly one further capability.
	for roleID, perms := range SpaceCapabilityRolePermissions {
		require.Len(t, perms, 2, "%s must be read_page plus one capability", roleID)
		assert.Equal(t, PermissionReadPage.Id, perms[0].Id, "%s must lead with read_page", roleID)
		assert.True(t, canonical[perms[1].Id], "%s carries %q, which is not in SpaceChannelScopedPermissions", roleID, perms[1].Id)
	}
}

func TestIsSpaceCapabilityRole(t *testing.T) {
	require.Len(t, SpaceCapabilityRoles, 5)
	for _, name := range SpaceCapabilityRoles {
		assert.True(t, IsSpaceCapabilityRole(name), "role %q", name)
		// The capability roles are deliberately absent from
		// BuiltInSchemeManagedRoleIDs so they stay assignable via ExplicitRoles.
		assert.False(t, IsBuiltInRole(name), "role %q", name)
	}

	assert.False(t, IsSpaceCapabilityRole(ChannelUserRoleId))
	assert.False(t, IsSpaceCapabilityRole(SystemAdminRoleId))
	assert.False(t, IsSpaceCapabilityRole(""))
	assert.False(t, IsSpaceCapabilityRole(NewId()))

	// The registry and MakeDefaultRoles must not drift apart: the seeding
	// migration reads the canonical definition for every id listed here.
	roles := MakeDefaultRoles()
	for _, name := range SpaceCapabilityRoles {
		_, ok := roles[name]
		assert.True(t, ok, "MakeDefaultRoles must define %q", name)

		permission, ok := SpaceCapabilityPermissionForRole(name)
		require.True(t, ok, "role %q must have a canonical capability", name)
		mappedRole, ok := SpaceCapabilityRoleForPermission(permission.Id)
		require.True(t, ok, "permission %q must map back to a capability role", permission.Id)
		assert.Equal(t, name, mappedRole)
	}

	_, ok := SpaceCapabilityPermissionForRole(ChannelUserRoleId)
	assert.False(t, ok)
	_, ok = SpaceCapabilityRoleForPermission(PermissionReadPage.Id)
	assert.False(t, ok)
}
