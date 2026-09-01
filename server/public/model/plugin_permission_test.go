// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginPermissionId(t *testing.T) {
	id := PluginPermissionId("com.mattermost.boards", "manage_board")
	assert.Equal(t, "com.mattermost.boards:manage_board", id)

	pluginID, localID, ok := SplitPluginPermissionId(id)
	require.True(t, ok)
	assert.Equal(t, "com.mattermost.boards", pluginID)
	assert.Equal(t, "manage_board", localID)

	_, _, ok = SplitPluginPermissionId("manage_system")
	assert.False(t, ok)

	_, _, ok = SplitPluginPermissionId("com.mattermost.boards:Manage_Board")
	assert.False(t, ok)
}

func TestIsValidPluginPermissionLocalID(t *testing.T) {
	assert.True(t, IsValidPluginPermissionLocalID("manage_board"))
	assert.True(t, IsValidPluginPermissionLocalID("view"))
	assert.False(t, IsValidPluginPermissionLocalID(""))
	assert.False(t, IsValidPluginPermissionLocalID("Manage_Board"))
	assert.False(t, IsValidPluginPermissionLocalID("_leading"))
	assert.False(t, IsValidPluginPermissionLocalID("trailing_"))
	assert.False(t, IsValidPluginPermissionLocalID("double__underscore"))
}

func TestPluginRoleName(t *testing.T) {
	name := PluginRoleName("com.mattermost.boards", "admin")
	assert.True(t, IsValidRoleName(name))
	assert.LessOrEqual(t, len(name), RoleNameMaxLength)

	other := PluginRoleName("com.mattermost.playbooks", "admin")
	assert.NotEqual(t, name, other, "different plugins must not share a role name")
}

func TestPluginPermissionRegistry(t *testing.T) {
	t.Cleanup(ResetPluginPermissionRegistryForTest)
	ResetPluginPermissionRegistryForTest()

	p := &PluginPermission{
		PluginId:     "com.example.plugin",
		Id:           "manage_thing",
		PermissionId: PluginPermissionId("com.example.plugin", "manage_thing"),
		Name:         "Manage thing",
		Scope:        PermissionScopeSystem,
		Active:       true,
	}
	RegisterPluginPermissionInMemory(p)

	assert.True(t, IsRegisteredPluginPermission(p.PermissionId))
	got := GetRegisteredPluginPermission(p.PermissionId)
	require.NotNil(t, got)
	assert.Equal(t, p.Name, got.Name)

	SetPluginPermissionsActiveInMemory("com.example.plugin", false)
	got = GetRegisteredPluginPermission(p.PermissionId)
	require.NotNil(t, got)
	assert.False(t, got.Active)
	assert.True(t, IsRegisteredPluginPermission(p.PermissionId), "inactive permissions stay known")

	UnregisterPluginPermissionsInMemory("com.example.plugin")
	assert.False(t, IsRegisteredPluginPermission(p.PermissionId))
}

func TestUnknownPermissionsIncludesPluginCatalog(t *testing.T) {
	t.Cleanup(ResetPluginPermissionRegistryForTest)
	ResetPluginPermissionRegistryForTest()

	permissionID := PluginPermissionId("com.example.plugin", "manage_thing")
	RegisterPluginPermissionInMemory(&PluginPermission{
		PluginId:     "com.example.plugin",
		Id:           "manage_thing",
		PermissionId: permissionID,
		Name:         "Manage thing",
		Scope:        PermissionScopeSystem,
	})

	role := &Role{
		Name:        "custom_role",
		DisplayName: "Custom",
		Permissions: []string{PermissionCreatePost.Id, permissionID, "not_a_real_permission"},
	}
	assert.Equal(t, []string{"not_a_real_permission"}, role.UnknownPermissions())
}

func TestManifestValidatePermissionsAndRoles(t *testing.T) {
	base := func() *Manifest {
		return &Manifest{Id: "com.example.plugin", Name: "Example"}
	}

	t.Run("valid", func(t *testing.T) {
		m := base()
		m.Permissions = []*ManifestPermission{{
			Id: "manage_thing", Name: "Manage thing", Scope: PermissionScopeChannel,
			DefaultRoles: []string{ChannelAdminRoleId},
		}}
		m.Roles = []*ManifestRole{{Name: "admin", DisplayName: "Thing Admin", Permissions: []string{"manage_thing"}}}
		require.NoError(t, m.IsValid())
	})

	t.Run("invalid permission id", func(t *testing.T) {
		m := base()
		m.Permissions = []*ManifestPermission{{Id: "Bad-Id", Name: "X", Scope: PermissionScopeSystem}}
		require.Error(t, m.IsValid())
	})

	t.Run("invalid scope", func(t *testing.T) {
		m := base()
		m.Permissions = []*ManifestPermission{{Id: "manage_thing", Name: "X", Scope: PermissionScopePlaybook}}
		require.Error(t, m.IsValid())
	})

	t.Run("duplicate permission", func(t *testing.T) {
		m := base()
		m.Permissions = []*ManifestPermission{
			{Id: "manage_thing", Name: "X", Scope: PermissionScopeSystem},
			{Id: "manage_thing", Name: "Y", Scope: PermissionScopeSystem},
		}
		require.Error(t, m.IsValid())
	})

	t.Run("invalid role name", func(t *testing.T) {
		m := base()
		m.Roles = []*ManifestRole{{Name: "Bad Role", DisplayName: "X"}}
		require.Error(t, m.IsValid())
	})
}
