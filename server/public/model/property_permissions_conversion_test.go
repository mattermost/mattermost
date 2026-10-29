// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"maps"
	"slices"
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

func TestPermissionsFromLegacyLinkedSyncedField(t *testing.T) {
	// A linked user field converts from its own copy of its template's sync
	// attr, never from the template's grants: a scoped sync owner on the
	// template leaves the field with one unscoped sync grant, which writes its
	// values, and with option.read dropped, since the template's grant covers
	// its options.
	sysadmin := PermissionLevelSysadmin
	ldap := Identity{Type: PropertyOwnerTypeService, ID: "ldap"}
	templateField := &PropertyField{
		ID:                NewId(),
		ObjectType:        PropertyFieldObjectTypeTemplate,
		PermissionField:   &sysadmin,
		PermissionOptions: &sysadmin,
		PermissionValues:  &sysadmin,
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "employeeID",
			PropertyAttrsOwners: []PropertyOwner{{
				Type:   PropertyOwnerTypeService,
				ID:     "ldap",
				Scopes: []string{"entra"},
				Allow:  []string{PropertyActionValueRead, PropertyActionValueWrite},
			}},
		},
	}
	template := PermissionsFromLegacy(templateField, LegacyConversionOpts{ConvertAttrs: true})
	require.Contains(t, template.Grants, Grant{Identity: ldap, Scopes: []string{"entra"}, Allow: []string{PropertyActionValueRead, PropertyActionValueWrite}})

	field := &PropertyField{
		ObjectType:        PropertyFieldObjectTypeUser,
		LinkedFieldID:     &templateField.ID,
		PermissionField:   &sysadmin,
		PermissionOptions: &sysadmin,
		PermissionValues:  &sysadmin,
		Attrs:             StringInterface{PropertyFieldAttrLDAP: "employeeID"},
	}
	opts := LegacyConversionOpts{ConvertAttrs: true, Template: template}
	field.Permissions = PermissionsFromLegacy(field, opts)

	require.NoError(t, field.Permissions.IsValid(field.ObjectType))
	assert.Equal(t, PermissionLevelNone, field.Permissions.Restrictions.TierFor(PropertyActionValueWrite))
	var syncGrants []Grant
	for _, g := range field.Permissions.Grants {
		if g.Identity == ldap {
			syncGrants = append(syncGrants, g)
		}
	}
	assert.Equal(t, []Grant{{Identity: ldap, Allow: removeAction(syncGrantAllow(field), PropertyActionOptionRead)}}, syncGrants)
	assert.NotNil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	assert.Nil(t, field.Permissions.MatchingGrant(PropertyOwnerTypePlugin, "any", "", PropertyActionValueWrite), "only the sync writes a synced field's values")

	// Projecting the field and converting it back gives the same permissions.
	assert.Equal(t, field.Permissions, PermissionsFromLegacy(ProjectLegacyPermissions(field), opts))
}

func TestPermissionsFromLegacyLinkedProtectedSyncedField(t *testing.T) {
	// A linked user field under a protected template carries its template's
	// protected, source_plugin_id and sync attrs. On a synced field the source
	// plugin holds no value.write, nor does the sync on a protected one, and a
	// v2 reader doesn't see the source plugin as an owner.
	templateField := &PropertyField{
		ID:         NewId(),
		ObjectType: PropertyFieldObjectTypeTemplate,
		Attrs: StringInterface{
			PropertyAttrsProtected:      true,
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyFieldAttrLDAP:       "employeeID",
		},
	}
	template := PermissionsFromLegacy(templateField, LegacyConversionOpts{ConvertAttrs: true})
	require.NotNil(t, template.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))

	field := &PropertyField{
		ObjectType:    PropertyFieldObjectTypeUser,
		LinkedFieldID: &templateField.ID,
		Attrs: StringInterface{
			PropertyAttrsProtected:      true,
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyFieldAttrLDAP:       "employeeID",
		},
	}
	field.Permissions = PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	require.NoError(t, field.Permissions.IsValid(field.ObjectType))
	assert.Nil(t, field.Permissions.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))
	assert.NotNil(t, field.Permissions.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionFieldWrite))
	assert.Nil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	// Master lets only the source plugin edit a protected field's definition.
	assert.Nil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionFieldWrite))
	assert.False(t, HasPropertyFieldOwners(ProjectLegacyPermissions(field)))
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
		// Master refuses this mode; it is the fail-safe for a row written by
		// a build that knew a mode this one doesn't.
		{name: "unrecognized access_mode treated as source_only", accessMode: "made_up_mode", wantRead: PermissionLevelNone},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field := &PropertyField{
				Attrs: StringInterface{
					PropertyAttrsAccessMode: tt.accessMode,
				},
			}
			if tt.accessMode != PropertyAccessModePublic && tt.accessMode != "" {
				field.Attrs[PropertyAttrsProtected] = true
			}
			if IsKnownPropertyAccessMode(tt.accessMode) {
				requireMasterLegacyShape(t, field)
			}
			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

			assert.Equal(t, tt.wantRead, p.Restrictions.TierFor(PropertyActionValueRead))
			assert.Equal(t, tt.wantRead, p.Restrictions.TierFor(PropertyActionOptionRead))
		})
	}
}

