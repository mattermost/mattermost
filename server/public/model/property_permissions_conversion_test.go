// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPermissionsFromLegacyColumns(t *testing.T) {
	tests := []struct {
		name              string
		permissionField   *PermissionLevel
		permissionOptions *PermissionLevel
		permissionValues  *PermissionLevel
		wantFieldWrite    PermissionLevel
		wantOptionWrite   PermissionLevel
		wantValueWrite    PermissionLevel
	}{
		{
			name:            "all columns nil deny",
			wantFieldWrite:  PermissionLevelNone,
			wantOptionWrite: PermissionLevelNone,
			wantValueWrite:  PermissionLevelNone,
		},
		{
			name:              "all columns set carry through",
			permissionField:   new(PermissionLevelSysadmin),
			permissionOptions: new(PermissionLevelAdmin),
			permissionValues:  new(PermissionLevelMember),
			wantFieldWrite:    PermissionLevelSysadmin,
			wantOptionWrite:   PermissionLevelAdmin,
			wantValueWrite:    PermissionLevelMember,
		},
		{
			name:              "each column independently nil",
			permissionField:   nil,
			permissionOptions: new(PermissionLevelEveryone),
			permissionValues:  new(PermissionLevelEveryone),
			wantFieldWrite:    PermissionLevelNone,
			wantOptionWrite:   PermissionLevelEveryone,
			wantValueWrite:    PermissionLevelEveryone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{
				PermissionField:   tt.permissionField,
				PermissionOptions: tt.permissionOptions,
				PermissionValues:  tt.permissionValues,
			}
			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: false})

			require.NotNil(t, p.Restrictions)
			assert.Equal(t, tt.wantFieldWrite, p.Restrictions.TierFor(PropertyActionFieldWrite))
			assert.Equal(t, tt.wantOptionWrite, p.Restrictions.TierFor(PropertyActionOptionWrite))
			assert.Equal(t, tt.wantValueWrite, p.Restrictions.TierFor(PropertyActionValueWrite))
			// A group whose Attrs were never enforced keeps its reads open.
			assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(PropertyActionValueRead))
			assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(PropertyActionOptionRead))
			// Any plugin could act on such a field, so the wildcard keeps that access.
			assert.Equal(t, []Grant{{
				Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
				Allow:    validPropertyActions,
			}}, p.Grants)
			assert.Nil(t, p.Masking)
		})
	}
}

func TestPermissionsFromLegacyProtectedColumn(t *testing.T) {
	// Outside access_control, the Protected column still zeroes field.write, but
	// value.write is left at whatever the column says — the hook that enforces
	// the source-plugin rule is confined to access_control today.
	field := &PropertyField{
		Protected:        true,
		PermissionValues: new(PermissionLevelMember),
	}
	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: false})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionFieldWrite))
	assert.Equal(t, PermissionLevelMember, p.Restrictions.TierFor(PropertyActionValueWrite))
	// The app layer refused plugins a protected field's definition, but never
	// its options or values.
	assert.Equal(t, []Grant{{
		Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
		Allow:    []string{PropertyActionOptionRead, PropertyActionOptionWrite, PropertyActionValueRead, PropertyActionValueWrite},
	}}, p.Grants)
}

func TestPermissionsFromLegacyProtectedAttr(t *testing.T) {
	// Inside access_control, the protected attr zeroes field.write and
	// value.write: only the source plugin can write such a field today, no
	// matter what the columns say. PermissionField is set so field.write can't
	// come out none just by defaulting.
	field := &PropertyField{
		PermissionField:  new(PermissionLevelSysadmin),
		PermissionValues: new(PermissionLevelMember),
		Attrs: StringInterface{
			PropertyAttrsProtected: true,
		},
	}
	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionFieldWrite))
	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
}

func TestPermissionsFromLegacySyncedFieldNotProtected(t *testing.T) {
	// A field that is synced but not protected still zeros value.write;
	// converting PermissionValues instead would hand a synced attribute's
	// values to members.
	field := &PropertyField{
		PermissionValues: new(PermissionLevelMember),
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}
	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
}

