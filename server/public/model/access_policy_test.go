// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccessPolicyVersionV0_1(t *testing.T) {
	t.Run("invalid type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       "policy_id",
			Type:     "invalid_type",
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid type")
		require.Equal(t, "model.access_policy.is_valid.type.app_error", err.Id)
	})

	t.Run("invalid ID", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       "",
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid ID")
		require.Equal(t, "model.access_policy.is_valid.id.app_error", err.Id)
	})

	t.Run("parent policy with empty name", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for empty name in parent policy")
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
	})

	t.Run("parent policy with too long name", func(t *testing.T) {
		var longName strings.Builder
		for i := 0; i <= MaxPolicyNameLength; i++ {
			longName.WriteString("a")
		}

		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     longName.String(),
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for too long name in parent policy")
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
	})

	t.Run("negative revision", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: -1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for negative revision")
		require.Equal(t, "model.access_policy.is_valid.revision.app_error", err.Id)
	})

	t.Run("invalid version", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "invalid-version",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for invalid version")
		require.Equal(t, "model.access_policy.is_valid.version.app_error", err.Id)
	})

	t.Run("parent policy with no rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for parent policy with no rules")
		require.Equal(t, "model.access_policy.is_valid.rules.app_error", err.Id)
	})

	t.Run("parent policy with imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"some_import"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for parent policy with imports")
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("channel policy with no rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{},
			Imports:  []string{"parent_policy_id"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for channel policy with no rules")
		require.Equal(t, "model.access_policy.is_valid.rules.app_error", err.Id)
	})

	t.Run("channel policy with no imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for channel policy with no imports")
	})

	t.Run("channel policy with multiple imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"parent_policy_id1", "parent_policy_id2"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.NotNil(t, err, "Should return error for channel policy with multiple imports")
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("valid parent policy", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "v0.1",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for valid parent policy")
	})

	t.Run("valid channel policy", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Name:     "Test Policy",
			Revision: 1,
			Version:  "v0.1",
			Rules:    []AccessControlPolicyRule{{Actions: []string{"read"}, Expression: "user.role == 'admin'"}},
			Imports:  []string{"parent_policy_id"},
		}

		err := policy.accessPolicyVersionV0_1()
		require.Nil(t, err, "Should not return error for valid channel policy")
	})
}

func TestAccessControlPolicyValidateScope(t *testing.T) {
	validPolicy := func() *AccessControlPolicy {
		return &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Test Policy",
			Revision: 1,
			Version:  AccessControlPolicyVersionV0_1,
			Rules:    []AccessControlPolicyRule{{Actions: []string{"*"}, Expression: "true"}},
		}
	}

	t.Run("no scope fields set — valid", func(t *testing.T) {
		p := validPolicy()
		require.Nil(t, p.IsValid())
	})

	t.Run("scope=team with valid scope_id — valid", func(t *testing.T) {
		p := validPolicy()
		p.Scope = AccessControlPolicyScopeTeam
		p.ScopeID = NewId()
		require.Nil(t, p.IsValid())
	})

	t.Run("scope_id set without scope — invalid", func(t *testing.T) {
		p := validPolicy()
		p.ScopeID = NewId()
		err := p.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.scope_id_without_scope.app_error", err.Id)
	})

	t.Run("scope=team with empty scope_id — invalid", func(t *testing.T) {
		p := validPolicy()
		p.Scope = AccessControlPolicyScopeTeam
		p.ScopeID = ""
		err := p.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.scope_id.app_error", err.Id)
	})

	t.Run("unknown scope value — invalid", func(t *testing.T) {
		p := validPolicy()
		p.Scope = "unknown"
		p.ScopeID = NewId()
		err := p.IsValid()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.scope.app_error", err.Id)
	})
}

func TestAccessPolicyVersionV0_3(t *testing.T) {
	validRule := AccessControlPolicyRule{
		Actions:    []string{AccessControlPolicyActionMembership},
		Expression: "user.properties.dept == \"eng\"",
	}

	t.Run("valid parent type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions: []string{
					AccessControlPolicyActionMembership,
					AccessControlPolicyActionUploadFileAttachment,
					AccessControlPolicyActionDownloadFileAttachment,
				},
				Expression: "user.properties.dept == \"eng\"",
			}},
		}
		require.Nil(t, policy.accessPolicyVersionV0_3())
	})

	t.Run("valid channel type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Imports:  []string{NewId()},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		require.Nil(t, policy.accessPolicyVersionV0_3())
	})

	t.Run("valid permission type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		require.Nil(t, policy.accessPolicyVersionV0_3())
	})

	t.Run("invalid type", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     "unknown",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.type.app_error", err.Id)
	})

	t.Run("parent with no rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules:    []AccessControlPolicyRule{},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rules.app_error", err.Id)
	})

	t.Run("parent with non-empty imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules:    []AccessControlPolicyRule{validRule},
			Imports:  []string{NewId()},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("permission with empty roles", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.roles.app_error", err.Id)
	})

	t.Run("permission with blank role string", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{""},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.roles.app_error", err.Id)
	})

	t.Run("permission with multiple roles", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin", "system_user"},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.roles.app_error", err.Id)
	})

	t.Run("permission with imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules:    []AccessControlPolicyRule{validRule},
			Imports:  []string{NewId()},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.imports.app_error", err.Id)
	})

	t.Run("unrecognized action", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{"not_a_real_action"},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.actions.app_error", err.Id)
		require.Contains(t, err.DetailedError, "not_a_real_action")
	})

	t.Run("empty actions slice", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.actions.app_error", err.Id)
	})

	t.Run("channel with no rules and no imports", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rules_imports.app_error", err.Id)
	})
}

func TestInheritV0_3(t *testing.T) {
	t.Run("successful inherit", func(t *testing.T) {
		parentID := NewId()
		parent := &AccessControlPolicy{
			ID:       parentID,
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.Nil(t, err)
		require.Contains(t, child.Imports, parentID)
	})

	t.Run("duplicate import guard", func(t *testing.T) {
		parentID := NewId()
		parent := &AccessControlPolicy{
			ID:       parentID,
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Imports:  []string{parentID},
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.already_imported.app_error", err.Id)
	})

	t.Run("permission type child rejected", func(t *testing.T) {
		parent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.permission.app_error", err.Id)
	})

	t.Run("permission type parent rejected", func(t *testing.T) {
		parent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.permission.app_error", err.Id)
	})

	t.Run("non-v0.3 parent version rejected", func(t *testing.T) {
		parent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "V01 Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_1,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{"read"},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.version.app_error", err.Id)
	})
}
