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

// actionGoverned puts action in play at the system level, which is what wakes its
// gate up. Every other action counts as governed.
func actionGoverned(mockACS *eMocks.AccessControlServiceInterface, action string, governed bool) {
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, action).
		Return(governed, nil)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
}

// writeGoverned puts channel_write_access in play at the system level, which is
// what wakes the gate up.
func writeGoverned(mockACS *eMocks.AccessControlServiceInterface, governedByWrite bool) {
	actionGoverned(mockACS, model.AccessControlPolicyActionChannelWriteAccess, governedByWrite)
}

// managementGoverned puts channel_management_access in play at the system level.
func managementGoverned(mockACS *eMocks.AccessControlServiceInterface, governed bool) {
	actionGoverned(mockACS, model.AccessControlPolicyActionChannelManagementAccess, governed)
}

// decidesPerAction answers the channel-access actions separately, so a test can
// pin which one refused.
func decidesPerAction(mockACS *eMocks.AccessControlServiceInterface, allowRead, allowWrite, allowManagement bool) {
	for action, allow := range map[string]bool{
		model.AccessControlPolicyActionChannelReadAccess:       allowRead,
		model.AccessControlPolicyActionChannelWriteAccess:      allowWrite,
		model.AccessControlPolicyActionChannelManagementAccess: allowManagement,
	} {
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == action
		})).Return(model.AccessDecision{Decision: allow}, nil)
	}
}

// The rows of the spec's truth table, as the gate actually implements them: the
// write policy has to be in play at all before it can refuse, and the read policy
// has no say in writes.
func TestChannelWriteAccessTruthTable(t *testing.T) {
	for _, tc := range []struct {
		name        string
		governed    bool
		allowRead   bool
		allowWrite  bool
		wantAllowed bool
	}{
		{"ungoverned: no policy consulted", false, false, false, true},
		{"governed, both allow", true, true, true, true},
		{"governed, read denies", true, false, true, true},
		{"governed, write denies", true, true, false, false},
		{"governed, both deny", true, false, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			writeGoverned(mockACS, tc.governed)
			decidesPerAction(mockACS, tc.allowRead, tc.allowWrite, true)

			require.Equal(t, tc.wantAllowed,
				h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		})
	}
}

func TestChannelWriteAccessDecision(t *testing.T) {
	t.Run("skips the evaluation when no write policy governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false, false)

		require.False(t, h.th.BasicChannel.PolicyEnforced, "the channel must not carry its own policy for this to be meaningful")
		require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	for _, action := range []string{
		model.AccessControlPolicyActionChannelReadAccess,
		model.AccessControlPolicyActionChannelManagementAccess,
	} {
		t.Run("a channel policy carrying only "+action+" leaves writes alone", func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			writeGoverned(mockACS, false)
			decidesPerAction(mockACS, false, false, false)

			channel := h.th.BasicChannel.DeepCopy()
			channel.PolicyEnforced = true
			mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
				ID:   channel.Id,
				Type: model.AccessControlPolicyTypeChannel,
				Rules: []model.AccessControlPolicyRule{{
					Actions: []string{action},
				}},
			}, nil)

			require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel),
				"PolicyEnforced alone must not wake the write gate, or another action's policy would block posting")
		})
	}

	t.Run("a channel policy carrying the write action governs writes", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, false)
		decidesPerAction(mockACS, true, false, true)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
			ID:   channel.Id,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{{
				Actions: []string{model.AccessControlPolicyActionChannelWriteAccess},
			}},
		}, nil)

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel))
	})

	t.Run("evaluates anyway when the governance check errors", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).
			Return(false, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
		decidesPerAction(mockACS, true, false, true)

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("denies when the evaluation errors", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})

	t.Run("allows DMs and GMs without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false, false)

		for _, channelType := range []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup} {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = channelType
			require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, channel), string(channelType))
		}
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("allows a bot session without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false, false)

		session := h.rctx.Session().DeepCopy()
		session.Props[model.SessionPropIsBot] = model.SessionPropIsBotValue
		rctx := WithChannelAccessMemo(h.th.Context.WithSession(session))

		require.True(t, h.th.App.EnforceChannelWriteAccess(rctx, session.UserId, h.th.BasicChannel),
			"a bot has no interactive session, so a rule over user.session.* has nothing to evaluate")
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("memoises the decision for the request", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, true)

		for range 3 {
			require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}

		// One write evaluation, however many times it is asked, and no read evaluation.
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})
}

