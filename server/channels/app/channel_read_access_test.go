// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	putils "github.com/mattermost/mattermost/server/public/utils"
	emailmocks "github.com/mattermost/mattermost/server/v8/channels/app/email/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func channelAccessDenialChannelID(rctx request.CTX) string {
	channelID, _ := ChannelAccessEnforcementDenial(rctx)
	return channelID
}

// The umbrella feature flag has to come from SetupConfig: UpdateConfig silently
// drops FeatureFlags writes, which would leave every test here passing vacuously.
type channelReadAccessHarness struct {
	th   *TestHelper
	rctx request.CTX
}

func setupChannelReadAccessTest(t *testing.T) *channelReadAccessHarness {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelPermissionActions = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)

	return &channelReadAccessHarness{
		th:   th,
		rctx: WithChannelAccessMemo(th.Context.WithSession(session)),
	}
}

func (h *channelReadAccessHarness) mockACS(t *testing.T) *eMocks.AccessControlServiceInterface {
	t.Helper()

	mockACS := &eMocks.AccessControlServiceInterface{}
	original := h.th.App.Srv().ch.AccessControl
	h.th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { h.th.App.Srv().ch.AccessControl = original })
	return mockACS
}

func governed(mockACS *eMocks.AccessControlServiceInterface) {
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
		Return(true, nil)
}

func channelPolicyGoverns(mockACS *eMocks.AccessControlServiceInterface, channelID string, governs bool) {
	mockACS.On("ResourcePolicyGovernsAction", mock.Anything, channelID, model.AccessControlPolicyActionChannelReadAccess).
		Return(governs, nil)
}

// capturesRequests answers every evaluation with allow and records each request, so a
// test can inspect the subject the gate built.
func capturesRequests(mockACS *eMocks.AccessControlServiceInterface, allow bool) *[]model.AccessRequest {
	var requests []model.AccessRequest
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Run(func(args mock.Arguments) {
			requests = append(requests, args.Get(1).(model.AccessRequest))
		}).
		Return(model.AccessDecision{Decision: allow}, nil)
	return &requests
}

func decides(mockACS *eMocks.AccessControlServiceInterface, allow bool) {
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: allow}, nil)
}

func TestHasChannelReadAccess(t *testing.T) {
	t.Run("allows when the action is not governed, without building a subject", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "ResourcePolicyGovernsAction", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("evaluates a channel whose own policy declares the action, even when no system policy governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)
		channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, true)
		decides(mockACS, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true

		require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
	})

	// PolicyEnforced is true for a channel with any policy, so a membership-only policy
	// must not cost every reader a subject build and a PDP call.
	t.Run("allows a channel whose own policy does not declare the action, without building a subject", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)
		channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluates anyway when the channel policy check errors", func(t *testing.T) {
		// Both answers occur: the enterprise service reports governed with every error,
		// and false alongside an error must not read as an all-clear either.
		for _, reported := range []bool{true, false} {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
				Return(false, nil)
			mockACS.On("ResourcePolicyGovernsAction", mock.Anything, h.th.BasicChannel.Id, model.AccessControlPolicyActionChannelReadAccess).
				Return(reported, model.NewAppError("ResourcePolicyGovernsAction", "boom", nil, "", http.StatusInternalServerError))
			decides(mockACS, false)

			channel := h.th.BasicChannel.DeepCopy()
			channel.PolicyEnforced = true

			require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel), "reported=%t", reported)
			mockACS.AssertCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		}
	})

	// Only the channel's own policy picks rules by channel role, so the role is looked up
	// only when that policy declares the action, whatever a system policy says.
	t.Run("leaves the channel role out when only a system policy governs", func(t *testing.T) {
		for _, policyEnforced := range []bool{false, true} {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			governed(mockACS)
			channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, false)
			requests := capturesRequests(mockACS, true)

			channel := h.th.BasicChannel.DeepCopy()
			channel.PolicyEnforced = policyEnforced

			require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
			require.Len(t, *requests, 1)
			require.Empty(t, (*requests)[0].Subject.RoleForScope(model.AccessControlSubjectScopeChannel), "policyEnforced=%t", policyEnforced)
			if !policyEnforced {
				mockACS.AssertNotCalled(t, "ResourcePolicyGovernsAction", mock.Anything, mock.Anything, mock.Anything)
			}
		}
	})

	t.Run("adds the channel role when the channel's own policy declares the action", func(t *testing.T) {
		for _, bySystemPolicy := range []bool{false, true} {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
				Return(bySystemPolicy, nil)
			channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, true)
			requests := capturesRequests(mockACS, true)

			channel := h.th.BasicChannel.DeepCopy()
			channel.PolicyEnforced = true

			wantRole, appErr := h.th.App.GetSubjectChannelRole(h.rctx, h.th.BasicUser.Id, channel.Id)
			require.Nil(t, appErr)
			require.NotEmpty(t, wantRole, "BasicUser must be a member of BasicChannel for this to be meaningful")

			require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
			require.Len(t, *requests, 1)
			require.Equal(t, wantRole, (*requests)[0].Subject.RoleForScope(model.AccessControlSubjectScopeChannel), "bySystemPolicy=%t", bySystemPolicy)
		}
	})

	// A failed governance check says nothing about whether a policy applies. Short-
	// circuiting to "allowed" there would let a transient store failure bypass every
	// policy on channels that do not set PolicyEnforced.
	t.Run("evaluates anyway when the governance check errors", func(t *testing.T) {
		// Both answers occur: the enterprise service reports governed with every error,
		// and false alongside an error must not read as an all-clear either.
		for _, reported := range []bool{true, false} {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
				Return(reported, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
			decides(mockACS, false)

			require.False(t, h.th.BasicChannel.PolicyEnforced, "the channel must not carry its own policy for this to be meaningful")
			require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel), "reported=%t", reported)
			mockACS.AssertCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		}
	})

	t.Run("passes the PDP decision through", func(t *testing.T) {
		for _, allow := range []bool{true, false} {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			governed(mockACS)
			decides(mockACS, allow)

			require.Equal(t, allow, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}
	})

	t.Run("fails closed when evaluation errors", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})

	t.Run("fails closed when the subject cannot be built", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)

		// A user that does not exist has no native attributes to resolve, so the
		// subject build aborts rather than evaluating against zeroes.
		require.False(t, h.th.App.HasChannelReadAccess(h.rctx, model.NewId(), h.th.BasicChannel))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("memoises one decision per channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		for range 5 {
			require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		}
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})

	t.Run("evaluates every call when no memo is installed", func(t *testing.T) {
		// Background jobs and websocket fan-out build contexts with no memo.
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		session := h.rctx.Session()
		bare := h.th.Context.WithSession(session)
		for range 3 {
			require.True(t, h.th.App.HasChannelReadAccess(bare, h.th.BasicUser.Id, h.th.BasicChannel))
		}
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 3)
	})

	t.Run("does not reuse one user's decision for another", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == h.th.BasicUser.Id
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser2.Id, h.th.BasicChannel),
			"the second user must get their own decision, not the first user's")
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	// A channel a suppression path drops must not relabel an unrelated permission
	// error later in the same request.
	t.Run("non-enforcing paths record nothing", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Empty(t, channelAccessDenialChannelID(h.rctx),
			"a suppression-path denial must not be reportable as the reason a request failed")

		require.Empty(t, h.th.App.FilterChannelsByReadAccess(h.rctx, h.th.BasicUser.Id, []*model.Channel{h.th.BasicChannel}),
			"the denied channel should be dropped")
		require.Empty(t, channelAccessDenialChannelID(h.rctx))

		require.Empty(t, h.th.App.FilterChannelIDsByReadAccess(h.rctx, h.th.BasicUser.Id, []string{h.th.BasicChannel.Id}))
		require.Empty(t, channelAccessDenialChannelID(h.rctx))
	})

	t.Run("an enforcement gate records the latest denial", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.Empty(t, channelAccessDenialChannelID(h.rctx), "nothing evaluated yet")

		ok, _ := h.th.App.SessionHasPermissionToReadChannel(h.rctx, *h.rctx.Session(), h.th.BasicChannel)
		require.False(t, ok)
		require.Equal(t, h.th.BasicChannel.Id, channelAccessDenialChannelID(h.rctx))

		second := h.th.CreateChannel(t, h.th.BasicTeam)
		require.False(t, h.th.App.EnforceChannelReadAccess(h.rctx, h.th.BasicUser.Id, second))
		require.Equal(t, second.Id, channelAccessDenialChannelID(h.rctx),
			"when two channels are gated in sequence, the later denial is the one the request dies on")
	})

	t.Run("does not record an allow as a denial", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		ok, _ := h.th.App.SessionHasPermissionToReadChannel(h.rctx, *h.rctx.Session(), h.th.BasicChannel)
		require.True(t, ok)
		require.Empty(t, channelAccessDenialChannelID(h.rctx))
	})

	// Keeps push recipients, webhook owners and admin-acting-for-user evaluations
	// out of the requester's own error.
	t.Run("a third-party evaluation does not record", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.EnforceChannelReadAccess(h.rctx, h.th.BasicUser2.Id, h.th.BasicChannel))
		require.Empty(t, channelAccessDenialChannelID(h.rctx),
			"the session user is the only one the response is about")
	})
}

