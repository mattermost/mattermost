// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewActionRegistry(t *testing.T) {
	valid := ActionEntry{
		Name:         "run_test_action",
		ResourceType: AccessControlPolicyTypeSystem,
		Grantable:    true,
		Permissions:  []string{"test_permission_a", "test_permission_b"},
	}

	t.Run("indexes entries by name and permission", func(t *testing.T) {
		r, err := newActionRegistry([]ActionEntry{valid})
		require.NoError(t, err)
		require.Contains(t, r.byName, "run_test_action")
		require.Equal(t, "run_test_action", r.byPermission["test_permission_a"].Name)
		require.Equal(t, "run_test_action", r.byPermission["test_permission_b"].Name)
	})

	tests := []struct {
		name    string
		entries []ActionEntry
		errMsg  string
	}{
		{
			name:    "manage_system",
			entries: []ActionEntry{{Name: "run_admin", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{PermissionManageSystem.Id}}},
			errMsg:  "too broad",
		},
		{
			name:    "manage_roles",
			entries: []ActionEntry{{Name: "run_roles", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{PermissionManageRoles.Id}}},
			errMsg:  "too broad",
		},
		{
			name:    "assign system admin role",
			entries: []ActionEntry{{Name: "run_assign", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{PermissionAssignSystemAdminRole.Id}}},
			errMsg:  "too broad",
		},
		{
			name: "permission in two actions",
			entries: []ActionEntry{
				valid,
				{Name: "run_other_action", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{"test_permission_b"}},
			},
			errMsg: "already belongs",
		},
		{
			name:    "duplicate name",
			entries: []ActionEntry{valid, {Name: valid.Name, ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{"test_permission_c"}}},
			errMsg:  "more than once",
		},
		{
			name:    "unknown resource type",
			entries: []ActionEntry{{Name: "run_x", ResourceType: "post", Permissions: []string{"test_permission_a"}}},
			errMsg:  "unknown resource type",
		},
		{
			name:    "empty resource type",
			entries: []ActionEntry{{Name: "run_x", Permissions: []string{"test_permission_a"}}},
			errMsg:  "unknown resource type",
		},
		{
			name:    "invalid name",
			entries: []ActionEntry{{Name: "Run X", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{"test_permission_a"}}},
			errMsg:  "invalid action name",
		},
		{
			name:    "built-in action name",
			entries: []ActionEntry{{Name: AccessControlPolicyActionUploadFileAttachment, ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{"test_permission_a"}}},
			errMsg:  "built-in",
		},
		{
			name:    "no permissions",
			entries: []ActionEntry{{Name: "run_x", ResourceType: AccessControlPolicyTypeSystem}},
			errMsg:  "no permissions",
		},
		{
			name:    "empty permission",
			entries: []ActionEntry{{Name: "run_x", ResourceType: AccessControlPolicyTypeSystem, Permissions: []string{""}}},
			errMsg:  "empty permission",
		},
	}
	for _, tc := range tests {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			_, err := newActionRegistry(tc.entries)
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.errMsg)
		})
	}

	t.Run("the built-in registry is valid", func(t *testing.T) {
		_, err := newActionRegistry(registeredActions())
		require.NoError(t, err)
	})
}

func TestActionRegistryLookups(t *testing.T) {
	RegisterActionsForTesting(t,
		ActionEntry{Name: "run_system_action", ResourceType: AccessControlPolicyTypeSystem, Grantable: true, Permissions: []string{"perm_a", "perm_b"}},
		ActionEntry{Name: "run_channel_action", ResourceType: AccessControlPolicyTypeChannel, Permissions: []string{"perm_c"}},
	)

	entry, ok := ActionForPermission("perm_b")
	require.True(t, ok)
	assert.Equal(t, "run_system_action", entry.Name)
	assert.True(t, entry.Grantable)
	assert.Equal(t, []string{"perm_a", "perm_b"}, entry.Permissions)

	entry.Permissions[0] = "mutated"
	again, _ := ActionForPermission("perm_a")
	assert.Equal(t, "perm_a", again.Permissions[0], "callers must not be able to mutate the registry")

	_, ok = ActionForPermission("perm_unknown")
	assert.False(t, ok)

	assert.True(t, IsRegisteredAction("run_channel_action"))
	assert.False(t, IsRegisteredAction("perm_c"))

	names := func(entries []ActionEntry) []string {
		var out []string
		for _, e := range entries {
			out = append(out, e.Name)
		}
		return out
	}
	assert.Contains(t, names(RegisteredActionsForResourceType(AccessControlPolicyTypeSystem)), "run_system_action")
	assert.NotContains(t, names(RegisteredActionsForResourceType(AccessControlPolicyTypeSystem)), "run_channel_action")
	assert.Contains(t, names(RegisteredActionsForResourceType(AccessControlPolicyTypeChannel)), "run_channel_action")
}