func TestPermissionsFromLegacyReadsByProtection(t *testing.T) {
	// Master's hook decides a read from access_mode, source_plugin_id and the
	// sync alone, never from either protection flag, so any plugin reads a
	// public field and only the source plugin a source_only one, however the
	// field is protected. A non-public access_mode requires the attr, so a
	// field protected by the column alone is always public. The column also
	// leaves value.write at its level for people, since neither master's hook
	// nor its value permission check reads it.
	member := PermissionLevelMember
	tests := map[string]struct {
		column, attr bool
	}{
		"neither":     {},
		"column only": {column: true},
		"attr only":   {attr: true},
		"both":        {column: true, attr: true},
	}
	for name, tc := range tests {
		for label, accessMode := range map[string]string{"public": PropertyAccessModePublic, "source_only": PropertyAccessModeSourceOnly} {
			if accessMode != PropertyAccessModePublic && !tc.attr {
				continue
			}
			t.Run(name+", "+label, func(t *testing.T) {
				field := &PropertyField{
					ObjectType:       PropertyFieldObjectTypeUser,
					Protected:        tc.column,
					PermissionValues: &member,
					Attrs: StringInterface{
						PropertyAttrsAccessMode:     accessMode,
						PropertyAttrsSourcePluginID: "plugin1",
					},
				}
				if tc.attr {
					field.Attrs[PropertyAttrsProtected] = true
				}
				requireMasterLegacyShape(t, field)

				p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

				require.NoError(t, p.IsValid(field.ObjectType))
				for _, action := range []string{PropertyActionValueRead, PropertyActionOptionRead} {
					if accessMode == PropertyAccessModePublic {
						assert.Equal(t, PermissionLevelEveryone, p.Restrictions.TierFor(action))
						assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "any", "", action))
					} else {
						assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(action))
						assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "any", "", action))
						assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", action))
					}
				}
				if tc.attr {
					assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
				} else {
					assert.Equal(t, member, p.Restrictions.TierFor(PropertyActionValueWrite))
				}
			})
		}
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

func TestPermissionsFromLegacyGrantsScopedOwners(t *testing.T) {
	// A scope only ever narrows the value actions: field.write and the option
	// actions are measured against the field's own target, so a scoped owner
	// keeps them under any scope, or none. Each identity's halves are tracked
	// on their own, so the sync service's unscoped grant never widens an
	// owner's. The field is public and owned, so the wildcard keeps only the
	// read every other plugin has today.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"entra"}},
				{Type: PropertyOwnerTypeService, ID: "service1", Scopes: []string{"okta", "ping"}},
			},
			PropertyFieldAttrLDAP: "employeeID",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	for _, scope := range []string{"", "entra", "okta"} {
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", scope, PropertyActionFieldWrite), scope)
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", scope, PropertyActionOptionWrite), scope)
	}
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "entra", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "okta", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))

	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypeService, "service1", "ping", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeService, "service1", "entra", PropertyActionValueWrite))

	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionOptionWrite))

	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "other", "", PropertyActionValueRead))
	assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "other", "", PropertyActionValueWrite))
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

	t.Run("a synced protected field gives its source plugin no value write", func(t *testing.T) {
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
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
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

func TestPermissionsFromLegacyGrantsOwnedProtectedField(t *testing.T) {
	// master reaches a protected field with owners when an admin sets owners
	// on a field its source plugin created, that plugin, as a listed owner,
	// sets protected, and the admin then changes the owners. Its write checks
	// then read only the owners list, never protected or the source plugin,
	// while its read path still gives the source plugin every value and
	// option.
	newField := func(accessMode string, owners ...PropertyOwner) *PropertyField {
		field := &PropertyField{
			ObjectType:        PropertyFieldObjectTypeUser,
			PermissionField:   new(PermissionLevelSysadmin),
			PermissionOptions: new(PermissionLevelSysadmin),
			PermissionValues:  new(PermissionLevelSysadmin),
			Attrs: StringInterface{
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsAccessMode:     accessMode,
				PropertyAttrsOwners:         owners,
			},
		}
		requireMasterLegacyShape(t, field)
		return field
	}
	opts := LegacyConversionOpts{ConvertAttrs: true}

	t.Run("owned by another plugin, the source plugin keeps only its reads", func(t *testing.T) {
		field := newField(PropertyAccessModeSourceOnly, PropertyOwner{Type: PropertyOwnerTypePlugin, ID: "plugin2"})

		p := PermissionsFromLegacy(field, opts)

		for _, action := range []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueWrite} {
			assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", action), action)
			assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin2", "", action), action)
		}
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueRead))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionOptionRead))

		// A v2 reader sees the owner master stores, not the source plugin.
		projected := ProjectLegacyPermissions(&PropertyField{ObjectType: field.ObjectType, Attrs: field.Attrs, Permissions: p})
		assert.Equal(t, []Identity{{Type: PropertyOwnerTypePlugin, ID: "plugin2"}}, ownerIdentities(GetPropertyFieldOwners(projected)))
		assert.Equal(t, p, PermissionsFromLegacy(projected, opts))
	})

	t.Run("a scoped owner that is the source plugin keeps its value.write scoped", func(t *testing.T) {
		field := newField(PropertyAccessModeSourceOnly, PropertyOwner{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"entra"}})

		p := PermissionsFromLegacy(field, opts)

		require.NoError(t, p.IsValid(field.ObjectType))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "entra", PropertyActionValueWrite))
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "okta", PropertyActionValueWrite))
		assert.Nil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionValueWrite))
		// Its reads are the source plugin's, which no scope narrows.
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "okta", PropertyActionValueRead))
		assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "plugin1", "", PropertyActionFieldWrite))

		// The source plugin's reads sit in the owner's unscoped grant, yet a v2
		// reader still gets back the one scoped owner it set.
		projected := ProjectLegacyPermissions(&PropertyField{ObjectType: field.ObjectType, Attrs: field.Attrs, Permissions: p})
		assert.Equal(t, []PropertyOwner{{
			Type:   PropertyOwnerTypePlugin,
			ID:     "plugin1",
			Scopes: []string{"entra"},
			Allow:  validPropertyActions,
		}}, GetPropertyFieldOwners(projected))
		assert.Equal(t, p, PermissionsFromLegacy(projected, opts))
	})
}

