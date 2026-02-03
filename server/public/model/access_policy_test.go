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