func TestRegisteredActionPolicyValidation(t *testing.T) {
	RegisterActionsForTesting(t,
		ActionEntry{Name: "run_system_action", ResourceType: AccessControlPolicyTypeSystem, Grantable: true, Permissions: []string{"perm_a"}},
	)

	newPolicy := func(policyType, version string, actions ...string) *AccessControlPolicy {
		return &AccessControlPolicy{
			ID:      NewId(),
			Type:    policyType,
			Name:    "Delegation",
			Version: version,
			Roles:   []string{SystemUserRoleId},
			Rules: []AccessControlPolicyRule{{
				Actions:    actions,
				Expression: `user.attributes.department == "Compliance" && user.session.mdm_enrolled == "true"`,
			}},
		}
	}

	t.Run("v0.3 permission policy accepts a registered action", func(t *testing.T) {
		require.Nil(t, newPolicy(AccessControlPolicyTypePermission, AccessControlPolicyVersionV0_3, "run_system_action").IsValid())
	})

	t.Run("v0.3 permission policy accepts a registered action next to a built-in one", func(t *testing.T) {
		require.Nil(t, newPolicy(AccessControlPolicyTypePermission, AccessControlPolicyVersionV0_3, "run_system_action", AccessControlPolicyActionUploadFileAttachment).IsValid())
	})

	t.Run("v0.3 permission policy still requires a single role", func(t *testing.T) {
		policy := newPolicy(AccessControlPolicyTypePermission, AccessControlPolicyVersionV0_3, "run_system_action")
		policy.Roles = []string{SystemUserRoleId, SystemAdminRoleId}
		appErr := policy.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.access_policy.is_valid.roles.app_error", appErr.Id)
	})

	t.Run("v0.3 permission policy rejects an unregistered action", func(t *testing.T) {
		appErr := newPolicy(AccessControlPolicyTypePermission, AccessControlPolicyVersionV0_3, "run_unknown_action").IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.access_policy.is_valid.actions.app_error", appErr.Id)
	})

	t.Run("registered actions are rejected on non-permission policies", func(t *testing.T) {
		for _, policyType := range []string{AccessControlPolicyTypeParent, AccessControlPolicyTypeChannel, AccessControlPolicyTypeTeam} {
			appErr := newPolicy(policyType, AccessControlPolicyVersionV0_3, "run_system_action").IsValid()
			require.NotNil(t, appErr, policyType)
			require.Equal(t, "model.access_policy.is_valid.actions.app_error", appErr.Id, policyType)
		}
	})

	t.Run("v0.4 is unchanged and rejects registered actions", func(t *testing.T) {
		appErr := newPolicy(AccessControlPolicyTypePermission, AccessControlPolicyVersionV0_4, "run_system_action").IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.access_policy.is_valid.actions.app_error", appErr.Id)
	})
}

func TestActionSearchRequestSystemResource(t *testing.T) {
	for _, resourceType := range []string{AccessControlPolicyTypeSystem, AccessControlPolicyTypePermission} {
		req := ActionSearchRequest{Resource: Resource{Type: resourceType}}
		require.Nil(t, req.IsValid(), resourceType)
	}

	req := ActionSearchRequest{Resource: Resource{Type: AccessControlPolicyTypeChannel}}
	require.NotNil(t, req.IsValid(), "channel resources still require an ID")
}