func TestPermissionsFromLegacyGrantsSyncLock(t *testing.T) {
	// A synced field converts to a service grant for its sync allowing every
	// action: the sync reads every option and value, provisions options on a
	// field with no owners and no protection, writes values, and retires a
	// field it maps. The field has no owners and is not protected, and is
	// public, so a second, wildcard grant appears for everything the lock
	// never touched: reads (public) and definition and option writes. Every
	// sync source converts the same way.
	for _, source := range PropertySyncSources() {
		t.Run(source, func(t *testing.T) {
			field := &PropertyField{
				Attrs: StringInterface{
					PropertySyncSourceAttr(source): source + "-sync-id",
				},
			}

			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

			require.Len(t, p.Grants, 2)
			assert.Equal(t, PropertyOwnerTypeService, p.Grants[0].Type)
			assert.Equal(t, source, p.Grants[0].ID)
			assert.Equal(t, validPropertyActions, p.Grants[0].Allow)
			assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[1].Type)
			assert.Equal(t, "*", p.Grants[1].ID)
			assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite, PropertyActionValueRead}, p.Grants[1].Allow)
		})
	}
}

func TestSyncGrantAllow(t *testing.T) {
	// What master's hook lets the sync caller do on a field synced from its
	// source: read every option and value whatever the access mode, write
	// values on a field that holds values unless it is attr-protected and
	// unowned, and change options, and the
	// definition of a field that holds values, unless owners or protection
	// stand in the way.
	owners := []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "scim"}}
	tests := map[string]struct {
		field *PropertyField
		want  []string
	}{
		"user field": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID"}},
			want:  validPropertyActions,
		},
		"owned user field": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID", PropertyAttrsOwners: owners}},
			want:  []string{PropertyActionOptionRead, PropertyActionValueRead, PropertyActionValueWrite},
		},
		"attr-protected user field": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID", PropertyAttrsProtected: true, PropertyAttrsSourcePluginID: "plugin1"}},
			want:  []string{PropertyActionOptionRead, PropertyActionValueRead},
		},
		"owned attr-protected user field": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID", PropertyAttrsProtected: true, PropertyAttrsSourcePluginID: "plugin1", PropertyAttrsOwners: owners}},
			want:  []string{PropertyActionOptionRead, PropertyActionValueRead, PropertyActionValueWrite},
		},
		"column-protected user field": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, Protected: true, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID"}},
			want:  []string{PropertyActionOptionRead, PropertyActionValueRead, PropertyActionValueWrite},
		},
		"template": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeTemplate, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID"}},
			want:  []string{PropertyActionOptionRead, PropertyActionOptionWrite},
		},
		"owned template": {
			field: &PropertyField{ObjectType: PropertyFieldObjectTypeTemplate, Attrs: StringInterface{PropertyFieldAttrLDAP: "employeeID", PropertyAttrsOwners: owners}},
			want:  []string{PropertyActionOptionRead},
		},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.want, syncGrantAllow(tc.field))
		})
	}
}

func TestPermissionsFromLegacyProtectedSyncedFieldValueWrite(t *testing.T) {
	// On master a value write on a protected synced field with no owners passes
	// the protected check only for the source plugin, which the sync lock then
	// refuses, so nobody writes it. With owners, the owner check supersedes
	// both and counts the sync among the owners.
	member := PermissionLevelMember
	newField := func(attrs StringInterface) *PropertyField {
		attrs[PropertyFieldAttrLDAP] = "employeeID"
		return &PropertyField{ObjectType: PropertyFieldObjectTypeUser, PermissionValues: &member, Attrs: attrs}
	}
	valueWriters := func(p *Permissions) []Identity {
		var writers []Identity
		for _, g := range p.Grants {
			if slices.Contains(g.Allow, PropertyActionValueWrite) {
				writers = append(writers, g.Identity)
			}
		}
		return writers
	}
	ldap := Identity{Type: PropertyOwnerTypeService, ID: "ldap"}

	t.Run("protected and unowned, nobody writes values", func(t *testing.T) {
		field := newField(StringInterface{PropertyAttrsProtected: true, PropertyAttrsSourcePluginID: "plugin1"})
		requireMasterLegacyShape(t, field)

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		require.NoError(t, p.IsValid(field.ObjectType))
		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
		assert.Empty(t, valueWriters(p))
	})

	t.Run("protected and owned, the owners and the sync write values", func(t *testing.T) {
		field := newField(StringInterface{
			PropertyAttrsProtected:      true,
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyAttrsOwners:         []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "scim"}},
		})
		requireMasterLegacyShape(t, field)

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		require.NoError(t, p.IsValid(field.ObjectType))
		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
		assert.ElementsMatch(t, []Identity{{Type: PropertyOwnerTypePlugin, ID: "scim"}, ldap}, valueWriters(p))
	})

	t.Run("protected by the column alone, the sync writes values", func(t *testing.T) {
		// Master's protected check reads the attr alone, so the sync lock is all
		// that stands in the way.
		field := newField(StringInterface{})
		field.Protected = true

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		require.NoError(t, p.IsValid(field.ObjectType))
		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
		assert.Equal(t, []Identity{ldap}, valueWriters(p))
	})

	t.Run("unprotected, the sync writes values", func(t *testing.T) {
		field := newField(StringInterface{})

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		require.NoError(t, p.IsValid(field.ObjectType))
		assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
		assert.Equal(t, []Identity{ldap}, valueWriters(p))
	})
}