func TestHasChannelReadAccessShortCircuits(t *testing.T) {
	cases := map[string]func(t *testing.T, h *channelReadAccessHarness) *model.Channel{
		"ChannelPermissionActions flag off": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			h.th.Server.platform.SetConfigReadOnlyFF(false)
			t.Cleanup(func() { h.th.Server.platform.SetConfigReadOnlyFF(true) })
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.FeatureFlags.ChannelPermissionActions = false
			})
			return h.th.BasicChannel
		},
		"ABAC disabled": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
			return h.th.BasicChannel
		},
		"unlicensed": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			h.th.App.Srv().SetLicense(nil)
			return h.th.BasicChannel
		},
		"direct message": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = model.ChannelTypeDirect
			return channel
		},
		"group message": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			channel := h.th.BasicChannel.DeepCopy()
			channel.Type = model.ChannelTypeGroup
			return channel
		},
		"nil channel": func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
			return nil
		},
	}

	for name, arrange := range cases {
		t.Run(name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			channel := arrange(t, h)

			require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
			mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
			mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
		})
	}

	t.Run("no access control service", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		original := h.th.App.Srv().ch.AccessControl
		h.th.App.Srv().ch.AccessControl = nil
		t.Cleanup(func() { h.th.App.Srv().ch.AccessControl = original })

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))
	})
}

func TestHasChannelReadAccessByID(t *testing.T) {
	t.Run("allows a channel that does not exist", func(t *testing.T) {
		// The policy-administration endpoints pass policy IDs through the channel
		// gates, and a team or parent policy has no channel behind it.
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)

		require.True(t, h.th.App.HasChannelReadAccessByID(h.rctx, h.th.BasicUser.Id, model.NewId()))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("allows an empty channel id", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		require.True(t, h.th.App.HasChannelReadAccessByID(h.rctx, h.th.BasicUser.Id, ""))
	})

	t.Run("evaluates a channel that does exist", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		require.False(t, h.th.App.HasChannelReadAccessByID(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel.Id))
	})
}

// A push carries the post body without the recipient asking for it, so a denied
// channel downgrades to an id-only payload rather than being suppressed. The device
// then fetches by id, and that fetch re-runs the gate live.
func TestBuildPushNotificationMessageChannelReadAccess(t *testing.T) {
	cases := []struct {
		name  string
		allow bool
	}{
		{name: "an allowed recipient gets the full content", allow: true},
		{name: "a denied recipient gets no post content", allow: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			recipient := h.th.BasicUser2
			h.th.AddUserToChannel(t, recipient, h.th.BasicChannel)

			mockACS := h.mockACS(t)
			mockACS.Test(t)
			governed(mockACS)
			// No fallback: a subject built for anyone but the recipient fails the test.
			mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Subject.ID == recipient.Id
			})).Return(model.AccessDecision{Decision: tc.allow}, nil)

			// The push worker runs without a session and builds the message for a
			// recipient other than the poster.
			msg, appErr := h.th.App.BuildPushNotificationMessage(
				h.th.Context,
				model.FullNotification,
				h.th.BasicPost,
				recipient,
				h.th.BasicChannel,
				h.th.BasicChannel.Name,
				h.th.BasicUser.Username,
				true, false, "",
			)
			require.Nil(t, appErr)
			mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)

			if tc.allow {
				require.Contains(t, msg.Message, h.th.BasicPost.Message)
			} else {
				require.NotEmpty(t, msg.PostId, "the notification still goes out, just without the body")
				require.NotContains(t, msg.Message, h.th.BasicPost.Message)
			}
		})
	}
}

// A render "allowed" can never disagree with what enforcement would decide: the
// client lays out affordances from the render decision, so drift would offer a
// channel the gate then refuses, or hide one it would have allowed. The rows are
// where a bare PDP call would drift: the gate exempts DMs and GMs, requires
// Enterprise Advanced, and does not evaluate an action no policy governs.
func TestChannelReadAccessRenderMatchesEnforcement(t *testing.T) {
	denyAll := func(mockACS *eMocks.AccessControlServiceInterface) {
		governed(mockACS)
		decides(mockACS, false)
	}

	cases := []struct {
		name string
		// arrange returns the channel to decide on, installing the mock only after it
		// creates any channel, since creating one can consult the access control service.
		arrange func(t *testing.T, h *channelReadAccessHarness) *model.Channel
		want    bool
	}{
		{
			name: "direct message",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				channel := h.th.CreateDmChannel(t, h.th.BasicUser2)
				denyAll(h.mockACS(t))
				return channel
			},
			want: true,
		},
		{
			name: "group message",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				channel := h.th.CreateGroupChannel(t, h.th.BasicUser2, h.th.CreateUser(t))
				denyAll(h.mockACS(t))
				return channel
			},
			want: true,
		},
		{
			name: "license below Enterprise Advanced",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				h.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
				denyAll(h.mockACS(t))
				return h.th.BasicChannel
			},
			want: true,
		},
		{
			name: "ungoverned, with a PDP that denies everything",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				mockACS := h.mockACS(t)
				mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
					Return(false, nil)
				decides(mockACS, false)
				return h.th.BasicChannel
			},
			want: true,
		},
		{
			name: "governed, PDP allows",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				mockACS := h.mockACS(t)
				governed(mockACS)
				decides(mockACS, true)
				return h.th.BasicChannel
			},
			want: true,
		},
		{
			name: "governed, PDP denies",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				denyAll(h.mockACS(t))
				return h.th.BasicChannel
			},
			want: false,
		},
		{
			name: "PDP error fails closed",
			arrange: func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
				mockACS := h.mockACS(t)
				governed(mockACS)
				mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
					Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))
				return h.th.BasicChannel
			},
			want: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			channel := tc.arrange(t, h)

			resp, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.rctx, model.ActionSearchRequest{
				Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: channel.Id},
				Actions:  []string{model.AccessControlPolicyActionChannelReadAccess},
			})
			require.Nil(t, appErr)
			rendered := resp.Decisions[model.AccessControlPolicyActionChannelReadAccess]
			require.True(t, rendered.Evaluated, "the client falls back to its own default for a decision not evaluated")

			// Enforcement runs as a request of its own: sharing the render's memo would
			// hand it the render's answer.
			enforcementCtx := WithChannelAccessMemo(h.th.Context.WithSession(h.rctx.Session()))
			enforced := h.th.App.HasChannelReadAccess(enforcementCtx, h.th.BasicUser.Id, channel)

			require.Equal(t, tc.want, enforced)
			require.Equal(t, enforced, rendered.Allowed)
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

func allowsOnlyChannel(mockACS *eMocks.AccessControlServiceInterface, channelID string) {
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Resource.ID == channelID
	})).Return(model.AccessDecision{Decision: true}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, nil)
}

