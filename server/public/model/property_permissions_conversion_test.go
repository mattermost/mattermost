// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
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