func TestPermissionsFromLegacySyncReadsRestrictedField(t *testing.T) {
	// master gives a field's sync the whole option list and every value on any
	// access mode, so the converted sync grant reads a source_only field that
	// no one else may read, and the masking exemption covers a shared_only one.
	for _, accessMode := range []string{PropertyAccessModeSourceOnly, PropertyAccessModeSharedOnly} {
		t.Run(accessMode, func(t *testing.T) {
			field := &PropertyField{
				ObjectType: PropertyFieldObjectTypeUser,
				Attrs: StringInterface{
					PropertyAttrsAccessMode:     accessMode,
					PropertyAttrsProtected:      true,
					PropertyAttrsSourcePluginID: "plugin1",
					PropertyFieldAttrLDAP:       "employeeID",
				},
			}
			requireMasterLegacyShape(t, field)

			p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

			require.NoError(t, p.IsValid(field.ObjectType))
			assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionOptionRead))
			assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueRead))
			assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionOptionWrite), "the field is protected")
			assert.Nil(t, p.MatchingGrant(PropertyOwnerTypeService, "saml", "", PropertyActionValueRead))
			if accessMode == PropertyAccessModeSharedOnly {
				require.NotNil(t, p.Masking)
				assert.Contains(t, p.Masking.Except, Identity{Type: PropertyOwnerTypeService, ID: "ldap"})
			} else {
				assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueRead))
			}
		})
	}
}

func TestPermissionsFromLegacyGrantsSyncedTemplate(t *testing.T) {
	// The syncer reads, provisions and prunes a synced attribute's options on
	// its template, so the template's sync grant carries the option actions,
	// even though a template is never sync-locked: value.write keeps its
	// column's level, and the wildcard keeps value.write.
	sysadmin := PermissionLevelSysadmin
	field := &PropertyField{
		ObjectType:        PropertyFieldObjectTypeTemplate,
		PermissionField:   &sysadmin,
		PermissionOptions: &sysadmin,
		PermissionValues:  &sysadmin,
		Attrs:             StringInterface{PropertyFieldAttrLDAP: "employeeID"},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.NoError(t, p.IsValid(field.ObjectType))
	assert.Equal(t, PermissionLevelSysadmin, p.Restrictions.TierFor(PropertyActionValueWrite))
	assert.Contains(t, p.Grants, Grant{Identity: Identity{Type: PropertyOwnerTypeService, ID: "ldap"}, Allow: []string{PropertyActionOptionRead, PropertyActionOptionWrite}})
	assert.NotNil(t, p.MatchingGrant(PropertyOwnerTypePlugin, "any", "", PropertyActionValueWrite))

	t.Run("a linked user field takes the option writes, not the read", func(t *testing.T) {
		// option.read on a linked field reads the template's options, which the
		// template's grant above covers; a linked field may not grant it.
		templateID := NewId()
		linked := &PropertyField{
			ObjectType:        PropertyFieldObjectTypeUser,
			LinkedFieldID:     &templateID,
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &sysadmin,
			Attrs:             StringInterface{PropertyFieldAttrLDAP: "employeeID"},
		}
		linked.Permissions = PermissionsFromLegacy(linked, LegacyConversionOpts{ConvertAttrs: true, Template: p})

		require.NoError(t, linked.Permissions.IsValid(linked.ObjectType))
		for _, g := range linked.Permissions.Grants {
			assert.NotContains(t, g.Allow, PropertyActionOptionRead, "a linked field may not grant option.read")
		}
		assert.Equal(t, PermissionLevelNone, linked.Permissions.Restrictions.TierFor(PropertyActionValueWrite))
		assert.Nil(t, linked.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionOptionRead))
		assert.NotNil(t, linked.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueRead))
		assert.NotNil(t, linked.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
		syncAllow := []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueRead, PropertyActionValueWrite}
		assert.Contains(t, linked.Permissions.Grants, Grant{Identity: Identity{Type: PropertyOwnerTypeService, ID: "ldap"}, Allow: syncAllow})
	})
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
			PropertyAttrsProtected:      true,
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	requireMasterLegacyShape(t, field)
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
			PropertyAttrsProtected:      true,
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyFieldAttrLDAP:       "ldap-sync-id",
		},
	}

	requireMasterLegacyShape(t, field)
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
			PropertyAttrsProtected:  true,
		},
	}
	template := &Permissions{
		Restrictions: &Restrictions{Option: ReadWrite{Read: PermissionLevelEveryone}},
		Masking:      &Masking{},
	}

	requireMasterLegacyShape(t, field)
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
			PropertyAttrsProtected:  true,
		},
	}
	template := &Permissions{Restrictions: &Restrictions{}}

	requireMasterLegacyShape(t, field)
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
			PropertyAttrsProtected:  true,
		},
	}

	requireMasterLegacyShape(t, field)
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
				PropertyAttrsProtected:  true,
			},
		}
		requireMasterLegacyShape(t, field)

		p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

		assert.Nil(t, p.Masking)
	}
}

