// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsChannelFieldFillableByCreators(t *testing.T) {
	level := func(l PermissionLevel) *PermissionLevel { return &l }

	legacyChannelField := func(values *PermissionLevel, attrs StringInterface) *PropertyField {
		return &PropertyField{
			ObjectType:       PropertyFieldObjectTypeChannel,
			Type:             PropertyFieldTypeSelect,
			PermissionValues: values,
			Attrs:            attrs,
		}
	}

	withPermissions := func(valueWrite, valueRead, optionRead PermissionLevel, masking *Masking) *PropertyField {
		return &PropertyField{
			ObjectType: PropertyFieldObjectTypeChannel,
			Type:       PropertyFieldTypeSelect,
			Permissions: &Permissions{
				Restrictions: &Restrictions{
					Field:  WriteOnly{Write: PermissionLevelSysadmin},
					Option: ReadWrite{Read: optionRead, Write: PermissionLevelSysadmin},
					Value:  ReadWrite{Read: valueRead, Write: valueWrite},
				},
				Masking: masking,
			},
		}
	}

	pluginOwner := []any{map[string]any{"id": "plugin-id", "type": PropertyOwnerTypePlugin}}

	testCases := []struct {
		name     string
		field    *PropertyField
		expected bool
	}{
		{name: "nil field", field: nil, expected: false},
		{name: "legacy admin", field: legacyChannelField(level(PermissionLevelAdmin), nil), expected: true},
		{name: "legacy member", field: legacyChannelField(level(PermissionLevelMember), nil), expected: true},
		{name: "legacy nil permission values defaults to admin", field: legacyChannelField(nil, nil), expected: true},
		{name: "legacy sysadmin", field: legacyChannelField(level(PermissionLevelSysadmin), nil), expected: false},
		{name: "legacy none", field: legacyChannelField(level(PermissionLevelNone), nil), expected: false},
		{name: "legacy creator", field: legacyChannelField(level(PermissionLevelCreator), nil), expected: true},
		{name: "legacy everyone", field: legacyChannelField(level(PermissionLevelEveryone), nil), expected: true},
		{name: "managed admin", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyFieldAttrManaged: "admin"}), expected: false},
		{name: "owned", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyAttrsOwners: pluginOwner}), expected: false},
		{name: "protected", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyAttrsProtected: true}), expected: false},
		{name: "synced", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyFieldAttrLDAP: "department"}), expected: false},
		{name: "source only", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSourceOnly}), expected: false},
		{name: "shared only is masked", field: legacyChannelField(level(PermissionLevelAdmin), StringInterface{PropertyAttrsAccessMode: PropertyAccessModeSharedOnly}), expected: false},
		{name: "permissions admin readable", field: withPermissions(PermissionLevelAdmin, PermissionLevelEveryone, PermissionLevelEveryone, nil), expected: true},
		{name: "permissions member readable by members", field: withPermissions(PermissionLevelMember, PermissionLevelMember, PermissionLevelMember, nil), expected: true},
		{name: "permissions sysadmin", field: withPermissions(PermissionLevelSysadmin, PermissionLevelEveryone, PermissionLevelEveryone, nil), expected: false},
		{name: "permissions none", field: withPermissions(PermissionLevelNone, PermissionLevelEveryone, PermissionLevelEveryone, nil), expected: false},
		{name: "permissions creator", field: withPermissions(PermissionLevelCreator, PermissionLevelEveryone, PermissionLevelEveryone, nil), expected: true},
		{name: "permissions everyone", field: withPermissions(PermissionLevelEveryone, PermissionLevelEveryone, PermissionLevelEveryone, nil), expected: true},
		{name: "permissions masked", field: withPermissions(PermissionLevelAdmin, PermissionLevelEveryone, PermissionLevelEveryone, &Masking{}), expected: false},
		{name: "permissions values hidden from members", field: withPermissions(PermissionLevelAdmin, PermissionLevelAdmin, PermissionLevelEveryone, nil), expected: false},
		{name: "permissions options hidden from members", field: withPermissions(PermissionLevelAdmin, PermissionLevelEveryone, PermissionLevelSysadmin, nil), expected: false},
		{name: "permissions without restrictions", field: &PropertyField{ObjectType: PropertyFieldObjectTypeChannel, Permissions: &Permissions{}}, expected: false},
		{name: "permissions take precedence over legacy columns", field: func() *PropertyField {
			f := withPermissions(PermissionLevelSysadmin, PermissionLevelEveryone, PermissionLevelEveryone, nil)
			f.PermissionValues = level(PermissionLevelAdmin)
			return f
		}(), expected: false},
		{name: "user field", field: &PropertyField{ObjectType: PropertyFieldObjectTypeUser, PermissionValues: level(PermissionLevelMember)}, expected: false},
		{name: "post field", field: &PropertyField{ObjectType: PropertyFieldObjectTypePost, PermissionValues: level(PermissionLevelAdmin)}, expected: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsChannelFieldFillableByCreators(tc.field))
		})
	}
}
