// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// accessChannelHarness wires the pieces every access_channel test needs: an
// Enterprise Advanced licence, ABAC on, the feature flag on (which must come from
// SetupConfig — UpdateConfig silently drops FeatureFlags writes), and a request
// context carrying a real session so the session-subject build path works.
type accessChannelHarness struct {
	th   *TestHelper
	rctx request.CTX
}

func setupAccessChannelTest(t *testing.T) *accessChannelHarness {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.AccessChannelABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)

	return &accessChannelHarness{
		th:   th,
		rctx: WithChannelAccessMemo(th.Context.WithSession(session)),
	}
}

// mockACS installs a mock access control service that reports access_channel as
// governed and answers evaluations with the given decision.
func (h *accessChannelHarness) mockACS(t *testing.T) *eMocks.AccessControlServiceInterface {
	t.Helper()

	mockACS := &eMocks.AccessControlServiceInterface{}
	original := h.th.App.Srv().ch.AccessControl
	h.th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { h.th.App.Srv().ch.AccessControl = original })
	return mockACS
}

func governed(mockACS *eMocks.AccessControlServiceInterface) {
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionAccessChannel).
		Return(true, nil)
}

func decides(mockACS *eMocks.AccessControlServiceInterface, allow bool) {
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: allow}, nil)
}

func TestHasPermissionToAccessChannel(t *testing.T) {
	t.Run("allows when the action is not governed, without building a subject", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionAccessChannel).
			Return(false, nil)

		require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluates a channel with its own policy even when no system policy governs", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionAccessChannel).
			Return(false, nil)
		decides(mockACS, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true

		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, channel))
	})

	t.Run("evaluates anyway when the governance check errors", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionAccessChannel).
			Return(true, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
		decides(mockACS, false)

		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})

	t.Run("passes the PDP decision through", func(t *testing.T) {
		for _, allow := range []bool{true, false} {
			h := setupAccessChannelTest(t)
			mockACS := h.mockACS(t)
			governed(mockACS)
			decides(mockACS, allow)

			require.Equal(t, allow, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}
	})

	t.Run("fails closed when evaluation errors", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})

	t.Run("fails closed when the subject cannot be built", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)

		// A user that does not exist cannot have native attributes resolved, so
		// BuildAccessControlSubject aborts rather than evaluating against zeroes.
		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, model.NewId(), h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("memoises one decision per channel", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		for range 5 {
			require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})

	t.Run("evaluates every call when no memo is installed", func(t *testing.T) {
		// Background jobs and websocket fan-out build contexts with no memo; the
		// helper has to keep working, just without the collapsing.
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		session := h.rctx.Session()
		bare := h.th.Context.WithSession(session)
		for range 3 {
			require.True(t, h.th.App.HasPermissionToAccessChannel(bare, h.th.BasicUser.Id, h.th.BasicChannel))
		}
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 3)
	})

	t.Run("records the denial for the error contract", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, ChannelAccessDeniedByPolicy(h.rctx, h.th.BasicChannel.Id),
			"nothing evaluated yet")
		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.True(t, ChannelAccessDeniedByPolicy(h.rctx, h.th.BasicChannel.Id))
	})

	t.Run("does not record an allow as a denial", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.False(t, ChannelAccessDeniedByPolicy(h.rctx, h.th.BasicChannel.Id))
	})
}

func TestHasPermissionToAccessChannelShortCircuits(t *testing.T) {
	// Each of these must return true without touching the PDP at all, so the
	// feature is completely inert until deliberately enabled.
	cases := map[string]func(t *testing.T, h *accessChannelHarness) *model.Channel{
		"feature flag off": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			h.th.App.Srv().platform.SetConfigReadOnlyFF(false)
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.FeatureFlags.AccessChannelABACPermission = false
			})
			return h.th.BasicChannel
		},
		"ABAC disabled": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
			return h.th.BasicChannel
		},
		"unlicensed": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			h.th.App.Srv().SetLicense(nil)
			return h.th.BasicChannel
		},
		"direct message": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = model.ChannelTypeDirect
			return channel
		},
		"group message": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = model.ChannelTypeGroup
			return channel
		},
		"nil channel": func(t *testing.T, h *accessChannelHarness) *model.Channel {
			return nil
		},
	}

	for name, arrange := range cases {
		t.Run(name, func(t *testing.T) {
			h := setupAccessChannelTest(t)
			mockACS := h.mockACS(t)
			channel := arrange(t, h)

			require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, channel))
			mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
			mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		})
	}

	t.Run("no access control service", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		original := h.th.App.Srv().ch.AccessControl
		h.th.App.Srv().ch.AccessControl = nil
		t.Cleanup(func() { h.th.App.Srv().ch.AccessControl = original })

		require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})
}

func TestHasPermissionToAccessChannelByID(t *testing.T) {
	t.Run("allows a channel that does not exist", func(t *testing.T) {
		// The policy-administration endpoints pass policy IDs through the channel
		// gates; a team or parent policy ID has no channel behind it to govern.
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)

		require.True(t, h.th.App.hasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, model.NewId()))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("allows an empty channel id", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		require.True(t, h.th.App.hasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, ""))
	})

	t.Run("evaluates a channel that does exist", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.hasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id))
	})
}