func TestProjectLegacyPermissionsNilReturnsFieldUnchanged(t *testing.T) {
	field := &PropertyField{ID: "field1"}
	assert.Same(t, field, ProjectLegacyPermissions(field))
	assert.Same(t, field, ProjectLegacyPermissionsWithTemplate(field, &PropertyField{Permissions: &Permissions{Masking: &Masking{}}}))
}

func TestProjectLegacyPermissionsWithTemplate(t *testing.T) {
	public := &Restrictions{
		Field:  WriteOnly{Write: PermissionLevelNone},
		Value:  ReadWrite{Read: PermissionLevelEveryone, Write: PermissionLevelNone},
		Option: ReadWrite{Read: PermissionLevelEveryone, Write: PermissionLevelNone},
	}
	template := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: public, Masking: &Masking{}}}
	linked := &PropertyField{
		ID:            NewId(),
		LinkedFieldID: &template.ID,
		Attrs:         StringInterface{PropertyAttrsSourcePluginID: "plugin"},
		Permissions:   &Permissions{Restrictions: public},
	}

	t.Run("reports the template's access mode", func(t *testing.T) {
		projected := ProjectLegacyPermissionsWithTemplate(linked, template)
		assert.Equal(t, PropertyAccessModeSharedOnly, projected.Attrs[PropertyAttrsAccessMode])
		assert.Equal(t, true, projected.Attrs[PropertyAttrsProtected])
		assert.NotContains(t, linked.Attrs, PropertyAttrsAccessMode)
	})
	t.Run("a nil template matches ProjectLegacyPermissions", func(t *testing.T) {
		assert.Equal(t, ProjectLegacyPermissions(linked), ProjectLegacyPermissionsWithTemplate(linked, nil))
	})
	t.Run("a shared_only field converted under an unmasked template reports source_only", func(t *testing.T) {
		// The conversion narrows such a field's own reads to none rather than
		// masking it, so its own mode is stricter than its public template's.
		unmasked := &PropertyField{ID: NewId(), Permissions: &Permissions{Restrictions: public}}
		converted := &PropertyField{
			ID:            NewId(),
			ObjectType:    PropertyFieldObjectTypeChannel,
			LinkedFieldID: &unmasked.ID,
			Attrs: StringInterface{
				PropertyAttrsAccessMode: PropertyAccessModeSharedOnly,
				PropertyAttrsProtected:  true,
			},
		}
		converted.Permissions = PermissionsFromLegacy(converted, LegacyConversionOpts{ConvertAttrs: true, Template: unmasked.Permissions})
		require.Nil(t, converted.Permissions.Masking)

		projected := ProjectLegacyPermissionsWithTemplate(converted, unmasked)
		assert.Equal(t, PropertyAccessModeSourceOnly, projected.Attrs[PropertyAttrsAccessMode])
	})
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
			name: "a protected field outside access_control",
			field: &PropertyField{
				Protected:        true,
				PermissionField:  new(PermissionLevelNone),
				PermissionValues: new(PermissionLevelMember),
			},
			opts: LegacyConversionOpts{ConvertAttrs: false},
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
				PermissionField: new(PermissionLevelSysadmin),
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
				PermissionField: new(PermissionLevelSysadmin),
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
				PermissionField: new(PermissionLevelSysadmin),
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
			if tt.opts.ConvertAttrs {
				requireMasterLegacyShape(t, tt.field)
			}
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
			// Both non-public modes require the protected attr, which closes
			// every write, so all that's left to check is that no read is
			// granted.
			name:       "source_only grants no reads, since restrictions already deny them",
			accessMode: PropertyAccessModeSourceOnly,
			protected:  true,
			want:       []string{},
		},
		{
			name:       "shared_only grants no reads, since masking shows an ambient caller nothing anyway",
			accessMode: PropertyAccessModeSharedOnly,
			protected:  true,
			want:       []string{},
		},
		{
			name:       "an owner blocks every write, not just its own",
			accessMode: PropertyAccessModePublic,
			owners:     []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "plugin1"}},
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
			name:       "owned and synced grants only the public reads",
			accessMode: PropertyAccessModePublic,
			owners:     []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "plugin1"}},
			synced:     true,
			want:       []string{PropertyActionOptionRead, PropertyActionValueRead},
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
			requireMasterLegacyShape(t, field)

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

