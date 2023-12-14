// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMakePermissionError(t *testing.T) {
	userID := NewId()
	for name, tc := range map[string]struct {
		s             *Session
		permissions   []*Permission
		expectedError string
	}{
		"nil permissions, nil session": {
			s:             &Session{},
			permissions:   nil,
			expectedError: "Permissions: api.context.permissions.app_error, userId=, permission=",
		},
		"nil permissions": {
			s:             &Session{UserId: userID},
			permissions:   nil,
			expectedError: fmt.Sprintf("Permissions: api.context.permissions.app_error, userId=%s, permission=", userID),
		},
		"empty permissions": {
			s:             &Session{UserId: userID},
			permissions:   []*Permission{},
			expectedError: fmt.Sprintf("Permissions: api.context.permissions.app_error, userId=%s, permission=", userID),
		},
		"one permission": {
			s:             &Session{UserId: userID},
			permissions:   []*Permission{PermissionManageSystem},
			expectedError: fmt.Sprintf("Permissions: api.context.permissions.app_error, userId=%s, permission=manage_system", userID),
		},
		"two permissions": {
			s:             &Session{UserId: userID},
			permissions:   []*Permission{PermissionManageSystem, PermissionAssignSystemAdminRole},
			expectedError: fmt.Sprintf("Permissions: api.context.permissions.app_error, userId=%s, permission=manage_system,assign_system_admin_role", userID),
		},
	} {
		t.Run(name, func(t *testing.T) {
			appErr := MakePermissionError(tc.s, tc.permissions)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.expectedError, appErr.Error())
		})
	}
}
