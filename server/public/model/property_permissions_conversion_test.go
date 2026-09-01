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
	// Two owners with scopes convert to two grants, scopes preserved, each
	// carrying all five enforced actions.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1", Scopes: []string{"scope-a"}},
				{Type: PropertyOwnerTypeRole, ID: "role1", Scopes: []string{"scope-b", "scope-c"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 2)
	assert.Equal(t, PropertyOwnerTypeUser, p.Grants[0].Type)
	assert.Equal(t, "user1", p.Grants[0].ID)
	assert.Equal(t, []string{"scope-a"}, p.Grants[0].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
	assert.Equal(t, PropertyOwnerTypeRole, p.Grants[1].Type)
	assert.Equal(t, "role1", p.Grants[1].ID)
	assert.Equal(t, []string{"scope-b", "scope-c"}, p.Grants[1].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[1].Allow)
}

func TestPermissionsFromLegacyGrantsOwnerIsSourcePlugin(t *testing.T) {
	// An owner that is also the field's source plugin collapses into one grant
	// rather than two, and the merge does not narrow the plugin's unrestricted
	// access down to the owner's scope.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsSourcePluginID: "plugin1",
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypePlugin, ID: "plugin1", Scopes: []string{"scope-a"}},
			},
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 1)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.Empty(t, p.Grants[0].Scopes)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyGrantsSourcePluginOnly(t *testing.T) {
	// A source_only field with a source plugin: restrictions deny reads to
	// everyone (7.2), but the plugin's grant admits it regardless, making it
	// the field's only reader.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsAccessMode:     PropertyAccessModeSourceOnly,
			PropertyAttrsSourcePluginID: "plugin1",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionValueRead))
	assert.Equal(t, PermissionLevelNone, p.Restrictions.TierFor(PropertyActionOptionRead))
	require.Len(t, p.Grants, 1)
	assert.Equal(t, PropertyOwnerTypePlugin, p.Grants[0].Type)
	assert.Equal(t, "plugin1", p.Grants[0].ID)
	assert.ElementsMatch(t, validPropertyActions, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyGrantsSyncLock(t *testing.T) {
	// An ldap-synced field converts to a service grant allowing value.write and
	// nothing else — the lock never gated anything but value writes.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyFieldAttrLDAP: "ldap-sync-id",
		},
	}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true})

	require.Len(t, p.Grants, 1)
	assert.Equal(t, PropertyOwnerTypeService, p.Grants[0].Type)
	assert.Equal(t, "ldap", p.Grants[0].ID)
	assert.Equal(t, []string{PropertyActionValueWrite}, p.Grants[0].Allow)
}

func TestPermissionsFromLegacyGrantsLinkedFieldDropsOptionRead(t *testing.T) {
	// A linked field's converted owner grant carries four actions, option.read
	// absent — a grant over the template's own scheme was never a right the
	// linked field's owner held.
	field := &PropertyField{
		Attrs: StringInterface{
			PropertyAttrsOwners: []PropertyOwner{
				{Type: PropertyOwnerTypeUser, ID: "user1"},
			},
		},
	}
	template := &Permissions{Restrictions: &Restrictions{}}

	p := PermissionsFromLegacy(field, LegacyConversionOpts{ConvertAttrs: true, Template: template})

	require.Len(t, p.Grants, 1)
	assert.NotContains(t, p.Grants[0].Allow, PropertyActionOptionRead)
	assert.ElementsMatch(t, []string{
		PropertyActionFieldWrite,
		PropertyActionOptionWrite,
		PropertyActionValueRead,
		PropertyActionValueWrite,
	}, p.Grants[0].Allow)
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