// createFlaggedPosts saves n posts for BasicUser, newest first, each in a channel of its
// own so that denying a channel denies exactly one post. The store orders saved posts by
// CreateAt alone, so each gets a distinct one: a tie could reorder posts between pages.
func createFlaggedPosts(t *testing.T, h *channelReadAccessHarness, n int) []*model.Post {
	t.Helper()

	base := model.GetMillis()
	posts := make([]*model.Post, 0, n)
	for i := range n {
		channel := h.th.CreateChannel(t, h.th.BasicTeam)
		post := h.th.CreatePost(t, channel, func(p *model.Post) { p.CreateAt = base - int64(i) })
		appErr := h.th.App.UpdatePreferences(h.rctx, h.th.BasicUser.Id, model.Preferences{{
			UserId:   h.th.BasicUser.Id,
			Category: model.PreferenceCategoryFlaggedPost,
			Name:     post.Id,
			Value:    "true",
		}})
		require.Nil(t, appErr)
		posts = append(posts, post)
	}
	return posts
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
			h := setupChannelReadAccessTest(t)
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

// The fill gives up after putils.FetchUntilMaxRounds (10) rounds. With one row per page
// and every row denied but the one at raw index 10, only the cap stops the fill before
// it reaches that row: without the cap, or with a higher one, the page would hold it.
func TestGetPublicChannelsForTeamGivesUpAfterMaxFillRounds(t *testing.T) {
	const allowedIndex = 10

	h := setupChannelReadAccessTest(t)
	team := h.th.CreateTeam(t)
	for range allowedIndex + 1 {
		h.th.CreateChannel(t, team)
	}

	// The store's own ordering, read before any access control service exists.
	all, appErr := h.th.App.GetPublicChannelsForTeam(h.rctx, team.Id, 0, 100)
	require.Nil(t, appErr)
	require.Greater(t, len(all), allowedIndex)

	mockACS := h.mockACS(t)
	governed(mockACS)
	allowsOnlyChannel(mockACS, all[allowedIndex].Id)

	got, appErr := h.th.App.GetPublicChannelsForTeam(h.rctx, team.Id, 0, 1)
	require.Nil(t, appErr)
	require.Empty(t, got, "the fill must give up at the cap rather than read on to the allowed channel")
	// Every round reads a channel of its own, so each costs one evaluation.
	mockACS.AssertNumberOfCalls(t, "AccessEvaluation", putils.FetchUntilMaxRounds)
}

// The saved-posts equivalent of the channel page fill. A denied channel must not
// shorten the page, because the client treats a short page as the end of the list.
func TestGetFlaggedPostsFillsPagesPastDeniedChannels(t *testing.T) {
	const perPage = 3

	for _, deniedIndex := range []int{0, perPage - 1, perPage} {
		t.Run(fmt.Sprintf("denied index %d", deniedIndex), func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			posts := createFlaggedPosts(t, h, 8)

			// The store's own ordering, read before any access control service exists.
			all, appErr := h.th.App.GetFlaggedPosts(h.rctx, h.th.BasicUser.Id, 0, 100)
			require.Nil(t, appErr)
			require.Greater(t, len(all.Order), perPage+deniedIndex)

			deniedPostID := all.Order[deniedIndex]
			mockACS := h.mockACS(t)
			governed(mockACS)
			deniesChannel(mockACS, all.Posts[deniedPostID].ChannelId)

			seen := map[string]bool{}
			firstPageLen := -1
			for page := 0; page*perPage < len(all.Order); page++ {
				got, appErr := h.th.App.GetFlaggedPosts(h.rctx, h.th.BasicUser.Id, page*perPage, perPage)
				require.Nil(t, appErr)
				if page == 0 {
					firstPageLen = len(got.Order)
				}
				for _, postID := range got.Order {
					require.NotEqual(t, deniedPostID, postID, "a denied post must never be served")
					seen[postID] = true
				}
			}

			require.Equal(t, perPage, firstPageLen,
				"the first page must be topped up, or the client stops paginating here")

			for _, post := range posts {
				if post.Id == deniedPostID {
					continue
				}
				require.True(t, seen[post.Id], "saved post %q was lost while paginating", post.Id)
			}
		})
	}
}

// The saved-posts equivalent of TestGetPublicChannelsForTeamGivesUpAfterMaxFillRounds.
func TestGetFlaggedPostsGivesUpAfterMaxFillRounds(t *testing.T) {
	const allowedIndex = 10

	h := setupChannelReadAccessTest(t)
	createFlaggedPosts(t, h, allowedIndex+1)

	// The store's own ordering, read before any access control service exists.
	all, appErr := h.th.App.GetFlaggedPosts(h.rctx, h.th.BasicUser.Id, 0, 100)
	require.Nil(t, appErr)
	require.Greater(t, len(all.Order), allowedIndex)

	mockACS := h.mockACS(t)
	governed(mockACS)
	allowsOnlyChannel(mockACS, all.Posts[all.Order[allowedIndex]].ChannelId)

	got, appErr := h.th.App.GetFlaggedPosts(h.rctx, h.th.BasicUser.Id, 0, 1)
	require.Nil(t, appErr)
	require.Empty(t, got.Order, "the fill must give up at the cap rather than read on to the allowed post")
	// The memo evaluates a channel once per request, and every post is in a channel of
	// its own, so each round costs one evaluation.
	mockACS.AssertNumberOfCalls(t, "AccessEvaluation", putils.FetchUntilMaxRounds)
}

// Search results are filtered through HasPermissionToReadChannel, which already folds
// in channel_read_access, so a denied channel's posts must never surface.
func TestSearchPostsForUserDropsDeniedChannels(t *testing.T) {
	h := setupChannelReadAccessTest(t)

	const term = "needlepost"
	allowedChannel := h.th.CreateChannel(t, h.th.BasicTeam)
	deniedChannel := h.th.CreateChannel(t, h.th.BasicTeam)
	allowed := h.th.CreatePost(t, allowedChannel, func(p *model.Post) { p.Message = term })
	denied := h.th.CreatePost(t, deniedChannel, func(p *model.Post) { p.Message = term })

	mockACS := h.mockACS(t)
	governed(mockACS)
	deniesChannel(mockACS, deniedChannel.Id)

	results, _, appErr := h.th.App.SearchPostsForUser(h.rctx, term, h.th.BasicUser.Id, h.th.BasicTeam.Id, false, false, 0, 0, 20)
	require.Nil(t, appErr)
	require.Contains(t, results.Order, allowed.Id)
	require.NotContains(t, results.Order, denied.Id, "a denied channel's post must not appear in search")
	require.NotContains(t, results.Posts, denied.Id)
}

// The database search path ignores perPage and returns up to its own limit, so the
// top-up must only ever append. Trimming the page back to perPage would silently drop
// the remainder on a store that cannot serve page 1 at all.
func TestSearchPostsForUserDoesNotTruncateAnOverlongStorePage(t *testing.T) {
	h := setupChannelReadAccessTest(t)

	const term = "overlongpage"
	const perPage = 5
	channel := h.th.CreateChannel(t, h.th.BasicTeam)
	for range perPage * 2 {
		h.th.CreatePost(t, channel, func(p *model.Post) { p.Message = term })
	}

	mockACS := h.mockACS(t)
	governed(mockACS)
	decides(mockACS, true)

	results, _, appErr := h.th.App.SearchPostsForUser(h.rctx, term, h.th.BasicUser.Id, h.th.BasicTeam.Id, false, false, 0, 0, perPage)
	require.Nil(t, appErr)
	require.Len(t, results.Order, perPage*2,
		"the store returned a full page for perPage=%d; trimming it would lose posts", perPage)
}

// Matches is keyed by post id and carries the terms each post matched on, so leaving an
// entry behind for a filtered-out post leaks both.
func TestPruneSearchMatchesDropsRemovedPosts(t *testing.T) {
	mainHelper.Parallel(t)

	kept := &model.Post{Id: model.NewId()}
	removed := model.NewId()

	postList := model.NewPostList()
	postList.AddPost(kept)
	postList.AddOrder(kept.Id)

	results := model.MakePostSearchResults(postList, model.PostSearchMatches{
		kept.Id: {"secret"},
		removed: {"secret"},
	})

	pruneSearchMatches(results)

	require.Contains(t, results.Matches, kept.Id)
	require.NotContains(t, results.Matches, removed, "a filtered-out post must not leak its id or matched terms")
}

// A list request evaluates many channels for one user, and only the channel role
// differs between them, so the rest of the subject is built once per request.
func TestChannelReadAccessSubjectIsBuiltOncePerRequest(t *testing.T) {
	t.Run("reuses the user's subject across channels", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		other := h.th.CreateChannel(t, h.th.BasicTeam)
		mockACS := h.mockACS(t)
		governed(mockACS)
		requests := capturesRequests(mockACS, true)

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, h.th.BasicChannel))

		// Swap the memoised subject for a marked one: the next channel only sees the
		// mark if it reuses the memo instead of building its own.
		memo := getChannelAccessMemo(h.rctx)
		require.NotNil(t, memo.getSubject(h.th.BasicUser.Id))
		memo.setSubject(h.th.BasicUser.Id, &model.Subject{
			ID:         h.th.BasicUser.Id,
			Type:       "user",
			Attributes: map[string]any{"marker": "reused"},
		})

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, other))
		require.Len(t, *requests, 2)
		require.Equal(t, "reused", (*requests)[1].Subject.Attributes["marker"])
	})

	t.Run("does not carry one channel's role into another", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		withoutRule := h.th.CreateChannel(t, h.th.BasicTeam)
		mockACS := h.mockACS(t)
		governed(mockACS)
		requests := capturesRequests(mockACS, true)

		withRule := h.th.BasicChannel.DeepCopy()
		withRule.PolicyEnforced = true
		channelPolicyGoverns(mockACS, withRule.Id, true)

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, withRule))
		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, withoutRule))

		require.Len(t, *requests, 2)
		require.NotEmpty(t, (*requests)[0].Subject.RoleForScope(model.AccessControlSubjectScopeChannel))
		require.Empty(t, (*requests)[1].Subject.RoleForScope(model.AccessControlSubjectScopeChannel))
		require.Empty(t, getChannelAccessMemo(h.rctx).getSubject(h.th.BasicUser.Id).RoleForScope(model.AccessControlSubjectScopeChannel),
			"the memoised subject must stay free of channel roles")
	})
}

