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
			Name:     "Permission",
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
			Name:     "Permission",
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
			Name:     "Permission",
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
			Name:     "Permission",
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
			Name:     "Permission",
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

	t.Run("permission with empty name", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Name:     "",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
	})

	t.Run("permission with name exceeding max length", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Name:     strings.Repeat("a", MaxPolicyNameLength+1),
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_admin"},
			Rules:    []AccessControlPolicyRule{validRule},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.name.app_error", err.Id)
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

	t.Run("membership rule rejects session attribute reference", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "user.session.ip_address == \"10.0.0.1\"",
			}},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.session_attribute_on_membership.app_error", err.Id)
	})

	t.Run("permission rule allows session attribute reference", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Name:     "Permission",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Roles:    []string{"system_user"},
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionUploadFileAttachment},
				Expression: "user.session.ip_address == \"10.0.0.1\"",
			}},
		}
		require.Nil(t, policy.accessPolicyVersionV0_3())
	})

	t.Run("mixed-action rule rejects session attribute reference", func(t *testing.T) {
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
				},
				Expression: "user.session.ip_address == \"10.0.0.1\"",
			}},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.session_attribute_on_membership.app_error", err.Id)
	})

	t.Run("membership rule without session reference is accepted", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "user.attributes.team == \"eng\"",
			}},
		}
		require.Nil(t, policy.accessPolicyVersionV0_3())
	})

	t.Run("membership rule rejects user.session inside string literal (lexical check)", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_3,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "user.attributes.note == \"see user.session for context\"",
			}},
		}
		err := policy.accessPolicyVersionV0_3()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.session_attribute_on_membership.app_error", err.Id)
	})
}

func TestAccessPolicyVersionV0_4(t *testing.T) {
	validMembership := AccessControlPolicyRule{
		Actions:    []string{AccessControlPolicyActionMembership},
		Expression: "user.attributes.dept == \"eng\"",
	}
	validPermission := func(name, role, action string) AccessControlPolicyRule {
		return AccessControlPolicyRule{
			Name:       name,
			Role:       role,
			Actions:    []string{action},
			Expression: "user.attributes.dept == \"eng\"",
		}
	}

	t.Run("valid channel policy with membership and permission rules", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{
				validMembership,
				validPermission("Block external uploads", ChannelUserRoleId, AccessControlPolicyActionUploadFileAttachment),
				validPermission("Admin overrides", ChannelAdminRoleId, AccessControlPolicyActionDownloadFileAttachment),
			},
		}
		require.Nil(t, policy.accessPolicyVersionV0_4())
	})

	t.Run("permission rule missing role rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Name:       "Block external uploads",
				Actions:    []string{AccessControlPolicyActionUploadFileAttachment},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rule_role.app_error", err.Id)
	})

	t.Run("permission rule with invalid role rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Name:       "Block external uploads",
				Role:       SystemUserRoleId, // wrong scope: must be channel role
				Actions:    []string{AccessControlPolicyActionUploadFileAttachment},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rule_role.app_error", err.Id)
	})

	t.Run("permission rule missing name rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Role:       ChannelUserRoleId,
				Actions:    []string{AccessControlPolicyActionUploadFileAttachment},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rule_name.app_error", err.Id)
	})

	t.Run("duplicate permission rule names rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{
				validPermission("Block uploads", ChannelUserRoleId, AccessControlPolicyActionUploadFileAttachment),
				validPermission("Block uploads", ChannelAdminRoleId, AccessControlPolicyActionDownloadFileAttachment),
			},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rule_name_unique.app_error", err.Id)
	})

	t.Run("membership combined with permission action rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Name:       "Combined",
				Role:       ChannelUserRoleId,
				Actions:    []string{AccessControlPolicyActionMembership, AccessControlPolicyActionUploadFileAttachment},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.actions.membership_combined.app_error", err.Id)
	})

	t.Run("membership rule with role rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Role:       ChannelUserRoleId,
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.rule_role.app_error", err.Id)
	})

	t.Run("permission rule on parent policy rejected", func(t *testing.T) {
		policy := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{
				validPermission("Block uploads", ChannelUserRoleId, AccessControlPolicyActionUploadFileAttachment),
			},
		}
		err := policy.accessPolicyVersionV0_4()
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.is_valid.actions.permission_type.app_error", err.Id)
	})
}

