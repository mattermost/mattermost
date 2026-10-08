// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// registerTestPlugin writes a minimal manifest into the test server's plugin
// directory so GetPluginStatus (and IsInstalledPlugin) finds pluginID as
// installed, without compiling or activating a real plugin process.
func registerTestPlugin(tb testing.TB, th *TestHelper, pluginID string) {
	tb.Helper()
	pluginDir := *th.App.Config().PluginSettings.Directory
	require.NoError(tb, os.MkdirAll(filepath.Join(pluginDir, pluginID), 0755))
	manifest := fmt.Sprintf(`{"id": "%s", "name": "%s", "version": "0.0.1"}`, pluginID, pluginID)
	require.NoError(tb, os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(manifest), 0644))
}

func TestPropertyRestrictionsAllow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	// BasicUser2 is in the channel but never promoted to channel admin, so it
	// is a plain member for every case below.
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	t.Run("everyone is satisfied by a plain member on a channel-targeted field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "everyone field-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionFieldWrite, "")
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelEveryone, tier)

		// Same user does not satisfy admin, showing this passed as
		// "everyone" rather than an accidental fallthrough.
		adminField := &model.PropertyField{
			GroupID:    groupID,
			Name:       "admin field-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelAdmin},
				},
			},
		}
		_, ok = th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, adminField, model.PropertyActionFieldWrite, "")
		assert.False(t, ok)
	})

	t.Run("everyone is satisfied through the value-object dispatcher", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "everyone value-target",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionValueRead, th.BasicChannel.Id)
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelEveryone, tier)
	})

	t.Run("option.read on a channel-targeted field with admin restriction", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "option read admin",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Option: model.ReadWrite{Read: model.PermissionLevelAdmin},
				},
			},
		}

		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id,
			model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, appErr)
		t.Cleanup(func() {
			_, _ = th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId)
		})

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, model.PropertyActionOptionRead, "")
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelAdmin, tier)

		_, ok = th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionOptionRead, "")
		assert.False(t, ok)
	})

	t.Run("value.write measured against the value's object, not the field's target", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "value write member",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelMember},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser2.Id, field, model.PropertyActionValueWrite, th.BasicChannel.Id)
		assert.True(t, ok)
		assert.Equal(t, model.PermissionLevelMember, tier)

		nonMember := th.CreateUser(t)
		_, ok = th.App.propertyRestrictionsAllow(th.Context, nonMember.Id, field, model.PropertyActionValueWrite, th.BasicChannel.Id)
		assert.False(t, ok)
	})

	t.Run("an omitted leaf denies", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "omitted leaf",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					// Option.Write left unset.
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
			},
		}

		_, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, model.PropertyActionOptionWrite, "")
		assert.False(t, ok)
	})

	t.Run("Permissions present with Restrictions nil denies every action", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:     groupID,
			Name:        "no restrictions",
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{},
		}

		for _, action := range []string{
			model.PropertyActionFieldWrite,
			model.PropertyActionOptionRead,
			model.PropertyActionOptionWrite,
			model.PropertyActionValueRead,
			model.PropertyActionValueWrite,
		} {
			_, ok := th.App.propertyRestrictionsAllow(th.Context, th.BasicUser.Id, field, action, "")
			assert.False(t, ok, "action %s should be denied", action)
		}
	})

	t.Run("empty userID denies", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "empty user",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		tier, ok := th.App.propertyRestrictionsAllow(th.Context, "", field, model.PropertyActionFieldWrite, "")
		assert.False(t, ok)
		assert.Equal(t, model.PermissionLevelNone, tier)
	})
}