func TestProjectLegacyPermissionsProtectedColumns(t *testing.T) {
	sysadmin, member := PermissionLevelSysadmin, PermissionLevelMember

	t.Run("a field protected by the attr projects the columns access_control stores", func(t *testing.T) {
		// The access_control hook pins the field and option columns to sysadmin
		// and keeps protection in the attr, so master stores this field
		// unprotected. Projecting Protected would have master refuse every edit
		// of it after a rollback.
		field := &PropertyField{
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &member,
			Attrs: StringInterface{
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
			},
		}
		opts := LegacyConversionOpts{ConvertAttrs: true}
		field.Permissions = PermissionsFromLegacy(field, opts)
		require.Equal(t, PermissionLevelNone, field.Permissions.Restrictions.TierFor(PropertyActionFieldWrite))

		projected := ProjectLegacyPermissions(field)

		assert.False(t, projected.Protected)
		assert.Equal(t, PermissionLevelSysadmin, *projected.PermissionField)
		assert.Equal(t, PermissionLevelSysadmin, *projected.PermissionOptions)
		assert.True(t, IsPropertyFieldProtected(projected))
		assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
	})

	t.Run("field.write none with no protected attr projects the Protected column", func(t *testing.T) {
		field := &PropertyField{
			Protected:         true,
			PermissionField:   new(PermissionLevelNone),
			PermissionOptions: &member,
			PermissionValues:  &member,
		}
		field.Permissions = PermissionsFromLegacy(field, LegacyConversionOpts{})

		projected := ProjectLegacyPermissions(field)

		assert.True(t, projected.Protected)
		assert.Equal(t, PermissionLevelNone, *projected.PermissionField)
		assert.Equal(t, PermissionLevelMember, *projected.PermissionOptions)
	})

	t.Run("a field with the Protected column set keeps it, even with the attr", func(t *testing.T) {
		// Outside access_control the Protected column is what protects a field,
		// and the attr may sit next to it unenforced. Projecting access_control's
		// unprotected columns would open the field to edits.
		field := &PropertyField{
			Protected:         true,
			PermissionField:   new(PermissionLevelNone),
			PermissionOptions: &member,
			PermissionValues:  &member,
			Attrs:             StringInterface{PropertyAttrsProtected: true},
		}
		opts := LegacyConversionOpts{}
		field.Permissions = PermissionsFromLegacy(field, opts)

		projected := ProjectLegacyPermissions(field)

		assert.True(t, projected.Protected)
		assert.Equal(t, PermissionLevelNone, *projected.PermissionField)
		assert.Equal(t, PermissionLevelMember, *projected.PermissionOptions)
		assert.True(t, IsPropertyFieldProtected(projected))
		assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
	})
}

func TestProjectLegacyPermissionsOmitsDerivedGrants(t *testing.T) {
	// The source plugin's grant on a protected field and the sync service's on
	// a synced one come from the field's other attrs. master never listed
	// either as an owner, and a v2 client reads any owner as managed by an
	// integration, which would lock an ldap-synced field's "who can set".
	sysadmin, member := PermissionLevelSysadmin, PermissionLevelMember
	opts := LegacyConversionOpts{ConvertAttrs: true}

	tests := map[string]StringInterface{
		"protected":           {PropertyAttrsProtected: true, PropertyAttrsSourcePluginID: "plugin1"},
		"ldap-synced":         {PropertyFieldAttrLDAP: "employeeID"},
		"protected and saml":  {PropertyAttrsProtected: true, PropertyAttrsSourcePluginID: "plugin1", PropertyFieldAttrSAML: "employeeID"},
		"openid-synced":       {PropertyFieldAttrOpenID: "department"},
		"unprotected, plugin": {PropertyAttrsSourcePluginID: "plugin1"},
	}
	for name, attrs := range tests {
		t.Run(name, func(t *testing.T) {
			field := &PropertyField{
				ObjectType:        PropertyFieldObjectTypeUser,
				PermissionField:   &sysadmin,
				PermissionOptions: &sysadmin,
				PermissionValues:  &member,
				Attrs:             attrs,
			}
			field.Permissions = PermissionsFromLegacy(field, opts)

			projected := ProjectLegacyPermissions(field)

			assert.False(t, HasPropertyFieldOwners(projected))
			assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
		})
	}

	t.Run("a linked field locked by its copy of its template's sync attr", func(t *testing.T) {
		templateID := NewId()
		field := &PropertyField{
			ObjectType:        PropertyFieldObjectTypeUser,
			LinkedFieldID:     &templateID,
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &member,
			Attrs:             StringInterface{PropertyFieldAttrLDAP: "employeeID"},
		}
		// A public template, so the field's option.read isn't capped to none,
		// which an access mode read from the permissions reports as source_only.
		template := &Permissions{Restrictions: &Restrictions{Option: ReadWrite{Read: PermissionLevelEveryone}}}
		linkedOpts := LegacyConversionOpts{ConvertAttrs: true, Template: template}
		field.Permissions = PermissionsFromLegacy(field, linkedOpts)
		require.NotNil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))

		projected := ProjectLegacyPermissions(field)

		assert.False(t, HasPropertyFieldOwners(projected))
		assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, linkedOpts))
	})

	t.Run("a synced template", func(t *testing.T) {
		field := &PropertyField{
			ObjectType:        PropertyFieldObjectTypeTemplate,
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &member,
			Attrs:             StringInterface{PropertyFieldAttrLDAP: "employeeID"},
		}
		field.Permissions = PermissionsFromLegacy(field, opts)
		require.NotNil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionOptionWrite))

		projected := ProjectLegacyPermissions(field)

		assert.False(t, HasPropertyFieldOwners(projected))
		assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
	})

	t.Run("a derived grant edited past what the attrs give is projected", func(t *testing.T) {
		// Protected, so the derived sync grant can't change options.
		field := &PropertyField{
			ObjectType:        PropertyFieldObjectTypeUser,
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &member,
			Attrs: StringInterface{
				PropertyAttrsProtected:      true,
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyFieldAttrLDAP:       "employeeID",
			},
		}
		field.Permissions = PermissionsFromLegacy(field, opts)
		for i, g := range field.Permissions.Grants {
			if g.Type == PropertyOwnerTypeService {
				field.Permissions.Grants[i].Allow = validPropertyActions
			}
		}

		owners := GetPropertyFieldOwners(ProjectLegacyPermissions(field))

		require.Len(t, owners, 1)
		assert.Equal(t, "ldap", owners[0].ID)
	})
}