func TestApplySyncLock(t *testing.T) {
	wildcard := Identity{Type: PropertyOwnerTypePlugin, ID: "*"}
	ldap := Identity{Type: PropertyOwnerTypeService, ID: "ldap"}
	source := &Permissions{
		Restrictions: &Restrictions{Value: ReadWrite{Read: PermissionLevelEveryone, Write: PermissionLevelSysadmin}},
		Grants: []Grant{
			{Identity: wildcard, Allow: []string{PropertyActionValueWrite}},
			{Identity: ldap, Allow: []string{PropertyActionValueRead}},
		},
	}

	locked := ApplySyncLock(source, "ldap")

	assert.Equal(t, PermissionLevelNone, locked.Restrictions.Value.Write)
	assert.Equal(t, PermissionLevelEveryone, locked.Restrictions.Value.Read)
	// The wildcard had nothing left, and the existing sync grant was widened rather than duplicated.
	require.Len(t, locked.Grants, 1)
	assert.Equal(t, ldap, locked.Grants[0].Identity)
	assert.Equal(t, []string{PropertyActionFieldWrite, PropertyActionValueRead, PropertyActionValueWrite}, locked.Grants[0].Allow)
	assert.Equal(t, PermissionLevelSysadmin, source.Restrictions.Value.Write, "source must not be mutated")
	assert.Equal(t, []string{PropertyActionValueWrite}, source.Grants[0].Allow, "source must not be mutated")
}

func TestPermissionsFromLegacyAccessMode(t *testing.T) {
	tests := []struct {
		name       string
		accessMode string
		wantRead   PermissionLevel
	}{
		{name: "public", accessMode: PropertyAccessModePublic, wantRead: PermissionLevelEveryone},
		{name: "empty access_mode is public", accessMode: "", wantRead: PermissionLevelEveryone},
		{name: "source_only", accessMode: PropertyAccessModeSourceOnly, wantRead: PermissionLevelNone},
		{name: "shared_only reads, masking narrows later", accessMode: PropertyAccessModeSharedOnly, wantRead: PermissionLevelEveryone},
		{name: "unrecognized access_mode treated as source_only", accessMode: "made_up_mode", wantRead: PermissionLevelNone},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{
				Attrs: StringInterface{
					PropertyAttrsAccessMode: tt.accessMode,
				},
			}
			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

			assert.Equal(t, tt.wantRead, p.Restrictions.TierFor(PropertyActionValueRead))
			assert.Equal(t, tt.wantRead, p.Restrictions.TierFor(PropertyActionOptionRead))
		})
	}
}

func TestPermissionsFromLegacyLinkedFieldOptionReadCap(t *testing.T) {
	// A public field linked to a source_only template converts to option.read:
	// everyone unless capped — which the store would then refuse, since a linked
	// field may not sit above its template's tier.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModePublic,
		},
	}
	template := &Permissions{
		Restrictions: &Restrictions{
			Option: ReadWrite{Read: PermissionLevelSysadmin},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	assert.Equal(t, PermissionLevelSysadmin, p.Restrictions.TierFor(PropertyActionOptionRead))
	// value.read is unaffected by the cap — it is option.read alone that reads
	// the template's scheme.
	assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(PropertyActionValueRead))
}

func TestPermissionsFromLegacyLinkedFieldOptionReadNoCapNeeded(t *testing.T) {
	// A field already at or below its template's tier is left alone.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSourceOnly,
			PropertyAttrsProtected:  true,
		},
	}
	template := &Permissions{
		Restrictions: &Restrictions{
			Option: ReadWrite{Read: PermissionLevelEveryone},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionOptionRead))
}

func TestPermissionsFromLegacyGrantsOwners(t *testing.T) {
	// Two owners with scopes each convert to two grants rather than one: a
	// scoped grant over the value actions, and a second, scopeless grant over
	// field.write and the option actions -- scope only ever narrows a value
	// action, so it has nothing to say about the other two. The field is
	// public and owner-managed, so a fifth grant appears for the ambient read
	// access any other plugin still has: owners do not close reads on a
	// public field.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"scope-a"}},
				{Type: PropertyOwnerTypeService, ID: "service1", Scopes: []string{"scope-b", "scope-c"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 5)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.Equal(t, []string{"scope-a"}, p.Grants[0].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, p.Grants[0].Allow)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[1].Type)
	assert.Equal(t, "plugin1", p.Grants[1].ID)
	assert.Empty(t, p.Grants[1].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, p.Grants[1].Allow)
	assert.Equal(t, PropertyOwnerTypeService, p.Grants[2].Type)
	assert.Equal(t, "service1", p.Grants[2].ID)
	assert.Equal(t, []string{"scope-b", "scope-c"}, p.Grants[2].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, p.Grants[2].Allow)
	assert.Equal(t, PropertyOwnerTypeService, p.Grants[3].Type)
	assert.Equal(t, "service1", p.Grants[3].ID)
	assert.Empty(t, p.Grants[3].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, p.Grants[3].Allow)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[4].Type)
	assert.Equal(t, "*", p.Grants[4].ID)
	assert.ElementsMatch(t, []string{PropertyActionOptionRead, PropertyActionValueRead}, p.Grants[4].Allow)
}

