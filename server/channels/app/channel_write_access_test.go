// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// writeGoverned puts channel_write_access in play at the system level, which is
// what wakes the gate up.
func writeGoverned(mockACS *eMocks.AccessControlServiceInterface, governedByWrite bool) {
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).
		Return(governedByWrite, nil)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
}

// decidesPerAction answers the two channel-access actions separately, so a test
// can pin which one refused.
func decidesPerAction(mockACS *eMocks.AccessControlServiceInterface, allowRead, allowWrite bool) {
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionChannelReadAccess
	})).Return(model.AccessDecision{Decision: allowRead}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionChannelWriteAccess
	})).Return(model.AccessDecision{Decision: allowWrite}, nil)
}

// The four rows of the spec's truth table, as the gate actually implements them:
// the write policy has to be in play at all before either policy can refuse.
func TestHasChannelWriteAccessTruthTable(t *testing.T) {
	for _, tc := range []struct {
		name        string
		governed    bool
		allowRead   bool
		allowWrite  bool
		wantAllowed bool
	}{
		{"ungoverned: neither policy consulted", false, false, false, true},
		{"governed, both allow", true, true, true, true},
		{"governed, read denies", true, false, true, false},
		{"governed, write denies", true, true, false, false},
		{"governed, both deny", true, false, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			writeGoverned(mockACS, tc.governed)
			decidesPerAction(mockACS, tc.allowRead, tc.allowWrite)

			require.Equal(t, tc.wantAllowed,
				h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		})
	}
}

func TestHasChannelWriteAccess(t *testing.T) {
	t.Run("skips both evaluations when no write policy governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false)

		require.False(t, h.th.BasicChannel.PolicyEnforced, "the channel must not carry its own policy for this to be meaningful")
		require.True(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("a channel policy carrying only the read action leaves writes alone", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
			ID:   channel.Id,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{{
				Actions: []string{model.AccessControlPolicyActionChannelReadAccess},
			}},
		}, nil)

		require.True(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel),
			"PolicyEnforced alone must not wake the write gate, or a read-only policy would block posting")
	})

	t.Run("a channel policy carrying the write action governs writes", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, false)
		decidesPerAction(mockACS, true, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
			ID:   channel.Id,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{{
				Actions: []string{model.AccessControlPolicyActionChannelWriteAccess},
			}},
		}, nil)

		require.False(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel))
	})

	t.Run("evaluates anyway when the governance check errors", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).
			Return(false, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
		decidesPerAction(mockACS, true, false)

		require.False(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("denies when the evaluation errors", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		require.False(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})

	t.Run("allows DMs and GMs without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false)

		for _, channelType := range []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup} {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = channelType
			require.True(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel), string(channelType))
		}
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("allows a bot session without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false)

		session := h.rctx.Session().DeepCopy()
		session.Props[model.SessionPropIsBot] = model.SessionPropIsBotValue
		rctx := WithChannelAccessMemo(h.th.Context.WithSession(session))

		require.True(t, h.th.App.HasChannelWriteAccess(rctx, session.UserId, h.th.BasicChannel),
			"a bot has no interactive session, so a rule over user.session.* has nothing to evaluate")
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("memoises the decision for the request", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true)

		for range 3 {
			require.True(t, h.th.App.HasChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}

		// One read plus one write evaluation, however many times it is asked.
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})
}

// The recorded denial names the action that actually refused, so the handler
// reports a read denial and a write denial differently.
func TestEnforceChannelWriteAccessRecordsTheDenyingAction(t *testing.T) {
	t.Run("write policy refuses", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, false)

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Equal(t, h.th.BasicChannel.Id, channelID)
		require.Equal(t, model.AccessControlPolicyActionChannelWriteAccess, action,
			"web.SetPermissionError switches on this to pick the write denial error id")
	})

	t.Run("read policy refuses", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, true)

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Equal(t, h.th.BasicChannel.Id, channelID)
		require.Equal(t, model.AccessControlPolicyActionChannelReadAccess, action,
			"a write refused by the read policy must report the read denial, not the write one")
	})

	t.Run("records nothing when allowed", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true)

		require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Empty(t, channelID)
		require.Empty(t, action)
	})
}

// Inert until the feature is flagged on, licensed and enabled — checked one
// precondition at a time so a regression names which one broke.
func TestChannelWriteAccessGateIsInertUntilEnabled(t *testing.T) {
	t.Run("feature flag off", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.FeatureFlags.ChannelAccessABACPermission = false
		}).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})

		require.True(t, th.App.HasChannelWriteAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
	})

	t.Run("attribute-based access control disabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.FeatureFlags.ChannelAccessABACPermission = true
		}).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		require.True(t, th.App.HasChannelWriteAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
	})

	t.Run("licence below Enterprise Advanced", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.FeatureFlags.ChannelAccessABACPermission = true
		}).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})

		require.True(t, th.App.HasChannelWriteAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
	})
}