func TestProjectLegacyPermissionsMergesScopedOwner(t *testing.T) {
	// A scoped owner converts to a scoped value grant and an unscoped grant
	// for the rest. A v2 reader set one owner, and gets that one owner back.
	sysadmin := PermissionLevelSysadmin
	field := &PropertyField{
		ObjectType:        PropertyFieldObjectTypeUser,
		PermissionField:   &sysadmin,
		PermissionOptions: &sysadmin,
		PermissionValues:  &sysadmin,
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "scim", Scopes: []string{"entra"}}},
		},
	}
	opts := LegacyConversionOpts{ConvertAttrs: true}
	field.Permissions = PermissionsFromLegacy(field, opts)
	require.Len(t, field.Permissions.Grants, 3, "the scoped owner's two halves and the wildcard's read")

	projected := ProjectLegacyPermissions(field)

	assert.Equal(t, []PropertyOwner{{
		Type:   PropertyOwnerTypePlugin,
		ID:     "scim",
		Scopes: []string{"entra"},
		Allow:  validPropertyActions,
	}}, GetPropertyFieldOwners(projected))
	assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
}

func TestPermissionsFromLegacyScopedSyncServiceOwner(t *testing.T) {
	// master adds a synced field's sync service as an unscoped owner of any
	// owned field (effectiveOwners), and the sync caller never acts under a
	// scope, so an ldap owner's scope never narrowed its value writes. The
	// derived sync grant keeps that: it merges into the owner's unscoped grant
	// rather than adding a second one, and its value.read and value.write
	// cover every scope. That leaves the owner's scoped half with nothing, so
	// the v2 view shows the owner unscoped, which is what master's sync
	// caller always was. Converting it back gives the same grants.
	sysadmin := PermissionLevelSysadmin
	ldap := Identity{Type: PropertyOwnerTypeService, ID: "ldap"}
	owner := PropertyOwner{Type: PropertyOwnerTypeService, ID: "ldap", Scopes: []string{"entra"}}
	field := &PropertyField{
		ObjectType:        PropertyFieldObjectTypeUser,
		PermissionField:   &sysadmin,
		PermissionOptions: &sysadmin,
		PermissionValues:  &sysadmin,
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "employeeID",
			PropertyAttrsOwners:   []PropertyOwner{owner},
		},
	}
	requireMasterLegacyShape(t, field)
	opts := LegacyConversionOpts{ConvertAttrs: true}

	field.Permissions = PermissionsFromLegacy(field, opts)

	require.NoError(t, field.Permissions.IsValid(field.ObjectType))
	assert.Equal(t, []Grant{
		{Identity: ldap, Allow: validPropertyActions},
		{Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{PropertyActionOptionRead, PropertyActionValueRead}},
	}, field.Permissions.Grants)
	assert.NotNil(t, field.Permissions.MatchingGrant(PropertyOwnerTypeService, "ldap", "", PropertyActionValueWrite))
	assert.Equal(t, PermissionLevelNone, field.Permissions.Restrictions.TierFor(PropertyActionValueWrite))

	// A v2 reader gets back the one owner it set, every action spelled out.
	projected := ProjectLegacyPermissions(field)

	owner.Scopes = nil
	owner.Allow = validPropertyActions
	assert.Equal(t, []PropertyOwner{owner}, GetPropertyFieldOwners(projected))
	assert.Equal(t, field.Permissions, PermissionsFromLegacy(projected, opts))
}