func TestPermissionsFromLegacyGrantsScopedOwnerDefinitionWriteUnscoped(t *testing.T) {
	// A scoped owner may still write the field definition and the options
	// under any scope (or none): scope only ever narrows the value actions,
	// so putting it on field.write would refuse a definition write from a
	// caller acting under the very scope it owns the field with.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin-owner", Scopes: []string{"entra"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin-owner", "", PropertyActionFieldWrite))
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin-owner", "", PropertyActionOptionWrite))
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin-owner", "okta", PropertyActionFieldWrite))

	// The value grant is still scope-gated: acting as a scope the owner was
	// never granted still refuses a value write.
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin-owner", "entra", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin-owner", "okta", PropertyActionValueWrite))
}

func TestPermissionsFromLegacyGrantsUnscopedOwnerUnaffected(t *testing.T) {
	// An owner with no scopes collapses back into a single grant, same as
	// before the split existed -- the split only produces two grants when a
	// scope actually needs keeping off the definition-write actions.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	// The field is public, so a second, wildcard grant appears for the
	// ambient read access any other plugin still has today; the owner's own
	// grant is still the single, unsplit one this test is about.
	require.Len(t, p.Grants, 2)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.Empty(t, p.Grants[0].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyHumanOwnersGrantNothing(t *testing.T) {
	// No access check ever matched a user or role owner: only plugin and
	// service callers got past an owners list, and every human was refused on
	// an owned field. Such owners convert to no grant, and the field stays
	// locked to people.
	tests := map[string]PropertyOwner{
		"user":        {Type: PropertyOwnerTypeUser, ID: "user1"},
		"scoped user": {Type: PropertyOwnerTypeUser, ID: "user1", Scopes: []string{"scope-a"}},
		"role":        {Type: PropertyOwnerTypeRole, ID: SystemUserRoleId},
	}
	for name, owner := range tests {
		t.Run(name, func(t *testing.T) {
			field := &PropertyField{
				ObjectType:        PropertyFieldObjectTypeUser,
				PermissionField:   new(PermissionLevelSysadmin),
				PermissionOptions: new(PermissionLevelSysadmin),
				PermissionValues:  new(PermissionLevelSysadmin),
				Attrs: StringInterface{
					PropertyAttrsOwners: []PropertyOwner{owner},
				},
			}

			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

			assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
			assert.Equal(t, PermissionLevelSysadmin, p.Restrictions.TierFor(PropertyActionFieldWrite))
			// The only grant is the wildcard's ambient read: the owner still
			// closes the field to every other plugin's writes.
			assert.Equal(t, []Grant{{
				Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
				Allow:    []string{PropertyActionOptionRead, PropertyActionValueRead},
			}}, p.Grants)
		})
	}
}

func TestProjectLegacyPermissionsKeepsHumanOwners(t *testing.T) {
	// A user or role owner has no grant to project, so it is carried over from
	// the stored attr. Without it, a v2 reader would see an unowned field, and
	// converting what it sends back would open the field's writes to the
	// plugin wildcard.
	field := &PropertyField{
		PermissionField:   new(PermissionLevelSysadmin),
		PermissionOptions: new(PermissionLevelSysadmin),
		PermissionValues:  new(PermissionLevelSysadmin),
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1"},
				{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
			},
		},
	}
	opts := LegacyConversionOpts{ConvertAttrs: true}
	field.Permissions = PermissionsFromLegacy(field, opts)

	projected := ProjectLegacyPermissions(field)

	owners := GetPropertyFieldOwners(projected)
	require.Len(t, owners, 2)
	assert.Equal(t, Identity{Type: PropertyOwnerTypePlugin, ID: "plugin1"}, Identity{Type: owners[0].Type, ID: owners[0].ID})
	assert.Equal(t, Identity{Type: PropertyOwnerTypeUser, ID: "user1"}, Identity{Type: owners[1].Type, ID: owners[1].ID})
	assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
}

func TestPermissionsFromLegacyWorstCaseGrantCountUnderCap(t *testing.T) {
	// The worst realistic conversion: the max owners, each scoped so it splits
	// into a value grant and a definition grant, plus a source plugin, a sync
	// source, and the ambient wildcard of a public owner-managed field. This is
	// what sets PropertyGrantsMaxPerField's floor -- a lower cap would reject a
	// field whose owners stay within PropertyOwnersMaxPerField.
	owners := make([]PropertyOwner, PropertyOwnersMaxPerField)
	for i := range owners {
		owners[i] = PropertyOwner{Type: PropertyOwnerTypePlugin, ID: NewId(), Scopes: []string{"scope"}}
	}
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners:         owners,
			PropertyAttrsSourcePluginID: "source-plugin",
			PropertyFieldAttrLDAP:       "ldap-sync",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Greater(t, len(p.Grants), PropertyOwnersMaxPerField,
		"the conversion emits more grants than the field had owners, which is why the grant cap exceeds the owners cap")
	assert.LessOrEqual(t, len(p.Grants), PropertyGrantsMaxPerField,
		"PropertyGrantsMaxPerField must be high enough for the worst realistic conversion")
	require.NoError(t, p.IsValid(""))
}

func TestPermissionsFromLegacyGrantsScopedOwnerAndSyncSourceStaySeparate(t *testing.T) {
	// A field with both a scoped owner and a sync source converts to grants
	// that keep the two identities separate -- the split tracks value/other
	// halves per identity, not globally, so a second identity's contribution
	// never bleeds into the owner's.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"scope-a"}},
			},
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	var sawScopedOwnerGrant, sawUnscopedOwnerGrant bool
	for _, g := range p.Grants {
		if g.Type == PropertyOwnerTypePlugin && g.ID == "plugin1" {
			if len(g.Scopes) > 0 {
				sawScopedOwnerGrant = true
				assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, g.Allow)
			} else {
				sawUnscopedOwnerGrant = true
				assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, g.Allow)
			}
		}
		if g.Type == PropertyOwnerTypeService && g.ID == "ldap" {
			assert.Equal(t, []string{PropertyActionFieldWrite, PropertyActionValueWrite}, g.Allow)
		}
	}
	assert.True(t, sawScopedOwnerGrant)
	assert.True(t, sawUnscopedOwnerGrant)
}