func TestPrepareChannelReadAccess(t *testing.T) {
	roleOf := func(h *channelReadAccessHarness, channelID string) (string, bool) {
		return getChannelAccessMemo(h.rctx).getChannelRole(channelRoleKey{userID: h.th.BasicUser.Id, channelID: channelID})
	}

	t.Run("fetches roles only for channels whose own policy declares the action", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		notMember, appErr := h.th.App.CreateChannel(h.th.Context, &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        "name_" + model.NewId(),
			Type:        model.ChannelTypeOpen,
			TeamId:      h.th.BasicTeam.Id,
			CreatorId:   h.th.BasicUser2.Id,
		}, false)
		require.Nil(t, appErr)
		noRule := h.th.CreateChannel(t, h.th.BasicTeam)
		noPolicy := h.th.CreateChannel(t, h.th.BasicTeam)

		mockACS := h.mockACS(t)
		governed(mockACS)
		member := h.th.BasicChannel.DeepCopy()
		member.PolicyEnforced = true
		channelPolicyGoverns(mockACS, member.Id, true)
		notMember.PolicyEnforced = true
		channelPolicyGoverns(mockACS, notMember.Id, true)
		noRule.PolicyEnforced = true
		channelPolicyGoverns(mockACS, noRule.Id, false)

		h.th.App.PrepareChannelReadAccess(h.rctx, h.th.BasicUser.Id, []*model.Channel{member, notMember, noRule, noPolicy})

		wantRole, appErr := h.th.App.GetSubjectChannelRole(h.rctx, h.th.BasicUser.Id, member.Id)
		require.Nil(t, appErr)
		role, ok := roleOf(h, member.Id)
		require.True(t, ok)
		require.Equal(t, wantRole, role)

		role, ok = roleOf(h, notMember.Id)
		require.True(t, ok, "a channel the user is not in is a fetched answer, not a gap")
		require.Empty(t, role)

		_, ok = roleOf(h, noRule.Id)
		require.False(t, ok, "a channel whose policy does not declare the action needs no role")
		_, ok = roleOf(h, noPolicy.Id)
		require.False(t, ok)
	})

	t.Run("evaluation takes the fetched role instead of reading the member row", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		requests := capturesRequests(mockACS, true)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		channelPolicyGoverns(mockACS, channel.Id, true)

		// A role BasicUser does not hold: the subject carries it only if evaluation took
		// the memo's answer.
		getChannelAccessMemo(h.rctx).setChannelRole(channelRoleKey{userID: h.th.BasicUser.Id, channelID: channel.Id}, model.ChannelGuestRoleId)

		require.True(t, h.th.App.HasChannelReadAccess(h.rctx, h.th.BasicUser.Id, channel))
		require.Len(t, *requests, 1)
		require.Equal(t, model.ChannelGuestRoleId, (*requests)[0].Subject.RoleForScope(model.AccessControlSubjectScopeChannel))
	})

	t.Run("does nothing without a request memo", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true

		h.th.App.PrepareChannelReadAccess(h.th.Context, h.th.BasicUser.Id, []*model.Channel{channel})
		mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "ResourcePolicyGovernsAction", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("by IDs reads from the store whether each channel has a policy", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		withPolicy := h.th.CreateChannel(t, h.th.BasicTeam)
		withoutPolicy := h.th.CreateChannel(t, h.th.BasicTeam)

		// PolicyEnforced is computed from the policy table when a channel is read, so a
		// stored row is what makes the channel count as having one.
		_, err := h.th.App.Srv().Store().AccessControlPolicy().Save(h.th.Context, &model.AccessControlPolicy{
			ID:       withPolicy.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_2,
			Active:   true,
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{"membership"}, Expression: "true"},
			},
		})
		require.NoError(t, err)
		t.Cleanup(func() { _ = h.th.App.Srv().Store().AccessControlPolicy().Delete(h.th.Context, withPolicy.Id) })
		h.th.App.Srv().Store().Channel().InvalidateChannel(withPolicy.Id)

		mockACS := h.mockACS(t)
		governed(mockACS)
		channelPolicyGoverns(mockACS, withPolicy.Id, true)

		h.th.App.PrepareChannelReadAccessByIDs(h.rctx, h.th.BasicUser.Id, []string{withPolicy.Id, withoutPolicy.Id})

		_, ok := roleOf(h, withPolicy.Id)
		require.True(t, ok)
		_, ok = roleOf(h, withoutPolicy.Id)
		require.False(t, ok)
	})

	t.Run("a filter prepares its page before evaluating it", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, true)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		channelPolicyGoverns(mockACS, channel.Id, true)

		require.Len(t, h.th.App.FilterChannelsByReadAccess(h.rctx, h.th.BasicUser.Id, []*model.Channel{channel}), 1)
		_, ok := roleOf(h, channel.Id)
		require.True(t, ok, "the filter must fetch the page's roles up front")
	})
}

// Every channel-scoped permission must be deliberately classified as a read, a
// write, a management action, or neither. channel_read_access gates the reads,
// channel_write_access the writes and channel_management_access the management
// actions; a new permission left out of every allowlist silently escapes every gate,
// so adding one to the model fails here until somebody decides which side it
// belongs on.
func TestChannelPermissionClassification(t *testing.T) {
	mainHelper.Parallel(t)

	const (
		classRead       = "read"
		classWrite      = "write"
		classManagement = "management"
		classNeither    = "neither"
	)

	want := map[string]string{
		"add_bookmark_private_channel":      classManagement,
		"add_bookmark_public_channel":       classManagement,
		"add_reaction":                      classWrite,
		"convert_private_channel_to_public": classManagement,
		"convert_public_channel_to_private": classManagement,
		"create_post":                       classWrite,
		"create_post_ephemeral":             classWrite,
		"create_post_public":                classWrite,
		"delete_bookmark_private_channel":   classManagement,
		"delete_bookmark_public_channel":    classManagement,
		"delete_others_posts":               classWrite,
		"delete_post":                       classWrite,
		"delete_private_channel":            classManagement,
		"delete_public_channel":             classManagement,
		"edit_bookmark_private_channel":     classManagement,
		"edit_bookmark_public_channel":      classManagement,
		"edit_file_attachment":              classWrite,
		"edit_others_posts":                 classWrite,
		"edit_post":                         classWrite,
		// Policy administration, not channel content. Every call site asks RBAC-only,
		// and the policy endpoints apply the management gate themselves, so this
		// stays off every list.
		"manage_channel_access_rules":             classNeither,
		"manage_channel_join_requests":            classManagement,
		"manage_channel_roles":                    classManagement,
		"manage_private_channel_auto_translation": classManagement,
		"manage_private_channel_banner":           classManagement,
		"manage_private_channel_discoverability":  classManagement,
		"manage_private_channel_members":          classManagement,
		"manage_private_channel_properties":       classManagement,
		"manage_public_channel_auto_translation":  classManagement,
		"manage_public_channel_banner":            classManagement,
		"manage_public_channel_members":           classManagement,
		"manage_public_channel_properties":        classManagement,
		"order_bookmark_private_channel":          classManagement,
		"order_bookmark_public_channel":           classManagement,
		"read_channel":                            classRead,
		"read_channel_content":                    classRead,
		// Never reaches the channel gates: it is only an error payload behind an
		// IsSystemAdmin check, so it is on neither allowlist.
		"read_deleted_posts":          classNeither,
		"read_private_channel_groups": classRead,
		"read_public_channel_groups":  classRead,
		"remove_others_reactions":     classWrite,
		"remove_reaction":             classWrite,
		"upload_file":                 classWrite,
		"use_channel_mentions":        classWrite,
		"use_group_mentions":          classWrite,
		"use_slash_commands":          classWrite,
	}

	for _, permission := range model.AllPermissions {
		if permission.Scope != model.PermissionScopeChannel {
			continue
		}

		class, classified := want[permission.Id]
		require.True(t, classified,
			"classify %s as a channel read, a write, a management action, or neither, then add it here", permission.Id)

		isRead := isChannelReadPermission(permission)
		isWrite := isChannelWritePermission(permission)
		isManagement := isChannelManagementPermission(permission)
		allowlists := 0
		for _, on := range []bool{isRead, isWrite, isManagement} {
			if on {
				allowlists++
			}
		}
		require.LessOrEqual(t, allowlists, 1,
			"%s is on more than one allowlist; a permission belongs to one gate at most", permission.Id)

		require.Equal(t, class == classRead, isRead, "isChannelReadPermission(%s)", permission.Id)
		require.Equal(t, class == classWrite, isWrite, "isChannelWritePermission(%s)", permission.Id)
		require.Equal(t, class == classManagement, isManagement, "isChannelManagementPermission(%s)", permission.Id)
	}
}

