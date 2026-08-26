// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
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
		// The ordinary permissions still resolve exactly as before.
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
	}
}

func TestPluginChannelSchemeName(t *testing.T) {
	const pluginID = "com.example.docs"
	user := []string{PermissionReadPage.Id, PermissionCreatePage.Id}
	admin := []string{PermissionAdminSpace.Id}
	guest := []string{PermissionReadPage.Id}

	name := PluginChannelSchemeName(pluginID, user, admin, guest)

	t.Run("fits the name column and stays in the namespace", func(t *testing.T) {
		assert.LessOrEqual(t, len(name), SchemeNameMaxLength)
		assert.True(t, IsPluginChannelSchemeName(name))
		assert.Regexp(t, `^plugin_[0-9a-f]{16}_[0-9a-f]{16}$`, name)
	})

	t.Run("pools: order and duplicates do not change it", func(t *testing.T) {
		reordered := PluginChannelSchemeName(pluginID,
			[]string{PermissionCreatePage.Id, PermissionReadPage.Id, PermissionReadPage.Id}, admin, guest)
		assert.Equal(t, name, reordered)
	})

	t.Run("separates: a permission moved between roles is a different scheme", func(t *testing.T) {
		moved := PluginChannelSchemeName(pluginID,
			[]string{PermissionReadPage.Id},
			[]string{PermissionAdminSpace.Id, PermissionCreatePage.Id},
			guest)
		assert.NotEqual(t, name, moved)
	})

	t.Run("isolates: another plugin asking for the same sets gets its own", func(t *testing.T) {
		other := PluginChannelSchemeName("com.example.other", user, admin, guest)
		assert.NotEqual(t, name, other)
	})

	t.Run("an ordinary scheme name is not in the namespace", func(t *testing.T) {
		assert.False(t, IsPluginChannelSchemeName("some_customer_scheme"))
		assert.False(t, IsPluginChannelSchemeName(SchemeNameSpaceContribute))
	})

	// The guards protect every matching name from ordinary role and scheme writes. The prefix is a plain
	// string a customer may already have used, so only a name a digest pair could
	// have produced is claimed.
	t.Run("the prefix alone does not put a name in the namespace", func(t *testing.T) {
		for _, otherName := range []string{
			"plugin_",
			"plugin_com.example.docs",
			"plugin_incident_response",
			"plugin_" + strings.Repeat("a", 16), // one digest, no second half
			"plugin_" + strings.Repeat("a", 16) + "_" + strings.Repeat("a", 15), // second digest too short
			"plugin_" + strings.Repeat("a", 16) + "_" + strings.Repeat("a", 17), // too long
			"plugin_" + strings.Repeat("A", 16) + "_" + strings.Repeat("a", 16), // hex is emitted lowercase
			"plugin_" + strings.Repeat("g", 16) + "_" + strings.Repeat("a", 16), // outside the hex alphabet
			"prefix_plugin_" + strings.Repeat("a", 16) + "_" + strings.Repeat("a", 16),
		} {
			assert.False(t, IsPluginChannelSchemeName(otherName), "%q is not a plugin channel scheme name", otherName)
		}
	})
}

func TestIsChannelScopedPermissionID(t *testing.T) {
	for _, p := range SpaceChannelScopedPermissions {
		assert.True(t, IsChannelScopedPermissionID(p.Id), "space permission %q is channel-scoped", p.Id)
	}
	assert.True(t, IsChannelScopedPermissionID(PermissionCreatePost.Id))
	assert.False(t, IsChannelScopedPermissionID(PermissionManageSystem.Id))
	assert.False(t, IsChannelScopedPermissionID(PermissionViewTeam.Id))
	assert.False(t, IsChannelScopedPermissionID("not_a_permission"))
}