func TestInheritV0_4(t *testing.T) {
	t.Run("v0.4 child can import v0.4 parent", func(t *testing.T) {
		// Same-version happy path: a v0.4 channel policy importing
		// another v0.4 parent should be accepted (Inherit only blocks
		// v0.4 children importing pre-v0.3 parents).
		parentID := NewId()
		parent := &AccessControlPolicy{
			ID:       parentID,
			Type:     AccessControlPolicyTypeParent,
			Name:     "Parent V04",
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.Nil(t, err)
		require.Contains(t, child.Imports, parentID)
	})

	t.Run("v0.4 child can import v0.3 parent", func(t *testing.T) {
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
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.Nil(t, err)
		require.Contains(t, child.Imports, parentID)
	})

	t.Run("v0.4 child cannot import v0.1 parent", func(t *testing.T) {
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
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.version.app_error", err.Id)
	})

	t.Run("v0.4 child rejects permission-type parent", func(t *testing.T) {
		parent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Name:     "Permission",
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
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.permission.app_error", err.Id)
	})

	// v0.4 imports are strictly child-channel → parent-membership.
	// A channel→channel import would write a peer channel policy's ID
	// into Imports where the loader expects a membership parent — the
	// resulting evaluation would silently misroute. Reject up front.
	t.Run("v0.4 child rejects channel-type parent", func(t *testing.T) {
		parent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeChannel,
			Revision: 0,
			Version:  AccessControlPolicyVersionV0_4,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}

		err := child.Inherit(parent)
		require.NotNil(t, err)
		require.Equal(t, "model.access_policy.inherit.parent_type.app_error", err.Id)
		require.Empty(t, child.Imports, "rejected imports must not leak into the child's Imports slice")
	})
}

func TestSubjectRoleForScope(t *testing.T) {
	t.Run("scoped roles take precedence", func(t *testing.T) {
		s := &Subject{
			Role: SystemUserRoleId, // legacy field
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemAdminRoleId},
				{Scope: AccessControlSubjectScopeChannel, Role: ChannelAdminRoleId},
			},
		}
		require.Equal(t, SystemAdminRoleId, s.RoleForScope(AccessControlSubjectScopeSystem))
		require.Equal(t, ChannelAdminRoleId, s.RoleForScope(AccessControlSubjectScopeChannel))
	})

	t.Run("falls back to legacy Role for system scope when ScopedRoles empty", func(t *testing.T) {
		s := &Subject{Role: SystemAdminRoleId}
		require.Equal(t, SystemAdminRoleId, s.RoleForScope(AccessControlSubjectScopeSystem))
		require.Equal(t, "", s.RoleForScope(AccessControlSubjectScopeChannel))
	})

	t.Run("returns empty for unknown scope", func(t *testing.T) {
		s := &Subject{}
		require.Equal(t, "", s.RoleForScope("unknown"))
	})
}

func TestSubjectRolesForScope(t *testing.T) {
	t.Run("returns every entry matching the scope in order", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
				{Scope: AccessControlSubjectScopeChannel, Role: ChannelAdminRoleId},
				{Scope: AccessControlSubjectScopeSystem, Role: SystemAdminRoleId},
			},
		}
		require.Equal(t, []string{SystemUserRoleId, SystemAdminRoleId}, s.RolesForScope(AccessControlSubjectScopeSystem))
		require.Equal(t, []string{ChannelAdminRoleId}, s.RolesForScope(AccessControlSubjectScopeChannel))
	})

	t.Run("returns nil when no entry matches", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
			},
		}
		require.Nil(t, s.RolesForScope(AccessControlSubjectScopeChannel))
	})

	t.Run("does NOT fall back to legacy Role for system scope", func(t *testing.T) {
		s := &Subject{Role: SystemAdminRoleId}
		require.Nil(t, s.RolesForScope(AccessControlSubjectScopeSystem))
	})
}