// TestChannelScopedEventsCarryTheReadAccessHook pins the websocket contract for every
// publisher of channel content. A denied user stays a channel member, so the broadcast
// still names them as a recipient; without the hook the event hands them content over a
// connection where post events are already cut off. The publishers don't attach it
// themselves: Publish does, for any channel whose read access is governed.
func TestChannelScopedEventsCarryTheReadAccessHook(t *testing.T) {
	cases := []struct {
		name string
		// events the publisher is expected to emit; every one must carry the hook.
		events []model.WebsocketEventType
		// expectACS covers ACS calls the publisher makes for its own reasons, which
		// would otherwise panic the mock before the assertions run.
		expectACS func(mockACS *eMocks.AccessControlServiceInterface)
		run       func(t *testing.T, h *channelReadAccessHarness)
	}{
		{
			name: "posts",
			events: []model.WebsocketEventType{
				model.WebsocketEventPosted,
				model.WebsocketEventPostEdited,
				model.WebsocketEventPostDeleted,
			},
			expectACS: func(mockACS *eMocks.AccessControlServiceInterface) {
				// Notifying the channel's members evaluates their access.
				decides(mockACS, true)
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				post, _, appErr := h.th.App.CreatePost(h.th.Context, &model.Post{
					UserId:    h.th.BasicUser.Id,
					ChannelId: h.th.BasicChannel.Id,
					Message:   "a post",
				}, h.th.BasicChannel, model.CreatePostFlags{})
				require.Nil(t, appErr)

				post = post.Clone()
				post.Message = "an edited post"
				_, _, appErr = h.th.App.UpdatePost(h.th.Context, post, nil)
				require.Nil(t, appErr)

				_, appErr = h.th.App.DeletePost(h.th.Context, post.Id, h.th.BasicUser.Id)
				require.Nil(t, appErr)
			},
		},
		{
			name: "bookmarks",
			events: []model.WebsocketEventType{
				model.WebsocketEventChannelBookmarkCreated,
				model.WebsocketEventChannelBookmarkUpdated,
				model.WebsocketEventChannelBookmarkSorted,
				model.WebsocketEventChannelBookmarkDeleted,
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				created, appErr := h.th.App.CreateChannelBookmark(h.rctx,
					createBookmark("Link bookmark", model.ChannelBookmarkLink, h.th.BasicChannel.Id, ""), "")
				require.Nil(t, appErr)

				created.DisplayName = "Renamed bookmark"
				_, appErr = h.th.App.UpdateChannelBookmark(h.rctx, created, "")
				require.Nil(t, appErr)

				_, appErr = h.th.App.UpdateChannelBookmarkSortOrder(created.Id, h.th.BasicChannel.Id, 0, "")
				require.Nil(t, appErr)

				_, appErr = h.th.App.DeleteChannelBookmark(created.Id, "")
				require.Nil(t, appErr)
			},
		},
		{
			name: "reactions",
			events: []model.WebsocketEventType{
				model.WebsocketEventReactionAdded,
				model.WebsocketEventReactionRemoved,
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				reaction := &model.Reaction{
					UserId:    h.th.BasicUser.Id,
					PostId:    h.th.BasicPost.Id,
					EmojiName: "smile",
				}
				_, appErr := h.th.App.SaveReactionForPost(h.rctx, reaction)
				require.Nil(t, appErr)
				require.Nil(t, h.th.App.DeleteReactionForPost(h.rctx, reaction))
			},
		},
		{
			name: "acknowledgements",
			events: []model.WebsocketEventType{
				model.WebsocketEventAcknowledgementAdded,
				model.WebsocketEventAcknowledgementRemoved,
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				_, appErr := h.th.App.SaveAcknowledgementForPost(h.rctx, h.th.BasicPost.Id, h.th.BasicUser.Id)
				require.Nil(t, appErr)
				require.Nil(t, h.th.App.DeleteAcknowledgementForPost(h.rctx, h.th.BasicPost.Id, h.th.BasicUser.Id))
			},
		},
		{
			name: "views",
			events: []model.WebsocketEventType{
				model.WebsocketEventViewCreated,
				model.WebsocketEventViewUpdated,
				model.WebsocketEventViewSorted,
				model.WebsocketEventViewDeleted,
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				created, appErr := h.th.App.CreateView(h.rctx, makeTestView(h.th.BasicChannel.Id, h.th.BasicUser.Id), "")
				require.Nil(t, appErr)

				_, appErr = h.th.App.UpdateView(h.rctx, created,
					&model.ViewPatch{Title: model.NewPointer("Renamed view")}, "")
				require.Nil(t, appErr)

				_, appErr = h.th.App.UpdateViewSortOrder(h.rctx, created.Id, h.th.BasicChannel.Id, 0, "")
				require.Nil(t, appErr)

				require.Nil(t, h.th.App.DeleteView(h.rctx, created, ""))
			},
		},
		{
			name: "channel properties",
			events: []model.WebsocketEventType{
				model.WebsocketEventPropertyFieldCreated,
				model.WebsocketEventPropertyValuesUpdated,
				model.WebsocketEventPropertyFieldDeleted,
			},
			expectACS: func(mockACS *eMocks.AccessControlServiceInterface) {
				mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return()
			},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				groupID := registerTestPropertyGroup(t, h.th)
				field, appErr := h.th.App.CreatePropertyField(h.rctx, &model.PropertyField{
					GroupID:    groupID,
					Name:       "board-field-" + model.NewId(),
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeChannel,
					TargetType: string(model.PropertyFieldTargetLevelChannel),
					TargetID:   h.th.BasicChannel.Id,
				}, false, "")
				require.Nil(t, appErr)

				_, appErr = h.th.App.UpsertPropertyValues(h.rctx, []*model.PropertyValue{{
					TargetID:   h.th.BasicChannel.Id,
					TargetType: model.PropertyFieldObjectTypeChannel,
					GroupID:    groupID,
					FieldID:    field.ID,
					Value:      []byte(`"v"`),
					CreatedBy:  h.th.BasicUser.Id,
					UpdatedBy:  h.th.BasicUser.Id,
				}}, model.PropertyFieldObjectTypeChannel, h.th.BasicChannel.Id, "")
				require.Nil(t, appErr)

				require.Nil(t, h.th.App.DeletePropertyField(h.rctx, groupID, field.ID, false, ""))
			},
		},
		{
			name:   "channel update",
			events: []model.WebsocketEventType{model.WebsocketEventChannelUpdated},
			run: func(t *testing.T, h *channelReadAccessHarness) {
				channel := h.th.BasicChannel.DeepCopy()
				channel.Header = "Header revision " + model.NewId()
				_, appErr := h.th.App.UpdateChannel(h.rctx, channel)
				require.Nil(t, appErr)
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			// The hook is only attached where read access is governed.
			governed(mockACS)
			if tc.expectACS != nil {
				tc.expectACS(mockACS)
			}

			requireReadAccessHook(t, h, tc.events, tc.run)
		})
	}
}

