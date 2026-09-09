// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// The feature flag has to come from SetupConfig: UpdateConfig silently drops
// FeatureFlags writes, which would leave every test here passing vacuously.
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

		// A user that does not exist has no native attributes to resolve, so the
		// subject build aborts rather than evaluating against zeroes.
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
		// Background jobs and websocket fan-out build contexts with no memo.
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

	t.Run("does not reuse one user's decision for another", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == h.th.BasicUser.Id
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		require.True(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser2.Id, h.th.BasicChannel),
			"the second user must get their own decision, not the first user's")
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	// A channel a suppression path drops must not relabel an unrelated permission
	// error later in the same request.
	t.Run("the raw helper records nothing for the error contract", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx),
			"a suppression-path denial must not be reportable as the reason a request failed")
	})

	t.Run("an enforcement gate records the denial", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx), "nothing evaluated yet")

		ok, _ := h.th.App.SessionHasPermissionToReadChannel(h.rctx, *h.rctx.Session(), h.th.BasicChannel)
		require.False(t, ok)
		require.Equal(t, h.th.BasicChannel.Id, ChannelAccessEnforcementDenial(h.rctx))
	})

	t.Run("does not record an allow as a denial", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		ok, _ := h.th.App.SessionHasPermissionToReadChannel(h.rctx, *h.rctx.Session(), h.th.BasicChannel)
		require.True(t, ok)
		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx))
	})

	t.Run("a filter does not record an enforcement denial", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.Empty(t, h.th.App.FilterChannelsByAccess(h.rctx, h.th.BasicUser.Id, []*model.Channel{h.th.BasicChannel}),
			"the denied channel should be dropped")
		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx))

		require.Empty(t, h.th.App.FilterChannelIDsByAccess(h.rctx, h.th.BasicUser.Id, []string{h.th.BasicChannel.Id}))
		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx))
	})

	// Keeps push recipients, webhook owners and admin-acting-for-user evaluations
	// out of the requester's own error.
	t.Run("a third-party evaluation does not record", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.EnforceAccessChannel(h.rctx, h.th.BasicUser2.Id, h.th.BasicChannel))
		require.Empty(t, ChannelAccessEnforcementDenial(h.rctx),
			"the session user is the only one the response is about")
	})

	t.Run("the last denial wins", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.EnforceAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, h.th.BasicChannel.Id, ChannelAccessEnforcementDenial(h.rctx))

		second := h.th.CreateChannel(t, h.th.BasicTeam)
		require.False(t, h.th.App.EnforceAccessChannel(h.rctx, h.th.BasicUser.Id, second))
		require.Equal(t, second.Id, ChannelAccessEnforcementDenial(h.rctx),
			"when two channels are gated in sequence, the later denial is the one the request dies on")
	})
}

func TestHasPermissionToAccessChannelShortCircuits(t *testing.T) {
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
		// gates, and a team or parent policy has no channel behind it.
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)

		require.True(t, h.th.App.HasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, model.NewId()))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("allows an empty channel id", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		require.True(t, h.th.App.HasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, ""))
	})

	t.Run("evaluates a channel that does exist", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.HasPermissionToAccessChannelByID(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id))
	})
}

// A push carries the post body without the recipient asking for it, so a denied
// channel downgrades to an id-only payload rather than being suppressed. The device
// then fetches by id, and that fetch re-runs the gate live.
func TestBuildPushNotificationMessageAccessChannel(t *testing.T) {
	build := func(t *testing.T, h *accessChannelHarness) *model.PushNotification {
		t.Helper()
		msg, appErr := h.th.App.BuildPushNotificationMessage(
			h.rctx,
			model.FullNotification,
			h.th.BasicPost,
			h.th.BasicUser,
			h.th.BasicChannel,
			h.th.BasicChannel.Name,
			h.th.BasicUser.Username,
			true, false, "",
		)
		require.Nil(t, appErr)
		return msg
	}

	t.Run("a denied recipient gets no post content", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		msg := build(t, h)
		require.NotEmpty(t, msg.PostId, "the notification still goes out, just without the body")
		require.NotContains(t, msg.Message, h.th.BasicPost.Message)
	})

	t.Run("an allowed recipient gets the full content", func(t *testing.T) {
		h := setupAccessChannelTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		msg := build(t, h)
		require.Contains(t, msg.Message, h.th.BasicPost.Message)
	})
}

