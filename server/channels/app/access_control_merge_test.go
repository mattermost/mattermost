// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestIsMembershipRule(t *testing.T) {
	t.Run("nil rule is not a membership rule", func(t *testing.T) {
		assert.False(t, isMembershipRule(nil))
	})

	t.Run("named rule with membership action is not a membership rule", func(t *testing.T) {
		// v0.4 permission rules always carry a Name; treat a non-empty Name as a
		// permission rule even if its Actions happen to mention membership, so a
		// rename can't accidentally collide with the membership slot.
		rule := &model.AccessControlPolicyRule{
			Name:    "Custom",
			Actions: []string{model.AccessControlPolicyActionMembership},
		}
		assert.False(t, isMembershipRule(rule))
	})

	t.Run("unnamed rule without membership action is not a membership rule", func(t *testing.T) {
		// Anonymous non-membership rules can't be safely identified across the
		// submit boundary; mergeStoredPolicyExpressions deliberately skips them
		// rather than mispair, so this helper must report false too.
		rule := &model.AccessControlPolicyRule{
			Actions: []string{model.AccessControlPolicyActionUploadFileAttachment},
		}
		assert.False(t, isMembershipRule(rule))
	})

	t.Run("unnamed rule with membership action is a membership rule", func(t *testing.T) {
		rule := &model.AccessControlPolicyRule{
			Actions: []string{model.AccessControlPolicyActionMembership},
		}
		assert.True(t, isMembershipRule(rule))
	})

	t.Run("unnamed rule with membership action among others is a membership rule", func(t *testing.T) {
		rule := &model.AccessControlPolicyRule{
			Actions: []string{
				model.AccessControlPolicyActionUploadFileAttachment,
				model.AccessControlPolicyActionMembership,
			},
		}
		assert.True(t, isMembershipRule(rule))
	})

	t.Run("empty actions list is not a membership rule", func(t *testing.T) {
		rule := &model.AccessControlPolicyRule{}
		assert.False(t, isMembershipRule(rule))
	})
}