// Join/leave send two copies of each event: a channel-wide one that tells the other
// members, and a user-scoped one to the joining or leaving user. Only the channel-wide
// copy is gated. The removed user's copy is how their client drops the channel, so
// gating it would leave a denied user with a stale channel in the sidebar.
func TestChannelJoinLeaveEventsCarryTheReadAccessHook(t *testing.T) {
	// capture runs the publisher and returns every websocket event it published.
	capture := func(t *testing.T, h *channelReadAccessHarness, run func(*testing.T)) []*model.WebSocketEvent {
		t.Helper()

		cluster := &testlib.FakeClusterInterface{}
		h.th.Server.Platform().SetCluster(cluster)
		run(t)

		var events []*model.WebSocketEvent
		for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventPublish
		}) {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			require.NoError(t, err)
			events = append(events, event)
		}
		return events
	}

	// find returns the single event of the given type whose broadcast is channel-wide
	// (channelWide) or addressed to one user (!channelWide).
	find := func(t *testing.T, events []*model.WebSocketEvent, eventType model.WebsocketEventType, channelID string, channelWide bool) *model.WebSocketEvent {
		t.Helper()

		var found []*model.WebSocketEvent
		for _, event := range events {
			if event.EventType() != eventType {
				continue
			}
			broadcast := event.GetBroadcast()
			if channelWide && broadcast.ChannelId == channelID && broadcast.UserId == "" {
				found = append(found, event)
			}
			if !channelWide && broadcast.UserId != "" && (broadcast.ChannelId == channelID || event.GetData()["channel_id"] == channelID) {
				found = append(found, event)
			}
		}
		require.Len(t, found, 1, "%s (channel-wide=%v)", eventType, channelWide)
		return found[0]
	}

	requireHooked := func(t *testing.T, event *model.WebSocketEvent, channelID string) {
		t.Helper()
		require.Contains(t, event.GetBroadcast().BroadcastHooks, broadcastChannelReadAccess, "%s", event.EventType())
		require.Contains(t, event.GetBroadcast().BroadcastHookArgs,
			map[string]any{"channel_id": channelID}, "%s", event.EventType())
	}

	requireNotHooked := func(t *testing.T, event *model.WebSocketEvent) {
		t.Helper()
		require.NotContains(t, event.GetBroadcast().BroadcastHooks, broadcastChannelReadAccess, "%s", event.EventType())
	}

	disableABAC := func(h *channelReadAccessHarness) {
		// Turning ABAC off rather than dropping the license, as in
		// TestChannelScopedEventsCarryTheReadAccessHook.
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
	}

	t.Run("add user to channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		addUser := func(t *testing.T) (*model.Channel, []*model.WebSocketEvent) {
			channel := h.th.CreateChannel(t, h.th.BasicTeam)
			events := capture(t, h, func(t *testing.T) {
				_, appErr := h.th.App.AddUserToChannel(h.rctx, h.th.BasicUser2, channel, false)
				require.Nil(t, appErr)
			})
			return channel, events
		}

		channel, events := addUser(t)
		requireHooked(t, find(t, events, model.WebsocketEventUserAdded, channel.Id, true), channel.Id)
		requireNotHooked(t, find(t, events, model.WebsocketEventUserAdded, channel.Id, false))

		disableABAC(h)
		channel, events = addUser(t)
		requireNotHooked(t, find(t, events, model.WebsocketEventUserAdded, channel.Id, true))
	})

	t.Run("remove user from channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		removeUser := func(t *testing.T) (*model.Channel, []*model.WebSocketEvent) {
			channel := h.th.CreateChannel(t, h.th.BasicTeam)
			h.th.AddUserToChannel(t, h.th.BasicUser2, channel)
			events := capture(t, h, func(t *testing.T) {
				require.Nil(t, h.th.App.RemoveUserFromChannel(h.rctx, h.th.BasicUser2.Id, h.th.BasicUser.Id, channel))
			})
			return channel, events
		}

		channel, events := removeUser(t)
		requireHooked(t, find(t, events, model.WebsocketEventUserRemoved, channel.Id, true), channel.Id)
		requireNotHooked(t, find(t, events, model.WebsocketEventUserRemoved, channel.Id, false))

		disableABAC(h)
		channel, events = removeUser(t)
		requireNotHooked(t, find(t, events, model.WebsocketEventUserRemoved, channel.Id, true))
	})

	t.Run("join default channels", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		townSquare, appErr := h.th.App.GetChannelByName(h.th.Context, model.DefaultChannelName, h.th.BasicTeam.Id, false)
		require.Nil(t, appErr)

		joinTeam := func(t *testing.T) []*model.WebSocketEvent {
			user := h.th.CreateUser(t)
			return capture(t, h, func(t *testing.T) {
				h.th.LinkUserToTeam(t, user, h.th.BasicTeam)
			})
		}

		requireHooked(t, find(t, joinTeam(t), model.WebsocketEventUserAdded, townSquare.Id, true), townSquare.Id)

		disableABAC(h)
		requireNotHooked(t, find(t, joinTeam(t), model.WebsocketEventUserAdded, townSquare.Id, true))
	})
}

func TestChannelReadAccessHookOnlyWhereAccessCanBeDenied(t *testing.T) {
	hooked := func(t *testing.T, h *channelReadAccessHarness, channelID string) bool {
		t.Helper()
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", channelID, "", nil, "")
		h.th.App.setupBroadcastHookForChannelReadAccess(channelID, message)
		return slices.Contains(message.GetBroadcast().BroadcastHooks, broadcastChannelReadAccess)
	}
	ungoverned := func(mockACS *eMocks.AccessControlServiceInterface) {
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)
	}

	t.Run("not when read access is ungoverned and the channel has no policy", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		ungoverned(h.mockACS(t))
		require.False(t, hooked(t, h, h.th.BasicChannel.Id))
	})

	t.Run("when a permission policy governs read access", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))
		require.True(t, hooked(t, h, h.th.BasicChannel.Id))
	})

	// withChannelPolicy gives a new channel a policy of its own, so PolicyEnforced is set
	// and the gate asks whether that policy governs read access.
	withChannelPolicy := func(t *testing.T, h *channelReadAccessHarness) *model.Channel {
		t.Helper()
		channel := h.th.CreateChannel(t, h.th.BasicTeam)
		_, err := h.th.App.Srv().Store().AccessControlPolicy().Save(h.rctx, &model.AccessControlPolicy{
			ID:       channel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Name:     "policy-" + channel.Id,
			Active:   true,
			Revision: 1,
			Version:  model.AccessControlPolicyVersionV0_3,
			Imports:  []string{},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
			},
		})
		require.NoError(t, err)
		t.Cleanup(func() { _ = h.th.App.Srv().Store().AccessControlPolicy().Delete(h.rctx, channel.Id) })
		h.th.App.Srv().Store().Channel().InvalidateChannel(channel.Id)
		return channel
	}

	t.Run("when the channel's own policy governs read access", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		ungoverned(mockACS)
		channel := withChannelPolicy(t, h)
		channelPolicyGoverns(mockACS, channel.Id, true)

		require.True(t, hooked(t, h, channel.Id))
	})

	t.Run("not when the channel's own policy governs only other actions", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		ungoverned(mockACS)
		channel := withChannelPolicy(t, h)
		channelPolicyGoverns(mockACS, channel.Id, false)

		require.False(t, hooked(t, h, channel.Id))
	})

	t.Run("when the governance check fails", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		h.mockACS(t).On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
		require.True(t, hooked(t, h, h.th.BasicChannel.Id))
	})

	t.Run("when the channel can't be loaded", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		// No expectations: the check must not reach the access control service.
		h.mockACS(t)
		require.True(t, hooked(t, h, model.NewId()))
	})

	t.Run("not for a direct message channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))
		require.False(t, hooked(t, h, h.th.CreateDmChannel(t, h.th.BasicUser2).Id))
	})
}

