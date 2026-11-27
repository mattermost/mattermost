// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// TestAccessDecisionCacheRenderSharesEntries checks that the render-decision API answers each
// action from the entries enforcement stored, and misses after an invalidation.
func TestAccessDecisionCacheRenderSharesEntries(t *testing.T) {
	for _, action := range cachedChannelActions {
		t.Run(action.action, func(t *testing.T) {
			h := setupActionCacheTest(t, action)
			decides(h.acs, true)
			render := func() bool {
				t.Helper()
				resp, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.th.Context.WithSession(h.session), model.ActionSearchRequest{
					Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id},
					Actions:  []string{action.action},
				})
				require.Nil(t, appErr)
				decision := resp.Decisions[action.action]
				require.True(t, decision.Evaluated)
				return decision.Allowed
			}

			require.True(t, h.check())
			require.Equal(t, 1, h.evaluations())
			require.True(t, render())
			require.Equal(t, 1, h.evaluations(), "render hits enforcement's entry")

			h.th.App.InvalidateAccessDecisionsForPolicyChange()
			require.True(t, render())
			require.Equal(t, 2, h.evaluations(), "render misses after an invalidation")
			require.True(t, h.check())
			require.Equal(t, 2, h.evaluations(), "enforcement hits the entry render filled")
		})
	}
}

// TestAccessDecisionCacheRenderAgreesWithEnforcement covers write and management on a channel
// governed only by a system policy, so enforcement evaluates a subject without the channel role.
// The PDP here allows only such a subject. Render used to evaluate one with the channel role;
// with one cache entry per (subject, channel, action), whichever filled it first decided both.
func TestAccessDecisionCacheRenderAgreesWithEnforcement(t *testing.T) {
	allowsWithoutChannelRole := func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
		for _, role := range req.Subject.ScopedRoles {
			if role.Scope == model.AccessControlSubjectScopeChannel {
				return model.AccessDecision{Decision: false}
			}
		}
		return model.AccessDecision{Decision: true}
	}

	for _, action := range []cachedChannelAction{cachedWriteAccess, cachedManagementAccess} {
		for _, renderFirst := range []bool{true, false} {
			name := action.action + ", enforcement first"
			if renderFirst {
				name = action.action + ", render first"
			}
			t.Run(name, func(t *testing.T) {
				h := setupActionCacheTest(t, action)
				h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(allowsWithoutChannelRole, nil)
				render := func() bool {
					resp, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.th.Context.WithSession(h.session), model.ActionSearchRequest{
						Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id},
						Actions:  []string{action.action},
					})
					require.Nil(t, appErr)
					return resp.Decisions[action.action].Allowed
				}

				var rendered, enforced bool
				if renderFirst {
					rendered = render()
					enforced = h.check()
				} else {
					enforced = h.check()
					rendered = render()
				}
				require.True(t, enforced, "enforcement evaluates the subject without the channel role")
				require.Equal(t, enforced, rendered)
				require.Equal(t, 1, h.evaluations(), "both read one entry")
			})
		}
	}
}
