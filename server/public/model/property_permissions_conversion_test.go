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
			assert.NotNil(t, p.Grants)
			assert.Empty(t, p.Grants)
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
}

func TestPermissionsFromLegacyProtectedAttr(t *testing.T) {
	// Inside access_control, the protected attr additionally zeroes value.write:
	// only the source plugin can write values on such a field today, no matter
	// what PermissionValues says.
	field := &PropertyField{
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
	// The legacy value-write gate refused every human on a synced field whether
	// or not it was also protected — checkSyncLock ran independently of the
	// owner/protected checks. A field that is synced but not protected has to
	// zero value.write on its own; otherwise it would fall through to whatever
	// PermissionValues says and hand a synced attribute's values to members.
	field := &PropertyField{
		PermissionValues: new(PermissionLevelMember),
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}
	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueWrite))
}

func TestPermissionsFromLegacyAccessMode(t *testing.T) {
	tests := []struct {
		name       string
		accessMode string
		wantRead   PermissionLevel
	}{
		{name: "public", accessMode: PropertyAccessModePublic, wantRead: PermissionLevelEveryone},
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
	// access any other plugin still has today (hasUnrestrictedFieldReadAccess
	// does not consult owners).
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1", Scopes: []string{"scope-a"}},
				{Type: PropertyOwnerTypeRole, ID: "role1", Scopes: []string{"scope-b", "scope-c"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 5)
	assert.Equal(t, PropertyOwnerTypeUser, p.Grants[0].Type)
	assert.Equal(t, "user1", p.Grants[0].ID)
	assert.Equal(t, []string{"scope-a"}, p.Grants[0].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, p.Grants[0].Allow)
	assert.Equal(t, PropertyOwnerTypeUser, p.Grants[1].Type)
	assert.Equal(t, "user1", p.Grants[1].ID)
	assert.Empty(t, p.Grants[1].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, p.Grants[1].Allow)
	assert.Equal(t, PropertyOwnerTypeRole, p.Grants[2].Type)
	assert.Equal(t, "role1", p.Grants[2].ID)
	assert.Equal(t, []string{"scope-b", "scope-c"}, p.Grants[2].Scopes)
	assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, p.Grants[2].Allow)
	assert.Equal(t, PropertyOwnerTypeRole, p.Grants[3].Type)
	assert.Equal(t, "role1", p.Grants[3].ID)
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
				{Type: PropertyOwnerTypeUser, ID: "user1"},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	// The field is public, so a second, wildcard grant appears for the
	// ambient read access any other plugin still has today; the owner's own
	// grant is still the single, unsplit one this test is about.
	require.Len(t, p.Grants, 2)
	assert.Equal(t, "user1", p.Grants[0].ID)
	assert.Empty(t, p.Grants[0].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyGrantsScopedOwnerAndSyncSourceStaySeparate(t *testing.T) {
	// A field with both a scoped owner and a sync source converts to grants
	// that keep the two identities separate -- the split tracks value/other
	// halves per identity, not globally, so a second identity's contribution
	// never bleeds into the owner's.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1", Scopes: []string{"scope-a"}},
			},
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	var sawScopedUserGrant, sawUnscopedUserGrant bool
	for _, g := range p.Grants {
		if g.Type == PropertyOwnerTypeUser && g.ID == "user1" {
			if len(g.Scopes) > 0 {
				sawScopedUserGrant = true
				assert.ElementsMatch(t, []string{PropertyActionValueRead, PropertyActionValueWrite}, g.Allow)
			} else {
				sawUnscopedUserGrant = true
				assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, g.Allow)
			}
		}
		if g.Type == PropertyOwnerTypeService && g.ID == "ldap" {
			assert.Equal(t, []string{PropertyActionValueWrite}, g.Allow)
		}
	}
	assert.True(t, sawScopedUserGrant)
	assert.True(t, sawUnscopedUserGrant)
}

func TestPermissionsFromLegacyGrantsOwnerIsSourcePlugin(t *testing.T) {
	// An owner that is also the field's source plugin collapses into one grant
	// rather than two, and the merge does not narrow the plugin's unrestricted
	// access down to the owner's scope. The field being public still adds a
	// second, wildcard grant for the read any other plugin has today.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"scope-a"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 2)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.Empty(t, p.Grants[0].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
	assert.Equal(t, "*", p.Grants[1].ID)
	assert.ElementsMatch(t, []string{PropertyActionOptionRead, PropertyActionValueRead}, p.Grants[1].Allow)
}

func TestPermissionsFromLegacyGrantsSourcePluginOnly(t *testing.T) {
	// A source_only field with a source plugin: restrictions deny reads to
	// everyone, but the plugin's grant admits it regardless, making it
	// the field's only reader. The field has no owners and is not protected, so
	// checkLegacyFieldWriteAccess and checkSyncLock both let any other plugin
	// write it today; the wildcard grant is what keeps that true after
	// conversion, even though such a plugin still cannot read the field.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode:     PropertyAccessModeSourceOnly,
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueRead))
	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionOptionRead))
	require.Len(t, p.Grants, 2)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
	assert.Equal(t, "*", p.Grants[1].ID)
	assert.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionWrite, PropertyActionValueWrite}, p.Grants[1].Allow)
}

func TestPermissionsFromLegacyGrantsSyncLock(t *testing.T) {
	// An ldap-synced field converts to a service grant allowing value.write and
	// nothing else — the lock never gated anything but value writes. The field
	// has no owners and is not protected, and is public, so a second, wildcard
	// grant appears for everything the lock never touched: reads (public) and
	// the field/option definition writes (checkSyncLock only ever gated value
	// writes, so it never stood in their way).
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 2)
	assert.Equal(t, PropertyOwnerTypeService, p.Grants[0].Type)
	assert.Equal(t, "ldap", p.Grants[0].ID)
	assert.Equal(t, []string{PropertyActionValueWrite}, p.Grants[0].Allow)
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
				{Type: PropertyOwnerTypeUser, ID: "user1"},
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
	// Owners in the attrs convert to nothing when ConvertAttrs is false —
	// outside access_control, Attrs were never enforced.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1"},
			},
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: false})

	assert.Empty(t, p.Grants)
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
	// scheme every linked field inherits. That is exactly what
	// enforceFieldUpdateAccess allows such a template's caller today (no
	// owners, so it falls through to checkLegacyFieldWriteAccess, which only
	// refuses a protected field), so this is faithful rather than a widening,
	// even though it is the least comfortable case the conversion produces.
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

func TestProjectLegacyPermissionsWildcardGrantBecomesOwner(t *testing.T) {
	// A converted field's wildcard plugin grant projects into Attrs as an
	// owner named "*" -- the model's spelling of a wildcard for a v2 caller.
	// That flips HasPropertyFieldOwners from false to true on the projected
	// copy, but grantsFromLegacy preserves an owner's Allow verbatim once it
	// carries one, so converting the projected field back reproduces the same
	// grant instead of losing or duplicating it.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode: PropertyAccessModePublic,
		},
	}
	field.Permissions = PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})
	require.False(t, HasPropertyFieldOwners(field))

	projected := ProjectLegacyPermissions(field)

	assert.True(t, HasPropertyFieldOwners(projected))
	owners := GetPropertyFieldOwners(projected)
	require.Len(t, owners, 1)
	assert.Equal(t, "*", owners[0].ID)
	assert.Equal(t, PropertyOwnerTypePlugin, owners[0].Type)

	reconverted := PermissionsFromLegacy(projected, LegacyConversionOpts{ConvertAttrs: true})
	assert.Equal(t, field.Permissions, reconverted)
}