// TestThreadUpdatedCarriesTheReadAccessHook covers the publishers of thread_updated. The
// event goes to one user but carries the thread's root post, so each publisher has to hook
// it to the thread's channel itself; the broadcast names no channel to filter on.
func TestThreadUpdatedCarriesTheReadAccessHook(t *testing.T) {
	events := []model.WebsocketEventType{model.WebsocketEventThreadUpdated}

	// setup enables collapsed threads, which every publisher below requires or checks, and
	// starts a thread in BasicChannel with a reply mentioning BasicUser2, a member of the
	// channel as a denied user would be.
	setup := func(t *testing.T) (h *channelReadAccessHarness, root, reply *model.Post) {
		t.Helper()

		h = setupChannelReadAccessTest(t)
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ThreadAutoFollow = true
			*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsDefaultOn
		})
		h.th.AddUserToChannel(t, h.th.BasicUser2, h.th.BasicChannel)

		root, _, appErr := h.th.App.CreatePost(h.th.Context, &model.Post{
			UserId:    h.th.BasicUser.Id,
			ChannelId: h.th.BasicChannel.Id,
			Message:   "root",
		}, h.th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		reply, _, appErr = h.th.App.CreatePost(h.th.Context, &model.Post{
			UserId:    h.th.BasicUser.Id,
			ChannelId: h.th.BasicChannel.Id,
			RootId:    root.Id,
			Message:   "reply for @" + h.th.BasicUser2.Username,
		}, h.th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// The hook is only attached where read access is governed. Posting consults the
		// other actions' governance too; nothing else here is governed.
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).Return(true, nil).Maybe()
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil).Maybe()
		decides(mockACS, true)
		return h, root, reply
	}

	t.Run("a follower notified of a reply", func(t *testing.T) {
		h, root, _ := setup(t)
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			_, _, appErr := h.th.App.CreatePost(h.th.Context, &model.Post{
				UserId:    h.th.BasicUser.Id,
				ChannelId: h.th.BasicChannel.Id,
				RootId:    root.Id,
				Message:   "another reply",
			}, h.th.BasicChannel, model.CreatePostFlags{})
			require.Nil(t, appErr)
		})
	})

	t.Run("a mention taken back", func(t *testing.T) {
		h, root, reply := setup(t)
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			// RemoveNotifications only reports a mention it can take back, so restore the
			// one each run consumes.
			membership, appErr := h.th.App.GetThreadMembershipForUser(h.th.BasicUser2.Id, root.Id)
			require.Nil(t, appErr)
			membership.UnreadMentions = 1
			_, err := h.th.App.Srv().Store().Thread().UpdateMembership(membership)
			require.NoError(t, err)

			require.NoError(t, h.th.App.RemoveNotifications(h.th.Context, reply, h.th.BasicChannel))
		})
	})

	t.Run("a thread followed on joining the channel", func(t *testing.T) {
		h, root, _ := setup(t)
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			require.Nil(t, h.th.App.UpdateThreadFollowForUserFromChannelAdd(h.th.Context, h.th.BasicUser2.Id, h.th.BasicTeam.Id, root.Id))
		})
	})

	t.Run("a reply marked unread", func(t *testing.T) {
		h, _, reply := setup(t)
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			_, appErr := h.th.App.MarkChannelAsUnreadFromPost(h.th.Context, reply.Id, h.th.BasicUser2.Id, false)
			require.Nil(t, appErr)
		})
	})
}

// channel_access_control_updated has to reach a member the channel's read rules deny, since
// it is how their client learns to drop the channel. It carries the hook that strips the
// channel for them, never the one that would drop the event.
func TestChannelAccessControlUpdatedCarriesTheRedactHook(t *testing.T) {
	h := setupChannelReadAccessTest(t)
	h.mockACS(t)

	publish := func(t *testing.T, h *channelReadAccessHarness) {
		h.th.App.publishChannelPolicyEnforcedUpdate(h.th.Context, h.th.BasicChannel.Id)
	}

	published := captureWebsocketEvents(t, h, publish)[model.WebsocketEventChannelAccessControlUpdated]
	require.Len(t, published, 1)
	broadcast := published[0].GetBroadcast()
	require.Contains(t, broadcast.BroadcastHooks, broadcastChannelReadAccessRedact)
	require.NotContains(t, broadcast.BroadcastHooks, broadcastChannelReadAccess)
	require.Contains(t, broadcast.BroadcastHookArgs, map[string]any{"channel_id": h.th.BasicChannel.Id})

	h.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
	})

	published = captureWebsocketEvents(t, h, publish)[model.WebsocketEventChannelAccessControlUpdated]
	require.Len(t, published, 1)
	require.NotContains(t, published[0].GetBroadcast().BroadcastHooks, broadcastChannelReadAccessRedact)
}

// requireReadAccessHook runs a publisher with read-access enforcement on and then off,
// and requires every event it published of the given types to carry the read-access hook
// for BasicChannel in the first run and not in the second.
func requireReadAccessHook(t *testing.T, h *channelReadAccessHarness, eventTypes []model.WebsocketEventType, run func(*testing.T, *channelReadAccessHarness)) {
	t.Helper()

	events := captureWebsocketEvents(t, h, run)
	for _, eventType := range eventTypes {
		require.NotEmpty(t, events[eventType], "%s was not published", eventType)
		for _, event := range events[eventType] {
			require.Contains(t, event.GetBroadcast().BroadcastHooks, broadcastChannelReadAccess, "%s", eventType)
			require.Contains(t, event.GetBroadcast().BroadcastHookArgs,
				map[string]any{"channel_id": h.th.BasicChannel.Id}, "%s", eventType)
		}
	}

	// Turning ABAC off rather than dropping the license, so that the
	// publishers under test keep whatever licensing they need of their own.
	h.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
	})

	events = captureWebsocketEvents(t, h, run)
	for _, eventType := range eventTypes {
		require.NotEmpty(t, events[eventType], "%s was not published", eventType)
		for _, event := range events[eventType] {
			require.NotContains(t, event.GetBroadcast().BroadcastHooks, broadcastChannelReadAccess, "%s", eventType)
		}
	}
}

// captureWebsocketEvents runs the publisher and returns the websocket events it
// published, grouped by event type.
func captureWebsocketEvents(t *testing.T, h *channelReadAccessHarness, run func(*testing.T, *channelReadAccessHarness)) map[model.WebsocketEventType][]*model.WebSocketEvent {
	t.Helper()

	cluster := &testlib.FakeClusterInterface{}
	h.th.Server.Platform().SetCluster(cluster)
	run(t, h)

	events := map[model.WebsocketEventType][]*model.WebSocketEvent{}
	for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventPublish
	}) {
		event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
		require.NoError(t, err)
		events[event.EventType()] = append(events[event.EventType()], event)
	}
	return events
}

// An email reaches no session, so a policy can't be evaluated for its recipient: while
// channel_read_access governs the channel, every recipient gets the generic email.
func TestNotificationEmailWithholdsContentsUnderReadAccessPolicy(t *testing.T) {
	// Creating a post also sends push notifications in the background, whose content gate
	// asks the mock ACS questions this test doesn't answer and races its assertions.
	disablePushes := func(h *channelReadAccessHarness) {
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.EmailSettings.SendPushNotifications = false
		})
	}

	buildFor := func(t *testing.T, h *channelReadAccessHarness, channel *model.Channel) *model.EmailNotification {
		t.Helper()

		disablePushes(h)
		post := h.th.CreatePost(t, channel)
		notification := buildTestPostNotification(post, channel, h.th.BasicUser)
		return h.th.App.buildEmailNotification(h.rctx, notification, h.th.BasicUser2, h.th.BasicTeam)
	}

	requireWithheld := func(t *testing.T, email *model.EmailNotification) {
		t.Helper()
		require.Empty(t, email.MessageHTML)
		require.Empty(t, email.MessageText)
	}

	requireFull := func(t *testing.T, email *model.EmailNotification) {
		t.Helper()
		require.NotEmpty(t, email.MessageHTML)
		require.NotEmpty(t, email.MessageText)
	}

	t.Run("withheld when a permission policy governs the action", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		requireWithheld(t, buildFor(t, h, h.th.BasicChannel))
	})

	t.Run("withheld when the channel's own policy governs the action", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)
		channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, true)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		requireWithheld(t, buildFor(t, h, channel))
	})

	t.Run("full when the channel's policy governs only other actions", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)
		channelPolicyGoverns(mockACS, h.th.BasicChannel.Id, false)

		channel := h.th.BasicChannel.DeepCopy()
		channel.PolicyEnforced = true
		requireFull(t, buildFor(t, h, channel))
	})

	t.Run("full when enforcement is off", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		requireFull(t, buildFor(t, h, h.th.BasicChannel))
	})

	t.Run("full in a group message, which the action never governs", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)

		channel := h.th.CreateGroupChannel(t, h.th.BasicUser2, h.th.CreateUser(t))
		requireFull(t, buildFor(t, h, channel))
		mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
	})

	t.Run("a batched email carries the decision to the batch", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			// Batching is invalid without a site URL.
			*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
			*cfg.EmailSettings.EnableEmailBatching = true
		})
		require.True(t, *h.th.App.Config().EmailSettings.EnableEmailBatching)
		require.Nil(t, h.th.App.UpdatePreferences(h.th.Context, h.th.BasicUser2.Id, model.Preferences{{
			UserId:   h.th.BasicUser2.Id,
			Category: model.PreferenceCategoryNotifications,
			Name:     model.PreferenceNameEmailInterval,
			Value:    "900",
		}}))

		emailServiceMock := &emailmocks.ServiceInterface{}
		emailServiceMock.On("AddNotificationEmailToBatch", mock.Anything, mock.Anything, mock.Anything, true).Return(nil)
		emailServiceMock.On("InitEmailBatching").Return().Maybe()
		emailServiceMock.On("Stop").Return().Maybe()
		original := h.th.App.Srv().EmailService
		h.th.App.Srv().EmailService = emailServiceMock
		t.Cleanup(func() { h.th.App.Srv().EmailService = original })

		disablePushes(h)
		post := h.th.CreatePost(t, h.th.BasicChannel)
		notification := buildTestPostNotification(post, h.th.BasicChannel, h.th.BasicUser)
		emailNotification, err := h.th.App.sendNotificationEmail(h.rctx, notification, h.th.BasicUser2, h.th.BasicTeam, nil)
		require.NoError(t, err)
		requireWithheld(t, emailNotification)
		emailServiceMock.AssertExpectations(t)
	})
}