func TestPermissionsFromLegacyGrantsOwnerIsSourcePlugin(t *testing.T) {
	// On an unprotected field the source plugin has no standing of its own:
	// being an owner is what lets it write, so it keeps exactly the owner's
	// scope. The field being public still adds a wildcard grant for the read
	// any other plugin has today.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"scope-a"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "scope-a", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "scope-b", PropertyActionValueWrite))
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionFieldWrite))
	require.Len(t, p.Grants, 3)
	assert.Equal(t, "*", p.Grants[2].ID)
	assert.ElementsMatch(t, []string{PropertyActionOptionRead, PropertyActionValueRead}, p.Grants[2].Allow)
}

func TestPermissionsFromLegacyGrantsSourcePlugin(t *testing.T) {
	t.Run("a protected source_only field admits only its source plugin", func(t *testing.T) {
		// Restrictions deny reads to everyone, and the protected attr closes
		// every write, so the plugin's grant is the field's only access.
		field := &PropertyField{
			Attrs: StringInterface{
				PropertyAttrsAccessMode:     PropertyAccessModeSourceOnly,
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
			},
		}
		require.NoError(t, ValidatePropertyFieldAccessMode(field))

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueRead))
		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionOptionRead))
		assert.Equal(t, []Grant{{
			Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
			Allow:    validPropertyActions,
		}}, p.Grants)
	})

	t.Run("a synced protected field keeps its values for the sync service", func(t *testing.T) {
		field := &PropertyField{
			Attrs: StringInterface{
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyFieldAttrLDAP:       "ldap-sync-id",
			},
		}

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionFieldWrite))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	})

	t.Run("an unprotected field gives its source plugin nothing of its own", func(t *testing.T) {
		// Owned by another plugin, the field is that plugin's to write, as it
		// is on master; unowned, the wildcard already covers the source plugin.
		owned := &PropertyField{
			Attrs: StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsOwners:         []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "plugin2"}},
			},
		}
		p := PermissionsFromLegacy(owned, LegacyConversionOpts{ConvertAttrs: true})
		for _, action := range []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueWrite} {
			assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", action), action)
			assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin2", "", action), action)
		}

		synced := &PropertyField{
			Attrs: StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyFieldAttrLDAP:       "ldap-sync-id",
			},
		}
		p = PermissionsFromLegacy(synced, LegacyConversionOpts{ConvertAttrs: true})
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionFieldWrite))
	})
}