func TestDecidePropertyFieldPermission(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("restrictions allow and no grant matches", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "restrictions allow",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionFieldWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PermissionLevelEveryone, basis.Tier)
		assert.Empty(t, basis.GrantID)
		assert.False(t, basis.Legacy)
	})

	t.Run("restrictions deny and a matching user grant lists the action", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "restrictions deny grant allows",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.True(t, basis.Allowed)
		assert.Equal(t, th.BasicUser.Id, basis.GrantID)
		assert.False(t, basis.GrantWildcard)
		assert.Empty(t, basis.Tier)
	})

	t.Run("restrictions deny and the matching user grant lists only a different action", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "grant lists only read",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueRead},
					},
				},
			},
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.False(t, basis.Allowed)
	})

	t.Run("a plugin grant naming the caller's user ID does not allow a human caller", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "plugin grant not human",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.False(t, basis.Allowed)
	})

	t.Run("a role grant matches a user holding that role and not a user without it", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "role grant",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeRole, ID: model.SystemAdminRoleId},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.SystemAdminUser.Id, field, model.PropertyActionValueWrite, th.SystemAdminUser.Id)
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.SystemAdminRoleId, basis.GrantID)

		basis = th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.False(t, basis.Allowed)
	})

	t.Run("a field with no role grants performs no user lookup", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "user grants only",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		// A user ID that does not exist would make a.GetUser fail; the
		// decision must still return rather than erroring, proving no role
		// lookup was attempted for a field with no role grant.
		basis := th.App.decidePropertyFieldPermission(th.Context, model.NewId(), field, model.PropertyActionValueWrite, "")
		assert.False(t, basis.Allowed)
	})

	t.Run("nil Permissions falls back to the legacy columns", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:     groupID,
			Name:        "legacy protected",
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Protected:   true,
			Permissions: nil,
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.SystemAdminUser.Id, field, model.PropertyActionFieldWrite, "")
		assert.False(t, basis.Allowed)
		assert.True(t, basis.Legacy)

		field.Protected = false
		field.Permissions = &model.Permissions{
			Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			},
		}
		basis = th.App.decidePropertyFieldPermission(th.Context, th.SystemAdminUser.Id, field, model.PropertyActionFieldWrite, "")
		assert.True(t, basis.Allowed)
		assert.False(t, basis.Legacy)
	})

	t.Run("nil Permissions allows value.read and option.read", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "legacy reads",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		basis := th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionValueRead, "")
		assert.True(t, basis.Allowed)
		assert.True(t, basis.Legacy)

		basis = th.App.decidePropertyFieldPermission(th.Context, th.BasicUser.Id, field, model.PropertyActionOptionRead, "")
		assert.True(t, basis.Allowed)
		assert.True(t, basis.Legacy)
	})
}

