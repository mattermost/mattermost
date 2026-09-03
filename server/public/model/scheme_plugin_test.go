// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginChannelSchemeName(t *testing.T) {
	const pluginID = "com.example.docs"
	user := []string{PermissionReadChannel.Id, PermissionCreatePost.Id}
	admin := []string{PermissionManagePublicChannelMembers.Id}
	guest := []string{PermissionReadChannel.Id}

	name := PluginChannelSchemeName(pluginID, user, admin, guest)

	t.Run("fits the name column and stays in the namespace", func(t *testing.T) {
		assert.LessOrEqual(t, len(name), SchemeNameMaxLength)
		assert.True(t, IsPluginChannelSchemeName(name))
		assert.Regexp(t, `^plugin_[0-9a-f]{16}_[0-9a-f]{16}$`, name)
	})

	t.Run("pools: order and duplicates do not change it", func(t *testing.T) {
		reordered := PluginChannelSchemeName(pluginID,
			[]string{PermissionCreatePost.Id, PermissionReadChannel.Id, PermissionReadChannel.Id}, admin, guest)
		assert.Equal(t, name, reordered)
	})

	t.Run("separates: a permission moved between roles is a different scheme", func(t *testing.T) {
		moved := PluginChannelSchemeName(pluginID,
			[]string{PermissionReadChannel.Id},
			[]string{PermissionManagePublicChannelMembers.Id, PermissionCreatePost.Id},
			guest)
		assert.NotEqual(t, name, moved)
	})

	t.Run("isolates: another plugin asking for the same sets gets its own", func(t *testing.T) {
		other := PluginChannelSchemeName("com.example.other", user, admin, guest)
		assert.NotEqual(t, name, other)
	})

	t.Run("separates: each generated-role set alone changes the name", func(t *testing.T) {
		diffUser := PluginChannelSchemeName(pluginID, []string{PermissionEditPost.Id}, admin, guest)
		diffAdmin := PluginChannelSchemeName(pluginID, user, []string{PermissionDeletePost.Id}, guest)
		diffGuest := PluginChannelSchemeName(pluginID, user, admin, []string{})

		assert.NotEqual(t, name, diffUser)
		assert.NotEqual(t, name, diffAdmin)
		assert.NotEqual(t, name, diffGuest)
		assert.NotEqual(t, diffUser, diffAdmin)
		assert.NotEqual(t, diffUser, diffGuest)
		assert.NotEqual(t, diffAdmin, diffGuest)
	})

	t.Run("an ordinary scheme name is not in the namespace", func(t *testing.T) {
		assert.False(t, IsPluginChannelSchemeName("some_customer_scheme"))
		// A seeded space preset is reserved too, but under its own name shape, so it must not
		// answer to this one: the two are refused by different guards with different errors.
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
	// GetOrCreatePluginChannelScheme accepts only channel-scoped permissions, so every page
	// permission a space grants its members has to pass this or no plugin could ask for it.
	for _, p := range SpaceChannelScopedPermissions {
		assert.True(t, IsChannelScopedPermissionID(p.Id), "space permission %q is channel-scoped", p.Id)
	}
	assert.True(t, IsChannelScopedPermissionID(PermissionCreatePost.Id))
	assert.True(t, IsChannelScopedPermissionID(PermissionReadChannel.Id))
	assert.False(t, IsChannelScopedPermissionID(PermissionManageSystem.Id))
	assert.False(t, IsChannelScopedPermissionID(PermissionViewTeam.Id))
	assert.False(t, IsChannelScopedPermissionID("not_a_permission"))
}