func TestPermissionsFromLegacyGrantsSyncLock(t *testing.T) {
	// An ldap-synced field converts to a service grant allowing value.write
	// and field.write — the lock never gated human value writes, and the
	// sync identity also needs to retire a field it maps. The field has no
	// owners and is not protected, and is public, so a second, wildcard
	// grant appears for everything the lock never touched: reads (public)
	// and option definition writes.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 2)
	assert.Equal(t, PropertyOwnerTypeService, p.Grants[0].Type)
	assert.Equal(t, "ldap", p.Grants[0].ID)
	assert.Equal(t, []string{PropertyActionFieldWrite, PropertyActionValueWrite}, p.Grants[0].Allow)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[1].Type)
	assert.Equal(t, "*", p.Grants[1].ID)
	assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite, PropertyActionValueRead}, p.Grants[1].Allow)
}

func TestPermissionsFromLegacyGrantsLinkedFieldDropsOptionRead(t *testing.T) {
	// A linked field's converted owner grant carries four actions, option.read
	// absent — a grant over the template's own scheme was never a right the
	// linked field's owner held. The field is public, so the wildcard grant for
	// every other plugin's ambient read loses option.read the same way.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
			},
		},
	}
	template := &Permissions{Restrictions: &Restrictions{}}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	require.Len(t, p.Grants, 2)
	assert.NotContains(t, p.Grants[0].Allow, PropertyActionOptionRead)
	assert.ElementsMatch(t, []string{
		PropertyActionFieldWrite,
		PropertyActionOptionWrite,
		PropertyActionValueRead,
		PropertyActionValueWrite,
	}, p.Grants[0].Allow)
	assert.Equal(t, "*", p.Grants[1].ID)
	assert.NotContains(t, p.Grants[1].Allow, PropertyActionOptionRead)
	assert.Equal(t, []string{PropertyActionValueRead}, p.Grants[1].Allow)
}