// The recorded denial names the write action, so the handler reports a write denial
// rather than a read one.
func TestEnforceChannelWriteAccessRecordsTheDenyingAction(t *testing.T) {
	t.Run("write policy refuses", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, false, true)

		require.False(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Equal(t, h.th.BasicChannel.Id, channelID)
		require.Equal(t, model.AccessControlPolicyActionChannelWriteAccess, action,
			"web.SetPermissionError switches on this to pick the write denial error id")
	})

	t.Run("a read denial does not refuse the write", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, false, true, true)

		require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, _ := ChannelAccessEnforcementDenial(h.rctx)
		require.Empty(t, channelID)
	})

	t.Run("records nothing when allowed", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		writeGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, true)

		require.True(t, h.th.App.EnforceChannelWriteAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Empty(t, channelID)
		require.Empty(t, action)
	})
}

// channel_management_access decides alone, like the write gate: neither the read nor
// the write policy has a say in managing a channel.
func TestChannelManagementAccessTruthTable(t *testing.T) {
	for _, tc := range []struct {
		name            string
		governed        bool
		allowRead       bool
		allowWrite      bool
		allowManagement bool
		wantAllowed     bool
	}{
		{"ungoverned: no policy consulted", false, false, false, false, true},
		{"governed, management allows", true, true, true, true, true},
		{"governed, management denies", true, true, true, false, false},
		{"governed, read and write deny", true, false, false, true, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			managementGoverned(mockACS, tc.governed)
			decidesPerAction(mockACS, tc.allowRead, tc.allowWrite, tc.allowManagement)

			require.Equal(t, tc.wantAllowed,
				h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		})
	}
}

func TestChannelManagementAccessDecision(t *testing.T) {
	t.Run("skips the evaluation when no management policy governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false, false)

		require.True(t, h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("a channel policy carrying only the write action leaves management alone", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
			ID:   channel.Id,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{{
				Actions: []string{model.AccessControlPolicyActionChannelWriteAccess},
			}},
		}, nil)

		require.True(t, h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, channel))
	})

	t.Run("a channel policy carrying the management action governs management", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, false)
		decidesPerAction(mockACS, true, true, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		mockACS.On("GetPolicy", mock.Anything, channel.Id).Return(&model.AccessControlPolicy{
			ID:   channel.Id,
			Type: model.AccessControlPolicyTypeChannel,
			Rules: []model.AccessControlPolicyRule{{
				Actions: []string{model.AccessControlPolicyActionChannelManagementAccess},
			}},
		}, nil)

		require.False(t, h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, channel))
	})

	t.Run("allows DMs and GMs without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false, false)

		for _, channelType := range []model.ChannelType{model.ChannelTypeDirect, model.ChannelTypeGroup} {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = channelType
			require.True(t, h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, channel), string(channelType))
		}
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluates a bot session", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, false)

		session := h.rctx.Session().DeepCopy()
		session.Props[model.SessionPropIsBot] = model.SessionPropIsBotValue
		rctx := WithChannelAccessMemo(h.th.Context.WithSession(session))

		require.False(t, h.th.App.EnforceChannelManagementAccess(rctx, session.UserId, h.th.BasicChannel),
			"unlike writes, managing a channel from a bot session is policy-gated")
	})

	t.Run("allows a system admin without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, false, false, false)

		session := h.rctx.Session().DeepCopy()
		session.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
		rctx := WithChannelAccessMemo(h.th.Context.WithSession(session))

		require.True(t, h.th.App.EnforceChannelManagementAccess(rctx, session.UserId, h.th.BasicChannel),
			"channel_management_access never binds manage_system")
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("memoises the decision for the request", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, true)

		for range 3 {
			require.True(t, h.th.App.EnforceChannelManagementAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}

		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})
}