// TestAttachChannelReadAccessHook covers the pre-publish hook that gives channel events the
// read-access hook without their publishers opting in.
func TestAttachChannelReadAccessHook(t *testing.T) {
	event := func(eventType model.WebsocketEventType, channelID, userID string) *model.WebSocketEvent {
		return model.NewWebSocketEvent(eventType, "", channelID, userID, nil, "")
	}

	requireHooked := func(t *testing.T, message *model.WebSocketEvent, channelID string) {
		t.Helper()
		require.Equal(t, []string{broadcastChannelReadAccess}, message.GetBroadcast().BroadcastHooks)
		require.Equal(t, []map[string]any{{"channel_id": channelID}}, message.GetBroadcast().BroadcastHookArgs)
	}

	t.Run("hooks a content event in a governed channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		message := event(model.WebsocketEventReactionAdded, h.th.BasicChannel.Id, "")
		h.th.App.attachChannelReadAccessHook(message)
		requireHooked(t, message, h.th.BasicChannel.Id)
	})

	t.Run("hooks an event sent to one user in a governed channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		message := event(model.WebsocketEventPersistentNotificationTriggered, h.th.BasicChannel.Id, h.th.BasicUser2.Id)
		h.th.App.attachChannelReadAccessHook(message)
		requireHooked(t, message, h.th.BasicChannel.Id)
	})

	t.Run("leaves a channel no policy governs alone", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		h.mockACS(t).On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
			Return(false, nil)

		message := event(model.WebsocketEventReactionAdded, h.th.BasicChannel.Id, "")
		h.th.App.attachChannelReadAccessHook(message)
		require.Empty(t, message.GetBroadcast().BroadcastHooks)
	})

	t.Run("leaves everything alone while enforcement is off", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		message := event(model.WebsocketEventReactionAdded, h.th.BasicChannel.Id, "")
		h.th.App.attachChannelReadAccessHook(message)
		require.Empty(t, message.GetBroadcast().BroadcastHooks)
		mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
	})

	t.Run("leaves events without a channel, DMs and GMs alone", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)

		dm := h.th.CreateDmChannel(t, h.th.BasicUser2)
		gm := h.th.CreateGroupChannel(t, h.th.BasicUser2, h.th.CreateUser(t))
		for _, channelID := range []string{"", dm.Id, gm.Id} {
			message := event(model.WebsocketEventReactionAdded, channelID, "")
			h.th.App.attachChannelReadAccessHook(message)
			require.Empty(t, message.GetBroadcast().BroadcastHooks, "channel %q", channelID)
		}
		mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
	})

	t.Run("hooks a plugin event sent to a governed channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		message := event("custom_com.example.plugin_refresh", h.th.BasicChannel.Id, "")
		h.th.App.attachChannelReadAccessHook(message)
		requireHooked(t, message, h.th.BasicChannel.Id)
	})

	t.Run("leaves exempt events alone", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)

		for _, eventType := range []model.WebsocketEventType{
			model.WebsocketEventUserRemoved,
			model.WebsocketEventChannelDeleted,
			model.WebsocketEventTyping,
			model.WebsocketEventEphemeralMessage,
			model.WebsocketEventThreadReadChanged,
		} {
			message := event(eventType, h.th.BasicChannel.Id, "")
			h.th.App.attachChannelReadAccessHook(message)
			require.Empty(t, message.GetBroadcast().BroadcastHooks, "%s", eventType)
		}
		mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
	})

	t.Run("channel_access_control_updated keeps only its redacting hook", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		message := event(model.WebsocketEventChannelAccessControlUpdated, h.th.BasicChannel.Id, "")
		useChannelReadAccessRedactHook(message, h.th.BasicChannel.Id)
		h.th.App.attachChannelReadAccessHook(message)
		require.Equal(t, []string{broadcastChannelReadAccessRedact}, message.GetBroadcast().BroadcastHooks)
	})

	t.Run("doesn't hook an event twice", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		message := event(model.WebsocketEventReactionAdded, h.th.BasicChannel.Id, "")
		h.th.App.attachChannelReadAccessHook(message)
		h.th.App.attachChannelReadAccessHook(message)
		requireHooked(t, message, h.th.BasicChannel.Id)
	})

	t.Run("hooks the event when the channel can't be resolved", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		h.mockACS(t)

		channelID := model.NewId()
		message := event(model.WebsocketEventReactionAdded, channelID, "")
		h.th.App.attachChannelReadAccessHook(message)
		requireHooked(t, message, channelID)
	})
}

// TestPublishAttachesTheReadAccessHook covers the wiring: publishers that never call a
// read-access helper still get the hook, because Publish attaches it.
func TestPublishAttachesTheReadAccessHook(t *testing.T) {
	t.Run("persistent_notification_triggered", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		h.th.AddUserToChannel(t, h.th.BasicUser2, h.th.BasicChannel)
		mockACS := h.mockACS(t)
		governed(mockACS)
		// The push path evaluates the recipient's access before the event is published.
		decides(mockACS, true)

		events := []model.WebsocketEventType{model.WebsocketEventPersistentNotificationTriggered}
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			mentions := &MentionResults{Mentions: map[string]MentionType{h.th.BasicUser2.Id: KeywordMention}}
			profileMap := model.UserMap{h.th.BasicUser.Id: h.th.BasicUser, h.th.BasicUser2.Id: h.th.BasicUser2}
			require.NoError(t, h.th.App.sendPersistentNotifications(h.th.BasicPost, h.th.BasicChannel, h.th.BasicTeam,
				mentions, profileMap, map[string]map[string]model.StringMap{}))
		})
	})

	t.Run("an event published straight to the platform", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		events := []model.WebsocketEventType{model.WebsocketEventPostEdited}
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			h.th.Server.Platform().Publish(model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", h.th.BasicChannel.Id, "", nil, ""))
		})
	})

	// What the Agents plugin publishes while streaming a bot reply: the reply text,
	// sent to the whole channel.
	t.Run("a plugin event sent to the channel", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		governed(h.mockACS(t))

		events := []model.WebsocketEventType{"custom_mattermost-ai_postupdate"}
		requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
			api := NewPluginAPI(h.th.App, h.rctx, &model.Manifest{Id: "mattermost-ai"})
			api.PublishWebSocketEvent("postupdate", map[string]any{"post_id": model.NewId(), "next": "streamed reply"},
				&model.WebsocketBroadcast{ChannelId: h.th.BasicChannel.Id})
		})
	})
}

// TestPostRevealedCarriesTheReadAccessHook covers post_revealed, which carries the revealed
// post to one user with no channel in its broadcast, so Publish can't hook it.
func TestPostRevealedCarriesTheReadAccessHook(t *testing.T) {
	h := setupChannelReadAccessTest(t)
	// The hook is only attached where read access is governed.
	governed(h.mockACS(t))

	events := []model.WebsocketEventType{model.WebsocketEventPostRevealed}
	requireReadAccessHook(t, h, events, func(t *testing.T, h *channelReadAccessHarness) {
		require.Nil(t, h.th.App.publishPostRevealedEventToAuthor(h.rctx, h.th.BasicPost, h.th.BasicUser2.Id, ""))
		require.Nil(t, h.th.App.publishPostRevealedEventToUser(h.rctx, h.th.BasicPost, h.th.BasicUser2.Id, ""))
	})
}

// The push worker has no session for the recipient, so a policy on session attributes
// can't be evaluated for the badge. It counts every channel, denied ones included.
func TestUserBadgeCountIncludesDeniedChannels(t *testing.T) {
	h := setupChannelReadAccessTest(t)
	user := h.th.BasicUser2
	h.th.AddUserToChannel(t, user, h.th.BasicChannel)
	require.NoError(t, h.th.App.Srv().Store().Channel().IncrementMentionCount(h.th.BasicChannel.Id, []string{user.Id}, false, false))

	mockACS := h.mockACS(t)
	governed(mockACS)
	decides(mockACS, false)

	badge, appErr := h.th.App.getUserBadgeCount(user.Id, false)
	require.Nil(t, appErr)
	require.Equal(t, 1, badge)
	mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
}