func TestPermissionsFromLegacyGrantsLinkedFieldDropsOptionReadOnlyGrant(t *testing.T) {
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeUser,
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSourceOnly,
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Allow: []string{PropertyActionOptionRead}},
				{Type: PropertyOwnerTypePlugin, ID: "plugin2", Scopes: []string{"scope1"}, Allow: []string{PropertyActionValueRead, PropertyActionOptionRead}},
			},
		},
	}
	template := &Permissions{Restrictions: &Restrictions{}}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	require.NoError(t, p.IsValid(PropertyFieldObjectTypeUser))
	require.Len(t, p.Grants, 1)
	assert.Equal(t, "plugin2", p.Grants[0].ID)
	assert.Equal(t, []string{"scope1"}, p.Grants[0].Scopes)
	assert.Equal(t, []string{PropertyActionValueRead}, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyMaskingSourcePlugin(t *testing.T) {
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeChannel,
		Attrs: StringInterface{
			PropertyAttrsAccessMode:     PropertyAccessModeSharedOnly,
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.NotNil(t, p.Masking)
	assert.Empty(t, p.Masking.MaskByFieldID)
	assert.Equal(t, []Identity{{Type: PropertyOwnerTypePlugin, ID: "plugin1"}}, p.Masking.Except)
}

func TestPermissionsFromLegacyMaskingSourcePluginAndSync(t *testing.T) {
	// A field can carry both a source plugin and a sync lock; both get their own
	// exemption, since a grant confers no masking exemption.
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeChannel,
		Attrs: StringInterface{
			PropertyAttrsAccessMode:     PropertyAccessModeSharedOnly,
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyFieldAttrLDAP:       "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.NotNil(t, p.Masking)
	assert.Equal(t, []Identity{
		{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
		{Type: PropertyOwnerTypeService, ID: "ldap"},
	}, p.Masking.Except)
}

func TestPermissionsFromLegacyMaskingUserFieldClampsSelfWrite(t *testing.T) {
	// A masked object_type:user field may not be self-writable, or a caller could
	// widen their own view by editing their own holdings.
	field := &PropertyField{
		ObjectType:       PropertyFieldObjectTypeUser,
		PermissionValues: new(PermissionLevelMember),
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.NotNil(t, p.Masking)
	assert.Equal(t, PermissionLevelAdmin, p.Restrictions.TierFor(PropertyActionValueWrite))
	assert.NoError(t, p.IsValid(PropertyFieldObjectTypeUser))
}

func TestPermissionsFromLegacyMaskingLinkedFieldTemplateMasked(t *testing.T) {
	// A linked field carrying its own shared_only (copied at link time from a
	// protected template) inherits the template's masking whole rather than
	// declaring one of its own.
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeChannel,
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
		},
	}
	template := &Permissions{
		Restrictions: &Restrictions{Option: ReadWrite{Read: PermissionLevelEveryone}},
		Masking:      &Masking{},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	assert.Nil(t, p.Masking)
	assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(PropertyActionValueRead))
	assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(PropertyActionOptionRead))
}

func TestPermissionsFromLegacyMaskingLinkedFieldTemplateUnmasked(t *testing.T) {
	// A linked field configured as filtered but linked to a template with
	// nothing to filter by fails closed instead of inheriting nothing.
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeChannel,
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
		},
	}
	template := &Permissions{Restrictions: &Restrictions{}}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	assert.Nil(t, p.Masking)
	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueRead))
	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionOptionRead))
}

func TestPermissionsFromLegacyMaskingTemplate(t *testing.T) {
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeTemplate,
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.NotNil(t, p.Masking)
	assert.NoError(t, p.IsValid(PropertyFieldObjectTypeTemplate))
}

func TestPermissionsFromLegacyMaskingSourceOnlyAndPublic(t *testing.T) {
	for _, mode := range []string{PropertyAccessModeSourceOnly, PropertyAccessModePublic} {
		field := &PropertyField{
			ObjectType: PropertyFieldObjectTypeChannel,
			Attrs: StringInterface{
				PropertyAttrsAccessMode: mode,
			},
		}

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		assert.Nil(t, p.Masking)
	}
}

func TestProjectLegacyPermissionsNilReturnsFieldUnchanged(t *testing.T) {
	field := &PropertyField{ID: "field1"}
	assert.Same(t, field, ProjectLegacyPermissions(field))
}