// A render "allowed" can never disagree with what enforcement would decide: the
// client lays out affordances from the render decision, so drift would offer a
// channel the gate then refuses, or hide one it would have allowed.
func TestAccessChannelRenderMatchesEnforcement(t *testing.T) {
	for _, want := range []bool{true, false} {
		t.Run(fmt.Sprintf("pdp=%v", want), func(t *testing.T) {
			h := setupAccessChannelTest(t)
			mockACS := h.mockACS(t)
			governed(mockACS)
			decides(mockACS, want)

			resp, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.rctx, model.ActionSearchRequest{
				Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id},
				Actions:  []string{model.AccessControlPolicyActionAccessChannel},
			})
			require.Nil(t, appErr)

			enforced := h.th.App.HasPermissionToAccessChannel(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel)
			require.Equal(t, want, enforced)
			require.Equal(t, enforced, resp.Decisions[model.AccessControlPolicyActionAccessChannel].Allowed)
		})
	}
}

func deniesChannel(mockACS *eMocks.AccessControlServiceInterface, channelID string) {
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Resource.ID == channelID
	})).Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)
}

// A denied channel must not shorten the page, because a short page is how a client
// recognises the end of the results — one denial would otherwise hide every channel
// after it. Pages may overlap once the server has read past offset+limit to fill one;
// what must not happen is losing a channel.
func TestGetPublicChannelsForTeamFillsPagesPastDeniedChannels(t *testing.T) {
	const perPage = 3

	// Denial positions relative to a page boundary: first of a page, last of a page,
	// and first of the page a top-up reads into.
	for _, deniedIndex := range []int{0, perPage - 1, perPage} {
		t.Run(fmt.Sprintf("denied index %d", deniedIndex), func(t *testing.T) {
			h := setupAccessChannelTest(t)
			team := h.th.CreateTeam(t)
			for range 6 {
				h.th.CreateChannel(t, team)
			}

			// The store's own ordering, read before any access control service exists.
			all, appErr := h.th.App.GetPublicChannelsForTeam(h.rctx, team.Id, 0, 100)
			require.Nil(t, appErr)
			require.Greater(t, len(all), perPage+deniedIndex)

			denied := all[deniedIndex]
			mockACS := h.mockACS(t)
			governed(mockACS)
			deniesChannel(mockACS, denied.Id)

			// Page by page number, the way a client does.
			seen := map[string]bool{}
			firstPageLen := -1
			for page := 0; page*perPage < len(all); page++ {
				got, appErr := h.th.App.GetPublicChannelsForTeam(h.rctx, team.Id, page*perPage, perPage)
				require.Nil(t, appErr)
				if page == 0 {
					firstPageLen = len(got)
				}
				for _, channel := range got {
					require.NotEqual(t, denied.Id, channel.Id, "a denied channel must never be served")
					seen[channel.Id] = true
				}
			}

			require.Equal(t, perPage, firstPageLen,
				"the first page must be topped up, or the client stops paginating here")

			for _, channel := range all {
				if channel.Id == denied.Id {
					continue
				}
				require.True(t, seen[channel.Id], "channel %q was lost while paginating", channel.DisplayName)
			}
		})
	}
}

func TestGetPublicChannelsForTeamGivesUpAfterMaxFillRounds(t *testing.T) {
	h := setupAccessChannelTest(t)
	team := h.th.CreateTeam(t)
	for range 4 {
		h.th.CreateChannel(t, team)
	}

	mockACS := h.mockACS(t)
	governed(mockACS)
	decides(mockACS, false)

	got, appErr := h.th.App.GetPublicChannelsForTeam(h.rctx, team.Id, 0, 2)
	require.Nil(t, appErr)
	require.Empty(t, got, "a page the policy empties must terminate rather than loop")
}