func TestProjectLegacyPermissionsPreservesV2View(t *testing.T) {
	// Converting a field and projecting the result must show a v2 client the
	// field it had before: the same columns, owners, protected attr and access
	// mode. Each fixture is a shape master stores. In access_control the hook
	// pins the field and option columns to sysadmin and keeps protection in the
	// attr, an owner-managed field's values column to sysadmin, and the
	// Protected column is never set.
	//
	// One difference is expected: PermissionValues reads none on a field whose
	// value writes the legacy decision refused to every human without reading
	// that column, that is an owned, protected or synced access_control field.
	sysadmin, admin, member, none := PermissionLevelSysadmin, PermissionLevelAdmin, PermissionLevelMember, PermissionLevelNone
	accessControl := func(values PermissionLevel, attrs StringInterface) *PropertyField {
		return &PropertyField{
			ObjectType:        PropertyFieldObjectTypeUser,
			PermissionField:   &sysadmin,
			PermissionOptions: &sysadmin,
			PermissionValues:  &values,
			Attrs:             attrs,
		}
	}

	tests := []struct {
		name             string
		field            *PropertyField
		convertAttrs     bool
		valuesIgnoredFor bool
	}{
		{
			name:         "an admin-created field",
			field:        accessControl(member, StringInterface{}),
			convertAttrs: true,
		},
		{
			name:         "a plugin-created unprotected field",
			field:        accessControl(member, StringInterface{PropertyAttrsSourcePluginID: "plugin1"}),
			convertAttrs: true,
		},
		{
			name: "a plugin-protected field",
			field: accessControl(member, StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsProtected:      true,
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a protected source_only field",
			field: accessControl(member, StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsProtected:      true,
				PropertyAttrsAccessMode:     PropertyAccessModeSourceOnly,
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a protected shared_only field",
			field: accessControl(admin, StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsProtected:      true,
				PropertyAttrsAccessMode:     PropertyAccessModeSharedOnly,
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a field owned by a scoped plugin",
			field: accessControl(sysadmin, StringInterface{
				PropertyAttrsOwners: []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "scim", Scopes: []string{"entra"}}},
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a plugin-created field owned by another plugin",
			field: accessControl(sysadmin, StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsOwners:         []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "plugin2"}},
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a protected field an admin gave another owner",
			field: accessControl(sysadmin, StringInterface{
				PropertyAttrsSourcePluginID: "plugin1",
				PropertyAttrsProtected:      true,
				PropertyAttrsAccessMode:     PropertyAccessModeSourceOnly,
				PropertyAttrsOwners:         []PropertyOwner{{Type: PropertyOwnerTypePlugin, ID: "plugin2"}},
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a field owned by a user and a role",
			field: accessControl(sysadmin, StringInterface{
				PropertyAttrsOwners: []PropertyOwner{
					{Type: PropertyOwnerTypeUser, ID: "user1"},
					{Type: PropertyOwnerTypeRole, ID: SystemUserRoleId},
				},
			}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name:             "an ldap-synced field",
			field:            accessControl(member, StringInterface{PropertyFieldAttrLDAP: "employeeID"}),
			convertAttrs:     true,
			valuesIgnoredFor: true,
		},
		{
			name: "a protected field in another group",
			field: &PropertyField{
				ObjectType:        PropertyFieldObjectTypeChannel,
				Protected:         true,
				PermissionField:   &none,
				PermissionOptions: &member,
				PermissionValues:  &member,
			},
		},
		{
			name: "an ordinary field in another group",
			field: &PropertyField{
				ObjectType:        PropertyFieldObjectTypeChannel,
				PermissionField:   &sysadmin,
				PermissionOptions: &sysadmin,
				PermissionValues:  &member,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.convertAttrs {
				require.NoError(t, ValidatePropertyFieldAccessMode(tt.field))
			}
			original := *tt.field
			original.Attrs = maps.Clone(tt.field.Attrs)
			tt.field.Permissions = PermissionsFromLegacy(tt.field, LegacyConversionOpts{ConvertAttrs: tt.convertAttrs})
			require.NoError(t, tt.field.Permissions.IsValid(tt.field.ObjectType))

			projected := ProjectLegacyPermissions(tt.field)

			// IsValid cross-checks Protected against PermissionField, as master's
			// does.
			valid := *projected
			valid.ID, valid.GroupID, valid.Name, valid.Type = NewId(), NewId(), "field", PropertyFieldTypeText
			valid.CreateAt, valid.UpdateAt = GetMillis(), GetMillis()
			valid.TargetType = string(PropertyFieldTargetLevelSystem)
			require.NoError(t, valid.IsValid())
			assert.Equal(t, original.Protected, projected.Protected, "Protected")
			assert.Equal(t, *original.PermissionField, *projected.PermissionField, "PermissionField")
			assert.Equal(t, *original.PermissionOptions, *projected.PermissionOptions, "PermissionOptions")
			if tt.valuesIgnoredFor {
				assert.Equal(t, PermissionLevelNone, *projected.PermissionValues, "PermissionValues")
			} else {
				assert.Equal(t, *original.PermissionValues, *projected.PermissionValues, "PermissionValues")
			}
			assert.Equal(t, LegacyAccessMode(&original), LegacyAccessMode(projected), "access_mode")
			if tt.convertAttrs {
				// Only access_control reads the attr; elsewhere the projection
				// mirrors the column into it.
				assert.Equal(t, IsPropertyFieldProtected(&original), IsPropertyFieldProtected(projected), "protected attr")
			}
			assert.ElementsMatch(t, ownerIdentities(GetPropertyFieldOwners(&original)), ownerIdentities(GetPropertyFieldOwners(projected)), "owners")
		})
	}
}

func ownerIdentities(owners []PropertyOwner) []Identity {
	identities := make([]Identity, 0, len(owners))
	for _, owner := range owners {
		identities = append(identities, Identity{Type: owner.Type, ID: owner.ID})
	}
	return identities
}

// requireMasterLegacyShape fails a fixture master's access mode validator
// refuses, so a conversion test can't pin behaviour for an input no
// access_control write accepts.
func requireMasterLegacyShape(t *testing.T, field *PropertyField) {
	t.Helper()
	require.NoError(t, ValidatePropertyFieldAccessMode(field))
}