func TestProjectLegacyPermissionsRoundTrip(t *testing.T) {
	tests := []struct {
		name  string
		field *PropertyField
		opts  LegacyConversionOpts
	}{
		{
			name: "the three write levels",
			field: &PropertyField{
				PermissionField:   new(PermissionLevelSysadmin),
				PermissionOptions: new(PermissionLevelAdmin),
				PermissionValues:  new(PermissionLevelMember),
			},
			opts: LegacyConversionOpts{ConvertAttrs: false},
		},
		{
			name: "a protected field",
			field: &PropertyField{
				Protected:        true,
				PermissionField:  new(PermissionLevelNone),
				PermissionValues: new(PermissionLevelMember),
				Attrs: StringInterface{
					PropertyAttrsProtected: true,
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "a field protected by the attr only",
			field: &PropertyField{
				PermissionField:  new(PermissionLevelSysadmin),
				PermissionValues: new(PermissionLevelMember),
				Attrs: StringInterface{
					PropertyAttrsProtected:      true,
					PropertyAttrsSourcePluginID: "plugin-src",
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "public access mode",
			field: &PropertyField{
				PermissionField: new(PermissionLevelSysadmin),
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModePublic,
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "source_only access mode",
			field: &PropertyField{
				Protected:       true,
				PermissionField: new(PermissionLevelNone),
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSourceOnly,
					PropertyAttrsProtected:  true,
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "shared_only access mode",
			field: &PropertyField{
				ObjectType:      PropertyFieldObjectTypeChannel,
				Protected:       true,
				PermissionField: new(PermissionLevelNone),
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "a field with owners carrying scopes",
			field: &PropertyField{
				PermissionField: new(PermissionLevelAdmin),
				Attrs: StringInterface{
					PropertyAttrsOwners: []PropertyOwner{
						{Type: PropertyOwnerTypeUser, ID: "user1", Scopes: []string{"scope-a"}},
						{Type: PropertyOwnerTypeRole, ID: "role1", Scopes: []string{"scope-b", "scope-c"}},
					},
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
		{
			name: "an ldap-synced shared_only field",
			field: &PropertyField{
				ObjectType:      PropertyFieldObjectTypeChannel,
				Protected:       true,
				PermissionField: new(PermissionLevelNone),
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
					PropertyAttrsProtected:  true,
					PropertyFieldAttrLDAP:   "ldap-sync-id",
				},
			},
			opts: LegacyConversionOpts{ConvertAttrs: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := PermissionsFromLegacy(tt.field, tt.opts)
			tt.field.Permissions = want

			projected := ProjectLegacyPermissions(tt.field)
			got := PermissionsFromLegacy(projected, tt.opts)

			assert.Equal(t, want, got)
		})
	}
}

func TestProjectLegacyPermissionsDoesNotMutateArgument(t *testing.T) {
	field := &PropertyField{
		PermissionField: new(PermissionLevelAdmin),
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1"},
			},
		},
	}
	field.Permissions = PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})
	before := maps.Clone(field.Attrs)

	projected := ProjectLegacyPermissions(field)

	assert.Equal(t, before, field.Attrs)
	// The two Attrs maps must not share backing storage, or a later caller
	// mutating the projected copy would corrupt the stored field.
	delete(projected.Attrs, PropertyAttrsOwners)
	assert.Contains(t, field.Attrs, PropertyAttrsOwners)
}

func TestPermissionsFromLegacyGrantsConvertAttrsFalse(t *testing.T) {
	// Owners and the source plugin in the attrs convert to nothing when
	// ConvertAttrs is false — outside access_control, Attrs were never
	// enforced. Only the wildcard every such field gets remains.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1"},
			},
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: false})

	assert.Equal(t, []Grant{{
		Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
		Allow:    validPropertyActions,
	}}, p.Grants)
}

func TestPermissionsFromLegacyConvertAttrsFalseLinkedFieldDropsOptionRead(t *testing.T) {
	// A linked field may not hold an option.read grant, so the wildcard loses it.
	field := &PropertyField{}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: false, Template: &Permissions{}})

	assert.Equal(t, []Grant{{
		Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
		Allow:    []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueRead, PropertyActionValueWrite},
	}}, p.Grants)
}

func TestAmbientMachineGrantAllow(t *testing.T) {
	tests := []struct {
		name       string
		accessMode string
		owners     []PropertyOwner
		protected  bool
		protected2 bool // the field.Protected struct column, the second copy of the flag
		synced     bool
		want       []string
	}{
		{
			name:       "public, unowned, unprotected, unsynced grants everything",
			accessMode: PropertyAccessModePublic,
			want:       validPropertyActions,
		},
		{
			name:       "source_only grants no reads, since restrictions already deny them",
			accessMode: PropertyAccessModeSourceOnly,
			want:       []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueWrite},
		},
		{
			name:       "shared_only grants no reads, since masking shows an ambient caller nothing anyway",
			accessMode: PropertyAccessModeSharedOnly,
			want:       []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueWrite},
		},
		{
			name:       "an owner blocks every write, not just its own",
			accessMode: PropertyAccessModePublic,
			owners:     []PropertyOwner{{Type: PropertyOwnerTypeUser, ID: "user1"}},
			want:       []string{PropertyActionOptionRead, PropertyActionValueRead},
		},
		{
			name:       "the access_control-only protected attr blocks every write",
			accessMode: PropertyAccessModePublic,
			protected:  true,
			want:       []string{PropertyActionOptionRead, PropertyActionValueRead},
		},
		{
			name:       "the field.Protected column blocks every write the same way",
			accessMode: PropertyAccessModePublic,
			protected2: true,
			want:       []string{PropertyActionOptionRead, PropertyActionValueRead},
		},
		{
			name:       "a sync lock blocks only value.write",
			accessMode: PropertyAccessModePublic,
			synced:     true,
			want:       []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite, PropertyActionValueRead},
		},
		{
			name:       "owned, protected and synced grants nothing at all",
			accessMode: PropertyAccessModeSourceOnly,
			owners:     []PropertyOwner{{Type: PropertyOwnerTypeUser, ID: "user1"}},
			protected:  true,
			synced:     true,
			want:       []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{
				Protected: tt.protected2,
				Attrs: StringInterface{
					PropertyAttrsAccessMode: tt.accessMode,
				},
			}
			if tt.owners != nil {
				field.Attrs[PropertyAttrsOwners] = tt.owners
			}
			if tt.protected {
				field.Attrs[PropertyAttrsProtected] = true
			}
			if tt.synced {
				field.Attrs[PropertyFieldAttrLDAP] = "ldap-sync-id"
			}

			assert.ElementsMatch(t, tt.want, ambientMachineGrantAllow(field))
		})
	}
}