func TestEnforceChannelManagementAccessRecordsTheDenyingAction(t *testing.T) {
	t.Run("management policy refuses", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, false)

		require.False(t, h.th.App.EnforceChannelManagementAccessByID(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Equal(t, h.th.BasicChannel.Id, channelID)
		require.Equal(t, model.AccessControlPolicyActionChannelManagementAccess, action,
			"web.SetPermissionError switches on this to pick the management denial error id")
	})

	t.Run("records nothing when allowed", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		decidesPerAction(mockACS, true, true, true)

		require.True(t, h.th.App.EnforceChannelManagementAccessByID(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id))

		channelID, action := ChannelAccessEnforcementDenial(h.rctx)
		require.Empty(t, channelID)
		require.Empty(t, action)
	})
}

// The invite endpoints hand back the subset of channels the inviter may still add
// members to, so the management gate has to filter rather than refuse -- and, like
// the read filters, record nothing: a filtered request succeeds, so there is no
// denial for SetPermissionError to report.
func TestFilterChannelIDsByManagementAccess(t *testing.T) {
	t.Run("drops only the denied channels", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		other := h.th.CreateChannel(t, h.th.BasicTeam)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, true)
		deniesChannel(mockACS, other.Id)

		kept := h.th.App.FilterChannelIDsByManagementAccess(h.rctx, h.th.BasicUser.Id, []string{h.th.BasicChannel.Id, other.Id})
		require.Equal(t, []string{h.th.BasicChannel.Id}, kept)

		channelID, _ := ChannelAccessEnforcementDenial(h.rctx)
		require.Empty(t, channelID, "a filter must not leave a witness behind; the request it feeds still succeeds")
	})

	t.Run("passes the list through when no management policy governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		managementGoverned(mockACS, false)
		decidesPerAction(mockACS, false, false, false)

		ids := []string{h.th.BasicChannel.Id}
		require.Equal(t, ids, h.th.App.FilterChannelIDsByManagementAccess(h.rctx, h.th.BasicUser.Id, ids))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}

// The layering guard. HasPermissionToChannel answers an RBAC question only: the
// channel-access policy is the API layer's to evaluate, because most of this
// function's callers are sessionless (the recap job, incoming webhooks,
// invite-token signup) or ask about a third-party user. If someone reinstates the
// ride-along that used to live here, every one of those paths silently starts
// evaluating a policy against the wrong subject -- so fail here instead.
func TestHasPermissionToChannelDoesNotEvaluatePolicy(t *testing.T) {
	for _, permission := range []*model.Permission{
		model.PermissionCreatePost,                    // write-classified
		model.PermissionReadChannel,                   // read-classified
		model.PermissionManagePublicChannelProperties, // management-classified
	} {
		t.Run(permission.Id, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			governed(mockACS)
			writeGoverned(mockACS, true)
			decides(mockACS, false)

			hasPermission, _ := h.th.App.HasPermissionToChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id, permission)
			require.True(t, hasPermission,
				"a denying policy must not affect the RBAC answer; add the gate to the api4 handler instead")
			mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		})
	}
}

// Inert until ABAC is enabled and licensed — checked one precondition at a time
// so a regression names which one broke.
func TestChannelWriteAccessGateIsInertUntilEnabled(t *testing.T) {
	t.Run("attribute-based access control disabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
		}).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		require.True(t, th.App.EnforceChannelWriteAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
		require.True(t, th.App.EnforceChannelManagementAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
	})

	t.Run("licence below Enterprise Advanced", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
		}).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})

		require.True(t, th.App.EnforceChannelWriteAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
		require.True(t, th.App.EnforceChannelManagementAccess(th.Context, th.BasicUser.Id, th.BasicChannel))
	})
}