func TestSubjectSetScopedRole(t *testing.T) {
	t.Run("appends when scope is absent", func(t *testing.T) {
		s := &Subject{}
		s.SetScopedRole(AccessControlSubjectScopeSystem, SystemUserRoleId)
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
		}, s.ScopedRoles)
	})

	t.Run("replaces in place when scope already exists", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
				{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
			},
		}
		s.SetScopedRole(AccessControlSubjectScopeSystem, SystemAdminRoleId)
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemAdminRoleId},
			{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
		}, s.ScopedRoles)
	})

	t.Run("collapses duplicate scope entries to one", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
				{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
				{Scope: AccessControlSubjectScopeSystem, Role: SystemGuestRoleId},
			},
		}
		s.SetScopedRole(AccessControlSubjectScopeSystem, SystemAdminRoleId)
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemAdminRoleId},
			{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
		}, s.ScopedRoles)
	})

	t.Run("empty role removes every entry for the scope", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
				{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
				{Scope: AccessControlSubjectScopeSystem, Role: SystemGuestRoleId},
			},
		}
		s.SetScopedRole(AccessControlSubjectScopeSystem, "")
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeChannel, Role: ChannelUserRoleId},
		}, s.ScopedRoles)
	})

	t.Run("empty role on absent scope is a no-op", func(t *testing.T) {
		s := &Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
			},
		}
		s.SetScopedRole(AccessControlSubjectScopeChannel, "")
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
		}, s.ScopedRoles)
	})

	t.Run("empty scope is a no-op", func(t *testing.T) {
		original := []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
		}
		s := &Subject{ScopedRoles: original}
		s.SetScopedRole("", SystemAdminRoleId)
		require.Equal(t, original, s.ScopedRoles)
	})

	t.Run("does not mutate aliased backing array", func(t *testing.T) {
		// Mirrors the attachChannelScopedRole hot path: a cached Subject is
		// passed by value, its ScopedRoles slice header is copied but the
		// backing array is shared. SetScopedRole must allocate a fresh array
		// so the cached Subject's ScopedRoles is not corrupted.
		cached := Subject{
			ScopedRoles: []ScopedRole{
				{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
			},
		}
		copyOfCached := cached
		copyOfCached.SetScopedRole(AccessControlSubjectScopeChannel, ChannelAdminRoleId)
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
		}, cached.ScopedRoles, "cached Subject's ScopedRoles must not be mutated")
		require.Equal(t, []ScopedRole{
			{Scope: AccessControlSubjectScopeSystem, Role: SystemUserRoleId},
			{Scope: AccessControlSubjectScopeChannel, Role: ChannelAdminRoleId},
		}, copyOfCached.ScopedRoles)
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

func TestIsValidTeamType(t *testing.T) {
	validID := NewId()

	t.Run("team type with rules only is valid", func(t *testing.T) {
		p := &AccessControlPolicy{
			ID:       validID,
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		require.Nil(t, p.IsValid())
	})

	t.Run("team type with imports only is valid", func(t *testing.T) {
		p := &AccessControlPolicy{
			ID:       validID,
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Imports:  []string{NewId()},
		}
		require.Nil(t, p.IsValid())
	})

	t.Run("team type with neither rules nor imports is invalid", func(t *testing.T) {
		p := &AccessControlPolicy{
			ID:       validID,
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
		}
		appErr := p.IsValid()
		require.NotNil(t, appErr)
		require.Equal(t, "model.access_policy.is_valid.rules_imports.app_error", appErr.Id)
	})
}

func TestInheritTeamType(t *testing.T) {
	makeParent := func() *AccessControlPolicy {
		return &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeParent,
			Name:     "TestParent",
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
	}

	t.Run("team child inherits from parent is ok", func(t *testing.T) {
		parent := makeParent()
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		err := child.Inherit(parent)
		require.Nil(t, err)
		require.Contains(t, child.Imports, parent.ID)
	})

	t.Run("team child inheriting from team policy returns 400", func(t *testing.T) {
		teamParent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Imports:  []string{NewId()},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		err := child.Inherit(teamParent)
		require.NotNil(t, err)
		require.Equal(t, 400, err.StatusCode)
	})

	t.Run("team child inheriting from permission policy returns 400", func(t *testing.T) {
		permParent := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypePermission,
			Name:     "PermParent",
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Roles:    []string{"system_admin"},
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		child := &AccessControlPolicy{
			ID:       NewId(),
			Type:     AccessControlPolicyTypeTeam,
			Version:  AccessControlPolicyVersionV0_3,
			Revision: 0,
			Rules: []AccessControlPolicyRule{{
				Actions:    []string{AccessControlPolicyActionMembership},
				Expression: "true",
			}},
		}
		err := child.Inherit(permParent)
		require.NotNil(t, err)
		require.Equal(t, 400, err.StatusCode)
	})
}