func TestPermissionsFromLegacyGrantsNoAmbientAccessEmitsNoGrant(t *testing.T) {
	// A field that grants no ambient access at all converts to zero grants,
	// not a wildcard grant with an empty Allow -- Grant.isValid rejects that.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModeSourceOnly,
			PropertyAttrsProtected:  true,
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Empty(t, p.Grants)
}

func TestPermissionsFromLegacyGrantsTemplateWildcardFieldWrite(t *testing.T) {
	// An unowned, unprotected template converts to a wildcard grant that
	// includes field.write -- handing any installed plugin the definition of a
	// scheme every linked field inherits. That matches what
	// enforceFieldUpdateAccess allows such a template's caller (no owners and
	// not protected), so this is faithful rather than a widening, even though
	// it is the least comfortable case the conversion produces.
	field := &PropertyField{
		ObjectType: PropertyFieldObjectTypeTemplate,
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModePublic,
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 1)
	assert.Equal(t, "*", p.Grants[0].ID)
	assert.Contains(t, p.Grants[0].Allow, PropertyActionFieldWrite)
}

func TestProjectLegacyPermissionsOmitsWildcardGrant(t *testing.T) {
	// A converted field's wildcard plugin grant must not project as an owner:
	// a v2 reader takes any owner to mean no person may set the values, so an
	// ordinary field would read as locked. Converting the projection back
	// mints the same wildcard again.
	for name, convertAttrs := range map[string]bool{"access_control": true, "another group": false} {
		t.Run(name, func(t *testing.T) {
			opts := LegacyConversionOpts{ConvertAttrs: convertAttrs}
			field := &PropertyField{
				PermissionField:   new(PermissionLevelSysadmin),
				PermissionOptions: new(PermissionLevelSysadmin),
				PermissionValues:  new(PermissionLevelMember),
				Attrs: StringInterface{
					PropertyAttrsAccessMode: PropertyAccessModePublic,
				},
			}
			field.Permissions = PermissionsFromLegacy(field, opts)
			require.Len(t, field.Permissions.Grants, 1)
			require.Equal(t, "*", field.Permissions.Grants[0].ID)

			projected := ProjectLegacyPermissions(field)

			assert.False(t, HasPropertyFieldOwners(projected))
			assert.NotContains(t, projected.Attrs, PropertyAttrsOwners)
			assert.Equal(t, PermissionLevelMember, *projected.PermissionValues)

			reconverted := PermissionsFromLegacy(projected, opts)
			assert.Equal(t, field.Permissions, reconverted)
		})
	}

	t.Run("an owned field projects only its named owner", func(t *testing.T) {
		field := &PropertyField{
			Attrs: StringInterface{
				PropertyAttrsOwners: []PropertyOwner{
					{Type: PropertyOwnerTypePlugin, ID: "plugin1"},
				},
			},
		}
		field.Permissions = PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})
		// The owner blocks ambient writes but not ambient reads, so a
		// read-only wildcard sits next to the owner's grant.
		require.Len(t, field.Permissions.Grants, 2)

		owners := GetPropertyFieldOwners(ProjectLegacyPermissions(field))

		require.Len(t, owners, 1)
		assert.Equal(t, "plugin1", owners[0].ID)
	})
}
