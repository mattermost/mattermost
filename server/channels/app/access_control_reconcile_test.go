// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSimulationReconcileSkipReason(t *testing.T) {
	channelID := model.NewId()

	reconcilablePolicy := func() *model.AccessControlPolicy {
		return &model.AccessControlPolicy{
			ID:      channelID,
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		}
	}

	testCases := []struct {
		name   string
		params model.PolicySimulationByUsersParams
		want   string
	}{
		{
			name: "saved, active, unmodified channel policy at scope=all is reconcilable",
			params: model.PolicySimulationByUsersParams{
				Policy:          reconcilablePolicy(),
				ChannelID:       channelID,
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: "",
		},
		{
			name: "this_rule scope deliberately drops peers and parents, so it is not comparable",
			params: model.PolicySimulationByUsersParams{
				Policy:          reconcilablePolicy(),
				ChannelID:       channelID,
				EvaluationScope: model.PolicyEvaluationScopeThisRule,
			},
			want: simulationReconcileSkipScopeNotAll,
		},
		{
			name: "empty scope normalizes to this_rule and is not comparable",
			params: model.PolicySimulationByUsersParams{
				Policy:    reconcilablePolicy(),
				ChannelID: channelID,
			},
			want: simulationReconcileSkipScopeNotAll,
		},
		{
			name: "nil policy",
			params: model.PolicySimulationByUsersParams{
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipNotChannelPolicy,
		},
		{
			name: "unsaved draft has no ID and is not in the PDP cache",
			params: model.PolicySimulationByUsersParams{
				Policy:          &model.AccessControlPolicy{Type: model.AccessControlPolicyTypeChannel, Active: true},
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipNotChannelPolicy,
		},
		{
			name: "permission-type policy has no channel resource to evaluate against",
			params: model.PolicySimulationByUsersParams{
				Policy:          &model.AccessControlPolicy{ID: model.NewId(), Type: model.AccessControlPolicyTypePermission, Active: true},
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipNotChannelPolicy,
		},
		{
			name: "parent-type policy is not anchored to a single channel",
			params: model.PolicySimulationByUsersParams{
				Policy:          &model.AccessControlPolicy{ID: model.NewId(), Type: model.AccessControlPolicyTypeParent, Active: true},
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipNotChannelPolicy,
		},
		{
			name: "channel_id pointing at a different channel than the policy",
			params: model.PolicySimulationByUsersParams{
				Policy:          reconcilablePolicy(),
				ChannelID:       model.NewId(),
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipChannelMismatch,
		},
		{
			name: "inactive policy is not enforced by the live PDP",
			params: model.PolicySimulationByUsersParams{
				Policy: &model.AccessControlPolicy{
					ID:     channelID,
					Type:   model.AccessControlPolicyTypeChannel,
					Active: false,
				},
				ChannelID:       channelID,
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: simulationReconcileSkipInactivePolicy,
		},
		{
			name: "absent channel_id falls back to the policy ID as the resource",
			params: model.PolicySimulationByUsersParams{
				Policy:          reconcilablePolicy(),
				EvaluationScope: model.PolicyEvaluationScopeAll,
			},
			want: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, simulationReconcileSkipReason(tc.params))
		})
	}
}

func TestPolicyProgramsEquivalent(t *testing.T) {
	base := func() *model.AccessControlPolicy {
		return &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "stored name",
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_4,
			Imports: []string{"parent-1"},
			Roles:   []string{"system_user"},
			Rules: []model.AccessControlPolicyRule{{
				Name:       "rule-a",
				Role:       model.ChannelUserRoleId,
				Actions:    []string{model.AccessControlPolicyActionUploadFileAttachment},
				Expression: `user.attributes.dept == "eng"`,
			}},
		}
	}

	t.Run("identical policies are equivalent", func(t *testing.T) {
		assert.True(t, policyProgramsEquivalent(base(), base()))
	})

	t.Run("presentation-only differences do not matter", func(t *testing.T) {
		draft := base()
		draft.Name = "renamed in the editor"
		draft.Revision = 42
		draft.CreateAt = 1234
		draft.Props = map[string]any{"unrelated": true}
		assert.True(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("edited expression is detected", func(t *testing.T) {
		draft := base()
		draft.Rules[0].Expression = `user.attributes.dept == "sales"`
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("edited rule role is detected", func(t *testing.T) {
		draft := base()
		draft.Rules[0].Role = model.ChannelAdminRoleId
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("renamed rule is detected because blame is attributed by name", func(t *testing.T) {
		draft := base()
		draft.Rules[0].Name = "rule-b"
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("added rule is detected", func(t *testing.T) {
		draft := base()
		draft.Rules = append(draft.Rules, model.AccessControlPolicyRule{Name: "rule-b", Expression: "true"})
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("changed actions are detected", func(t *testing.T) {
		draft := base()
		draft.Rules[0].Actions = []string{model.AccessControlPolicyActionDownloadFileAttachment}
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("changed imports are detected", func(t *testing.T) {
		draft := base()
		draft.Imports = []string{"parent-2"}
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("changed roles are detected", func(t *testing.T) {
		draft := base()
		draft.Roles = []string{"system_admin"}
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("toggled active is detected", func(t *testing.T) {
		draft := base()
		draft.Active = false
		assert.False(t, policyProgramsEquivalent(base(), draft))
	})

	t.Run("nil operands are never equivalent", func(t *testing.T) {
		assert.False(t, policyProgramsEquivalent(nil, base()))
		assert.False(t, policyProgramsEquivalent(base(), nil))
	})
}

func TestHasSimulationOnlyBlame(t *testing.T) {
	t.Run("synthetic sources the PDP never emits are recognised", func(t *testing.T) {
		for _, source := range []string{
			model.PolicySimulationBlameSourceNoApplicablePolicy,
			model.PolicySimulationBlameSourceNoApplicableRule,
			model.PolicySimulationBlameSourceNoSessionData,
			model.PolicySimulationBlameSourceSiblingSaved,
		} {
			assert.True(t, hasSimulationOnlyBlame([]model.PolicySimulationBlame{{Source: source}}), source)
		}
	})

	t.Run("real blame sources are comparable", func(t *testing.T) {
		for _, source := range []string{
			model.PolicySimulationBlameSourceThisRule,
			model.PolicySimulationBlameSourceSiblingRule,
			model.PolicySimulationBlameSourcePeerPolicy,
			model.PolicySimulationBlameSourceSystemPermission,
			model.PolicySimulationBlameSourceChannelPolicy,
		} {
			assert.False(t, hasSimulationOnlyBlame([]model.PolicySimulationBlame{{Source: source}}), source)
		}
	})

	t.Run("empty blame is comparable", func(t *testing.T) {
		assert.False(t, hasSimulationOnlyBlame(nil))
	})
}

func TestMergeSessionAttributes(t *testing.T) {
	t.Run("overrides shadow the caller session baseline without discarding the rest", func(t *testing.T) {
		merged := mergeSessionAttributes(
			map[string]any{"ip_address": "10.0.0.1", "device_managed": true},
			map[string]any{"ip_address": "192.168.1.1"},
		)
		assert.Equal(t, map[string]any{"ip_address": "192.168.1.1", "device_managed": true}, merged)
	})

	t.Run("nil inputs produce an empty map rather than a nil one", func(t *testing.T) {
		assert.Equal(t, map[string]any{}, mergeSessionAttributes(nil, nil))
	})
}

// reconcileTestHarness wires a simulate response and a mocked access control
// service so a test can assert which decisions get replayed through the live
// PDP and what the reconciliation records.
type reconcileTestHarness struct {
	th      *TestHelper
	mockACS *mocks.AccessControlServiceInterface
	policy  *model.AccessControlPolicy
	params  model.PolicySimulationByUsersParams
	resp    *model.PolicySimulationResponse
}

func setupReconcileTest(t *testing.T, simulatedDecision bool) *reconcileTestHarness {
	t.Helper()

	th := Setup(t).InitBasic(t)

	policy := &model.AccessControlPolicy{
		ID:      th.BasicChannel.Id,
		Type:    model.AccessControlPolicyTypeChannel,
		Active:  true,
		Version: model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.dept == "eng"`},
		},
	}

	mockACS := &mocks.AccessControlServiceInterface{}
	originalACS := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })

	// Stored policy matches the draft, so the PDP cache holds the same
	// compiled programs and the two lanes are comparable. Deep-copy the rules
	// so a test that edits the draft doesn't also edit what the store returns.
	stored := *policy
	stored.Rules = append([]model.AccessControlPolicyRule(nil), policy.Rules...)
	mockACS.On("GetPolicy", mock.Anything, policy.ID).Return(&stored, nil).Maybe()
	mockACS.On("NormalizePolicy", mock.Anything, mock.Anything).Return(&stored, nil).Maybe()

	return &reconcileTestHarness{
		th:      th,
		mockACS: mockACS,
		policy:  policy,
		params: model.PolicySimulationByUsersParams{
			Policy:          policy,
			ChannelID:       th.BasicChannel.Id,
			Actions:         []string{model.AccessControlPolicyActionMembership},
			EvaluationScope: model.PolicyEvaluationScopeAll,
			Users:           []model.PolicySimulationUserOverride{{UserID: th.BasicUser.Id}},
		},
		resp: &model.PolicySimulationResponse{
			Total: 1,
			Results: []model.PolicySimulationUserResult{{
				User: th.BasicUser,
				Decisions: map[string]model.PolicySimulationActionDecision{
					model.AccessControlPolicyActionMembership: {Decision: simulatedDecision},
				},
			}},
		},
	}
}

func (h *reconcileTestHarness) membershipDecision() model.PolicySimulationActionDecision {
	return h.resp.Results[0].Decisions[model.AccessControlPolicyActionMembership]
}

func divergenceBlame(decision model.PolicySimulationActionDecision) *model.PolicySimulationBlame {
	for i, b := range decision.Blame {
		if b.Source == model.PolicySimulationBlameSourceDivergence {
			return &decision.Blame[i]
		}
	}
	return nil
}

func TestReconcileSimulationWithLiveEvaluation(t *testing.T) {
	t.Run("simulated allow that production denies is flagged as a divergence", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == h.th.BasicUser.Id &&
				req.Resource.ID == h.th.BasicChannel.Id &&
				req.Resource.Type == model.AccessControlPolicyTypeChannel &&
				req.Action == model.AccessControlPolicyActionMembership
		})).Return(model.AccessDecision{Decision: false}, nil).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		decision := h.membershipDecision()
		blame := divergenceBlame(decision)
		require.NotNil(t, blame, "expected a divergence blame entry")
		// Outcome carries the LIVE verdict so the picker can tell the author
		// which way production would actually rule.
		assert.Equal(t, model.PolicySimulationBlameOutcomeDeny, blame.Outcome)
		// The simulator's verdict is flagged, not rewritten — the author still
		// sees what the simulator produced alongside the warning.
		assert.True(t, decision.Decision)
		h.mockACS.AssertExpectations(t)
	})

	t.Run("simulated deny that production allows is flagged as a divergence", func(t *testing.T) {
		h := setupReconcileTest(t, false)
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, nil).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		blame := divergenceBlame(h.membershipDecision())
		require.NotNil(t, blame)
		assert.Equal(t, model.PolicySimulationBlameOutcomeAllow, blame.Outcome)
		h.mockACS.AssertExpectations(t)
	})

	t.Run("agreeing lanes leave the decision untouched", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, nil).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		decision := h.membershipDecision()
		assert.Nil(t, divergenceBlame(decision))
		assert.Empty(t, decision.Blame)
		assert.True(t, decision.Decision)
		h.mockACS.AssertExpectations(t)
	})

	t.Run("existing blame is preserved alongside the divergence entry", func(t *testing.T) {
		h := setupReconcileTest(t, false)
		h.resp.Results[0].Decisions[model.AccessControlPolicyActionMembership] = model.PolicySimulationActionDecision{
			Decision: false,
			Blame:    []model.PolicySimulationBlame{{Source: model.PolicySimulationBlameSourceThisRule, RuleName: "rule-a"}},
		}
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, nil).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		decision := h.membershipDecision()
		require.Len(t, decision.Blame, 2)
		assert.Equal(t, model.PolicySimulationBlameSourceThisRule, decision.Blame[0].Source)
		assert.Equal(t, model.PolicySimulationBlameSourceDivergence, decision.Blame[1].Source)
	})

	t.Run("simulation-only verdicts are not replayed through the PDP", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.resp.Results[0].Decisions[model.AccessControlPolicyActionMembership] = model.PolicySimulationActionDecision{
			Decision: true,
			Blame:    []model.PolicySimulationBlame{{Source: model.PolicySimulationBlameSourceNoApplicablePolicy}},
		}

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		h.mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		assert.Nil(t, divergenceBlame(h.membershipDecision()))
	})

	t.Run("a live evaluation error is not reported as a divergence", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError)).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		assert.Nil(t, divergenceBlame(h.membershipDecision()))
		h.mockACS.AssertExpectations(t)
	})

	t.Run("an edited draft is not compared against stale cached programs", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.policy.Rules[0].Expression = `user.attributes.dept == "sales"`

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		h.mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		assert.Nil(t, divergenceBlame(h.membershipDecision()))
	})

	t.Run("this_rule scope short-circuits before touching the store", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.params.EvaluationScope = model.PolicyEvaluationScopeThisRule

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		h.mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
		h.mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("a policy missing from the store is not reconciled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })

		policy := &model.AccessControlPolicy{ID: th.BasicChannel.Id, Type: model.AccessControlPolicyTypeChannel, Active: true}
		mockACS.On("GetPolicy", mock.Anything, policy.ID).
			Return(nil, model.NewAppError("GetPolicy", "not found", nil, "", http.StatusNotFound)).Once()

		resp := &model.PolicySimulationResponse{Results: []model.PolicySimulationUserResult{{
			User:      th.BasicUser,
			Decisions: map[string]model.PolicySimulationActionDecision{model.AccessControlPolicyActionMembership: {Decision: true}},
		}}}

		th.App.reconcileSimulationWithLiveEvaluation(th.Context, model.PolicySimulationByUsersParams{
			Policy:          policy,
			ChannelID:       th.BasicChannel.Id,
			EvaluationScope: model.PolicyEvaluationScopeAll,
		}, resp)

		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		mockACS.AssertExpectations(t)
	})

	t.Run("an empty response is handled without touching the service", func(t *testing.T) {
		h := setupReconcileTest(t, true)

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, &model.PolicySimulationResponse{})
		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, nil)

		h.mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
		h.mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("session overrides are applied to the subject so both lanes see identical input", func(t *testing.T) {
		h := setupReconcileTest(t, true)
		h.params.Users = []model.PolicySimulationUserOverride{{
			UserID:           h.th.BasicUser.Id,
			SessionOverrides: map[string]any{"network_status": "vpn"},
		}}
		h.mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.Session["network_status"] == "vpn"
		})).Return(model.AccessDecision{Decision: true}, nil).Once()

		h.th.App.reconcileSimulationWithLiveEvaluation(h.th.Context, h.params, h.resp)

		h.mockACS.AssertExpectations(t)
	})

	t.Run("no access control service means no reconciliation", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = nil
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })

		resp := &model.PolicySimulationResponse{Results: []model.PolicySimulationUserResult{{
			User:      th.BasicUser,
			Decisions: map[string]model.PolicySimulationActionDecision{model.AccessControlPolicyActionMembership: {Decision: true}},
		}}}

		require.NotPanics(t, func() {
			th.App.reconcileSimulationWithLiveEvaluation(th.Context, model.PolicySimulationByUsersParams{
				Policy:          &model.AccessControlPolicy{ID: th.BasicChannel.Id, Type: model.AccessControlPolicyTypeChannel, Active: true},
				EvaluationScope: model.PolicyEvaluationScopeAll,
			}, resp)
		})
		assert.Nil(t, divergenceBlame(resp.Results[0].Decisions[model.AccessControlPolicyActionMembership]))
	})
}

// TestSimulateAccessControlPolicyForUsersReconciles exercises the public entry
// point rather than the reconciliation helper directly, so a future refactor
// that drops the hook from SimulateAccessControlPolicyForUsers fails here.
func TestSimulateAccessControlPolicyForUsersReconciles(t *testing.T) {
	setup := func(t *testing.T, liveDecision bool) (*TestHelper, request.CTX, *mocks.AccessControlServiceInterface, model.PolicySimulationByUsersParams) {
		t.Helper()

		// Masking is exercised by access_control_masking_test.go; keep the
		// re-injection path out of scope so this test is about the hook.
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.AttributeValueMasking = false
		}).InitBasic(t)

		policy := &model.AccessControlPolicy{
			ID:      th.BasicChannel.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Active:  true,
			Version: model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: `user.attributes.dept == "eng"`},
			},
		}
		stored := *policy
		stored.Rules = append([]model.AccessControlPolicyRule(nil), policy.Rules...)

		mockACS := &mocks.AccessControlServiceInterface{}
		originalACS := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = originalACS })

		// The simulator allows the user...
		mockACS.On("SimulatePolicyForUsers", mock.Anything, mock.Anything).Return(&model.PolicySimulationResponse{
			Total: 1,
			Results: []model.PolicySimulationUserResult{{
				User: th.BasicUser,
				Decisions: map[string]model.PolicySimulationActionDecision{
					model.AccessControlPolicyActionMembership: {Decision: true},
				},
			}},
		}, nil).Once()
		mockACS.On("GetPolicy", mock.Anything, policy.ID).Return(&stored, nil).Maybe()
		mockACS.On("NormalizePolicy", mock.Anything, mock.Anything).Return(&stored, nil).Maybe()
		// ...while the live PDP rules the other way.
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: liveDecision}, nil).Once()

		rctx := th.Context.WithSession(&model.Session{
			Id:     model.NewId(),
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		return th, rctx, mockACS, model.PolicySimulationByUsersParams{
			Policy:          policy,
			ChannelID:       th.BasicChannel.Id,
			Actions:         []string{model.AccessControlPolicyActionMembership},
			EvaluationScope: model.PolicyEvaluationScopeAll,
			Users:           []model.PolicySimulationUserOverride{{UserID: th.BasicUser.Id}},
		}
	}

	t.Run("a disagreement reaches the response the picker renders", func(t *testing.T) {
		th, rctx, mockACS, params := setup(t, false)

		resp, appErr := th.App.SimulateAccessControlPolicyForUsers(rctx, params)

		// The request still succeeds — a divergence is a warning about the
		// preview, not a reason to deny the author the rest of the results.
		require.Nil(t, appErr)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 1)

		blame := divergenceBlame(resp.Results[0].Decisions[model.AccessControlPolicyActionMembership])
		require.NotNil(t, blame, "the simulate entry point must reconcile against the live PDP")
		assert.Equal(t, model.PolicySimulationBlameOutcomeDeny, blame.Outcome)
		mockACS.AssertExpectations(t)
	})

	t.Run("agreeing lanes leave the response clean", func(t *testing.T) {
		th, rctx, mockACS, params := setup(t, true)

		resp, appErr := th.App.SimulateAccessControlPolicyForUsers(rctx, params)

		require.Nil(t, appErr)
		require.NotNil(t, resp)
		assert.Nil(t, divergenceBlame(resp.Results[0].Decisions[model.AccessControlPolicyActionMembership]))
		mockACS.AssertExpectations(t)
	})
}
