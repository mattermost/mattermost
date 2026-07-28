// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNativeUserAttributeFields(t *testing.T) {
	fields := NativeUserAttributeFields("group-1")
	require.Len(t, fields, 4)

	byName := map[string]*PropertyField{}
	seenIDs := map[string]bool{}
	for _, f := range fields {
		assert.Equal(t, "group-1", f.GroupID)
		assert.Equal(t, PropertyFieldObjectTypeUser, f.ObjectType)

		// The ABAC editors resolve the selected attribute by ID, so each
		// synthetic native field must carry a unique, non-empty ID.
		assert.NotEmpty(t, f.ID, "field %q must have a non-empty ID", f.Name)
		assert.False(t, seenIDs[f.ID], "field %q has a duplicate ID %q", f.Name, f.ID)
		seenIDs[f.ID] = true
		assert.Equal(t, true, f.Attrs[NativeAttributeAttrMarker], "field %q must be marked native", f.Name)
		assert.NotEmpty(t, f.Attrs[NativeAttributeAttrDisplayName], "field %q must carry a display name", f.Name)
		assert.NotEmpty(t, f.Attrs[NativeAttributeAttrOperators], "field %q must advertise operators", f.Name)
		require.NotNil(t, f.PermissionField)
		assert.Equal(t, PermissionLevelSysadmin, *f.PermissionField)
		byName[f.Name] = f
	}

	t.Run("email is a text field with string operators", func(t *testing.T) {
		f := byName[NativeAttributePropertyFieldEmail]
		require.NotNil(t, f)
		assert.Equal(t, PropertyFieldTypeText, f.Type)
		assert.Equal(t, []string{"==", "!=", "in", "contains", "startsWith", "endsWith"}, f.Attrs[NativeAttributeAttrOperators])
		assert.Nil(t, f.Attrs[PropertyFieldAttributeOptions])
	})

	for _, name := range []string{NativeAttributePropertyFieldVerified, NativeAttributePropertyFieldIsBot} {
		t.Run(name+" is a boolean select", func(t *testing.T) {
			f := byName[name]
			require.NotNil(t, f)
			assert.Equal(t, PropertyFieldTypeSelect, f.Type)
			assert.Equal(t, []string{"==", "!="}, f.Attrs[NativeAttributeAttrOperators])
			assert.Equal(t, []map[string]string{{"name": "true"}, {"name": "false"}}, f.Attrs[PropertyFieldAttributeOptions])
		})
	}

	t.Run("createat only offers youngerThanDays", func(t *testing.T) {
		f := byName[NativeAttributePropertyFieldCreateAt]
		require.NotNil(t, f)
		assert.Equal(t, []string{"youngerThanDays"}, f.Attrs[NativeAttributeAttrOperators])
	})
}