func TestPropertyPermissionBasisFor(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("a human caller allowed by a tier names the tier and no grant", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tier basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionFieldWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PermissionLevelEveryone, basis.Tier)
		assert.Empty(t, basis.GrantID)
	})

	t.Run("a human caller allowed by a user grant names the grant and no tier", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "user grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.True(t, basis.Allowed)
		assert.Equal(t, th.BasicUser.Id, basis.GrantID)
		assert.Empty(t, basis.Tier)
	})

	t.Run("a plugin caller allowed by a named plugin grant", func(t *testing.T) {
		registerTestPlugin(t, th, "com.example.plugin")

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "plugin grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "com.example.plugin"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, "com.example.plugin")
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypePlugin, basis.CallerType)
		assert.Equal(t, "com.example.plugin", basis.GrantID)
		assert.False(t, basis.GrantWildcard)
	})

	t.Run("an installed plugin allowed by a wildcard plugin grant", func(t *testing.T) {
		registerTestPlugin(t, th, "com.example.other-plugin")

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "wildcard plugin grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, "com.example.other-plugin")
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypePlugin, basis.CallerType)
		assert.True(t, basis.GrantWildcard)
		assert.Equal(t, "*", basis.GrantID)
	})

	t.Run("a wildcard plugin grant does not capture a human caller allowed by a tier", func(t *testing.T) {
		// Regression: MatchingGrant honours a wildcard ID against any caller,
		// so a naive plugin-grant match (rather than an actual installed-plugin
		// check) would mislabel this human's write as allowed by the plugin
		// grant instead of the restrictions tier that actually allowed it.
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "wildcard plugin grant vs human tier",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelEveryone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, th.BasicUser.Id)
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PermissionLevelEveryone, basis.Tier)
		assert.Empty(t, basis.GrantID)
		assert.False(t, basis.GrantWildcard)
	})

	t.Run("a plugin ID that is not installed is treated as a human", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "uninstalled plugin id basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, "com.example.never-installed")
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, "")
		assert.False(t, basis.Allowed)
		assert.Empty(t, basis.GrantID)
		assert.False(t, basis.GrantWildcard)
	})

	t.Run("a plugin grant and a user grant on the same field do not cross-match", func(t *testing.T) {
		registerTestPlugin(t, th, "com.example.field-owner-plugin")

		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "plugin and user grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "com.example.field-owner-plugin"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		pluginRctx := RequestContextWithCallerID(th.Context, "com.example.field-owner-plugin")
		pluginBasis := th.App.PropertyPermissionBasisFor(pluginRctx, field, model.PropertyActionValueWrite, "")
		assert.True(t, pluginBasis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypePlugin, pluginBasis.CallerType)
		assert.Equal(t, "com.example.field-owner-plugin", pluginBasis.GrantID)

		userRctx := RequestContextWithCallerID(th.Context, th.BasicUser2.Id)
		userBasis := th.App.PropertyPermissionBasisFor(userRctx, field, model.PropertyActionValueWrite, th.BasicUser2.Id)
		assert.True(t, userBasis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypeUser, userBasis.CallerType)
		assert.Equal(t, th.BasicUser2.Id, userBasis.GrantID)
	})

	t.Run("an LDAP sync caller allowed by a service grant on ldap", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "ldap sync basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeService, ID: model.PropertyFieldAttrLDAP},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypeService, basis.CallerType)
		assert.Equal(t, model.PropertyFieldAttrLDAP, basis.GrantID)
	})

	t.Run("a SAML sync caller allowed by a service grant on saml", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "saml sync basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeService, ID: model.PropertyFieldAttrSAML},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, model.CallerIDSAMLSync)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueWrite, "")
		assert.True(t, basis.Allowed)
		assert.Equal(t, model.PropertyOwnerTypeService, basis.CallerType)
		assert.Equal(t, model.PropertyFieldAttrSAML, basis.GrantID)
	})

	t.Run("a field with no permissions falls back to the legacy columns", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "legacy basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionValueRead, "")
		assert.True(t, basis.Legacy)
		assert.True(t, basis.Allowed)
	})

	t.Run("a local-mode caller is unrestricted", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "local admin basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLocalAdmin)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionFieldWrite, "")
		assert.True(t, basis.Unrestricted)
		assert.True(t, basis.Allowed)
		assert.Empty(t, basis.Tier)
		assert.Empty(t, basis.GrantID)
	})

	t.Run("an empty caller ID is denied", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "no caller basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelEveryone},
				},
			},
		}

		basis := th.App.PropertyPermissionBasisFor(th.Context, field, model.PropertyActionFieldWrite, "")
		assert.False(t, basis.Allowed)
	})

	t.Run("no matching grant and no satisfied tier names nothing", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "nothing named basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelNone},
				},
			},
		}

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		basis := th.App.PropertyPermissionBasisFor(rctx, field, model.PropertyActionFieldWrite, "")
		assert.False(t, basis.Allowed)
		assert.Empty(t, basis.Tier)
		assert.Empty(t, basis.GrantID)
		assert.False(t, basis.Legacy)
	})

	t.Run("a nil field is denied without panicking", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		require.NotPanics(t, func() {
			basis := th.App.PropertyPermissionBasisFor(rctx, nil, model.PropertyActionFieldWrite, "")
			assert.False(t, basis.Allowed)
			assert.False(t, basis.Legacy)
		})
	})
}
