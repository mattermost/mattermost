// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSystemOwnedFieldGrant(t *testing.T) {
	t.Run("grants field.write, option.read and option.write to a group's own builtin field", func(t *testing.T) {
		cases := []struct{ groupName, fieldName string }{
			{BoardsPropertyGroupName, BoardsPropertyFieldAssignee},
			{BoardsPropertyGroupName, BoardsPropertyFieldStatus},
			{ManagedCategoryPropertyGroupName, ManagedCategoryPropertyFieldName},
			{SessionAttributesPropertyGroupName, SessionAttributesPropertyFieldIPAddress},
		}
		for _, c := range cases {
			grant := SystemOwnedFieldGrant(c.groupName, c.fieldName)
			require.NotNil(t, grant, "group %q field %q", c.groupName, c.fieldName)
			require.Equal(t, PropertyOwnerTypeService, grant.Type)
			require.Equal(t, c.groupName, grant.ID)
			require.ElementsMatch(t, []string{PropertyActionFieldWrite, PropertyActionOptionRead, PropertyActionOptionWrite}, grant.Allow)
		}
	})

	t.Run("grants nothing to a field its migration does not seed", func(t *testing.T) {
		require.Nil(t, SystemOwnedFieldGrant(BoardsPropertyGroupName, "custom_field"))
		require.Nil(t, SystemOwnedFieldGrant("some_other_group", BoardsPropertyFieldAssignee))
	})

	t.Run("every session attribute system field is covered", func(t *testing.T) {
		for _, field := range SessionAttributeSystemFields("group-id") {
			require.NotNil(t, SystemOwnedFieldGrant(SessionAttributesPropertyGroupName, field.Name), "field %q", field.Name)
		}
	})
}
