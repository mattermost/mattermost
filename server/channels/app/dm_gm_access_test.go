// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// isDMGMRequest matches an evaluation of action against the system permission
// resource, which is the only resource the direct and group message actions are
// evaluated on.
func isDMGMRequest(action string) func(model.AccessRequest) bool {
	return func(req model.AccessRequest) bool {
		return req.Action == action &&
			req.Resource.Type == model.AccessControlPolicyTypePermission &&
			req.Resource.ID == ""
	}
}

// decidesDMGM answers each listed direct and group message action on the system
// resource. Any other evaluation fails the test.
func decidesDMGM(mockACS *eMocks.AccessControlServiceInterface, allow map[string]bool) {
	for action, allowed := range allow {
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(isDMGMRequest(action))).
			Return(model.AccessDecision{Decision: allowed}, nil)
	}
}

// allDMGMGoverned puts every direct and group message action in play.
func allDMGMGoverned(mockACS *eMocks.AccessControlServiceInterface) {
	for _, action := range model.DMGMActions() {
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, action).Return(true, nil)
	}
}

// requireEvaluatedOnly asserts every evaluation was of action on the system resource.
func requireEvaluatedOnly(t *testing.T, mockACS *eMocks.AccessControlServiceInterface, action string) {
	t.Helper()
	evaluated := 0
	for _, call := range mockACS.Calls {
		if call.Method != "AccessEvaluation" {
			continue
		}
		evaluated++
		require.True(t, isDMGMRequest(action)(call.Arguments.Get(1).(model.AccessRequest)),
			"unexpected evaluation: %+v", call.Arguments.Get(1))
	}
	require.NotZero(t, evaluated, "expected %s to be evaluated", action)
}

type dmGmFixture struct {
	*channelReadAccessHarness
	dm *model.Channel
	gm *model.Channel
}

// setupDMGMAccessTest creates a DM and a GM before any mock is installed: a bare
// mock panics on the broadcast hooks a channel creation runs.
func setupDMGMAccessTest(t *testing.T) *dmGmFixture {
	t.Helper()
	h := setupChannelReadAccessTest(t)
	// A post in a conversation pushes to the other members asynchronously; that push
	// must not reach the access control service after a test has restored it.
	h.th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.EmailSettings.SendPushNotifications = false
	})
	return &dmGmFixture{
		channelReadAccessHarness: h,
		dm:                       h.th.CreateDmChannel(t, h.th.BasicUser2),
		gm:                       h.th.CreateGroupChannel(t, h.th.BasicUser2, h.th.SystemAdminUser),
	}
}

func TestDMGMAccessEvaluation(t *testing.T) {
	t.Run("evaluates the system resource without a channel role", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: true})

		require.True(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))

		requireEvaluatedOnly(t, mockACS, model.AccessControlPolicyActionDMGMReadAccess)
		req := mockACS.Calls[len(mockACS.Calls)-1].Arguments.Get(1).(model.AccessRequest)
		require.Equal(t, f.th.BasicUser.Id, req.Subject.ID)
		require.Empty(t, req.Subject.RoleForScope(model.AccessControlSubjectScopeChannel),
			"a conversation has no channel policy, so the subject carries no channel role")
	})

	t.Run("one evaluation covers every conversation in the request", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: true})

		require.True(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.HasChannelReadAccessByID(f.rctx, f.th.BasicUser.Id, f.gm.Id))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
		mockACS.AssertNumberOfCalls(t, "ActionHasPermissionPolicy", 1)
	})

	t.Run("a filter drops every conversation with one evaluation", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		// No memo on the caller's context: the filter installs its own.
		bare := f.th.Context.WithSession(f.rctx.Session())
		kept := f.th.App.FilterChannelsByReadAccess(bare, f.th.BasicUser.Id, []*model.Channel{f.dm, f.th.BasicChannel, f.gm})
		require.Equal(t, []*model.Channel{f.th.BasicChannel}, kept)
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})

	t.Run("allows without evaluating when the action is ungoverned", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)

		require.True(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.HasChannelWriteAccess(f.rctx, f.th.BasicUser.Id, f.gm))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluates anyway when the governance check errors", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionDMGMReadAccess).
			Return(false, model.NewAppError("ActionHasPermissionPolicy", "boom", nil, "", http.StatusInternalServerError))
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		require.False(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
	})

	t.Run("denies and returns the error when the evaluation errors", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		allowed, appErr := f.th.App.evaluateDMGMAccess(f.rctx, f.th.BasicUser.Id, model.AccessControlPolicyActionDMGMReadAccess)
		require.False(t, allowed)
		require.NotNil(t, appErr)
		require.False(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
	})

	t.Run("denies and returns the error when the subject cannot be built", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)

		allowed, appErr := f.th.App.evaluateDMGMAccess(f.rctx, model.NewId(), model.AccessControlPolicyActionDMGMReadAccess)
		require.False(t, allowed)
		require.NotNil(t, appErr)
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluates another user without the session", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		require.False(t, f.th.App.HasDMGMAccess(f.rctx, f.th.BasicUser2.Id, model.AccessControlPolicyActionDMGMReadAccess))
		req := mockACS.Calls[len(mockACS.Calls)-1].Arguments.Get(1).(model.AccessRequest)
		require.Equal(t, f.th.BasicUser2.Id, req.Subject.ID)
		require.Empty(t, req.Subject.Session)
	})

	t.Run("write is independent of read", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{
			model.AccessControlPolicyActionDMGMReadAccess:  false,
			model.AccessControlPolicyActionDMGMWriteAccess: true,
		})

		require.False(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.EnforceChannelWriteAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.EnforceChannelManagementAccess(f.rctx, f.th.BasicUser.Id, f.gm),
			"management in a conversation is the write action")
		require.True(t, f.th.App.DirectAndGroupHidden(f.rctx, f.th.BasicUser.Id))
	})

	t.Run("channel actions are never asked about a conversation", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{
			model.AccessControlPolicyActionDMGMReadAccess:  true,
			model.AccessControlPolicyActionDMGMWriteAccess: true,
		})

		require.True(t, f.th.App.EnforceChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.EnforceChannelWriteAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		require.True(t, f.th.App.EnforceChannelManagementAccess(f.rctx, f.th.BasicUser.Id, f.dm))
		for _, action := range []string{
			model.AccessControlPolicyActionChannelReadAccess,
			model.AccessControlPolicyActionChannelWriteAccess,
			model.AccessControlPolicyActionChannelManagementAccess,
		} {
			mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, action)
		}
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})
}

func TestDMGMAccessIsInertUntilEnabled(t *testing.T) {
	for name, disable := range map[string]func(h *channelReadAccessHarness){
		"attribute-based access control disabled": func(h *channelReadAccessHarness) {
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
		},
		"licence below Enterprise Advanced": func(h *channelReadAccessHarness) {
			h.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
		},
	} {
		t.Run(name, func(t *testing.T) {
			f := setupDMGMAccessTest(t)
			mockACS := f.mockACS(t)
			disable(f.channelReadAccessHarness)

			for _, action := range model.DMGMActions() {
				require.True(t, f.th.App.HasDMGMAccess(f.rctx, f.th.BasicUser.Id, action))
			}
			require.True(t, f.th.App.HasChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm))
			require.True(t, f.th.App.EnforceChannelWriteAccess(f.rctx, f.th.BasicUser.Id, f.gm))
			require.False(t, f.th.App.DirectAndGroupHidden(f.rctx, f.th.BasicUser.Id))
			require.Empty(t, mockACS.Calls)
		})
	}
}

func TestDMGMAccessRecordsTheDenyingAction(t *testing.T) {
	t.Run("a conversation gate records the direct and group message action", func(t *testing.T) {
		for _, tc := range []struct {
			name    string
			enforce func(f *dmGmFixture) bool
			action  string
		}{
			{"read", func(f *dmGmFixture) bool {
				return f.th.App.EnforceChannelReadAccess(f.rctx, f.th.BasicUser.Id, f.dm)
			}, model.AccessControlPolicyActionDMGMReadAccess},
			{"read by id", func(f *dmGmFixture) bool {
				return f.th.App.EnforceChannelReadAccessByID(f.rctx, f.th.BasicUser.Id, f.dm.Id)
			}, model.AccessControlPolicyActionDMGMReadAccess},
			{"write by id", func(f *dmGmFixture) bool {
				return f.th.App.EnforceChannelWriteAccessByID(f.rctx, f.th.BasicUser.Id, f.gm.Id)
			}, model.AccessControlPolicyActionDMGMWriteAccess},
			{"management by id", func(f *dmGmFixture) bool {
				return f.th.App.EnforceChannelManagementAccessByID(f.rctx, f.th.BasicUser.Id, f.dm.Id)
			}, model.AccessControlPolicyActionDMGMWriteAccess},
		} {
			t.Run(tc.name, func(t *testing.T) {
				f := setupDMGMAccessTest(t)
				mockACS := f.mockACS(t)
				allDMGMGoverned(mockACS)
				decidesDMGM(mockACS, map[string]bool{
					model.AccessControlPolicyActionDMGMReadAccess:  false,
					model.AccessControlPolicyActionDMGMWriteAccess: false,
				})

				require.False(t, tc.enforce(f))
				_, action := ChannelAccessEnforcementDenial(f.rctx)
				require.Equal(t, tc.action, action, "web.SetPermissionError switches on this to pick the error id")
			})
		}
	})

	t.Run("records without a channel", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		require.False(t, f.th.App.EnforceDMGMAccess(f.rctx, f.th.BasicUser.Id, model.AccessControlPolicyActionDMGMStart))
		channelID, action := ChannelAccessEnforcementDenial(f.rctx)
		require.Empty(t, channelID)
		require.Equal(t, model.AccessControlPolicyActionDMGMStart, action)
	})

	t.Run("a third-party evaluation does not record", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		require.False(t, f.th.App.EnforceDMGMAccess(f.rctx, f.th.BasicUser2.Id, model.AccessControlPolicyActionDMGMReadAccess))
		require.False(t, f.th.App.EnforceChannelReadAccess(f.rctx, f.th.BasicUser2.Id, f.dm))
		_, action := ChannelAccessEnforcementDenial(f.rctx)
		require.Empty(t, action)
	})

	t.Run("a non-conversation action still needs a channel", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		f.th.App.noteChannelAccessEnforcementDenial(f.rctx, f.th.BasicUser.Id, "", model.AccessControlPolicyActionChannelReadAccess)
		_, action := ChannelAccessEnforcementDenial(f.rctx)
		require.Empty(t, action)
	})
}

func TestDMGMGetPostIfAuthorized(t *testing.T) {
	f := setupDMGMAccessTest(t)
	post, _, appErr := f.th.App.CreatePost(f.th.Context, &model.Post{
		UserId:    f.th.BasicUser2.Id,
		ChannelId: f.dm.Id,
		Message:   "hello",
	}, f.dm, model.CreatePostFlags{})
	require.Nil(t, appErr)

	mockACS := f.mockACS(t)
	allDMGMGoverned(mockACS)
	decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

	_, appErr, _ = f.th.App.GetPostIfAuthorized(f.rctx, post.Id, f.rctx.Session(), false)
	require.NotNil(t, appErr)
	require.Equal(t, "api.channel.dm_gm_read_access.abac_denied.app_error", appErr.Id)
	require.Equal(t, http.StatusForbidden, appErr.StatusCode)
}

func TestSearchAllowedActionsDMGM(t *testing.T) {
	systemResource := model.Resource{Type: model.AccessControlPolicyTypePermission, ID: ""}
	search := func(t *testing.T, h *channelReadAccessHarness, actions []string) *model.ActionSearchResponse {
		t.Helper()
		resp, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.rctx, model.ActionSearchRequest{
			Resource: systemResource,
			Actions:  actions,
		})
		require.Nil(t, appErr)
		return resp
	}

	t.Run("targeted and discovery modes return the three actions", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		allDMGMGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{
			model.AccessControlPolicyActionDMGMStart:       true,
			model.AccessControlPolicyActionDMGMReadAccess:  false,
			model.AccessControlPolicyActionDMGMWriteAccess: true,
		})

		targeted := search(t, h, model.DMGMActions())
		discovered := search(t, h, nil)
		for _, resp := range []*model.ActionSearchResponse{targeted, discovered} {
			require.Equal(t, systemResource, resp.Resource)
			require.Len(t, resp.Decisions, 3)
			require.Equal(t, model.RenderPermissionDecision{Allowed: true, Evaluated: true}, resp.Decisions[model.AccessControlPolicyActionDMGMStart])
			require.Equal(t, model.RenderPermissionDecision{Allowed: false, Evaluated: true}, resp.Decisions[model.AccessControlPolicyActionDMGMReadAccess])
			require.Equal(t, model.RenderPermissionDecision{Allowed: true, Evaluated: true}, resp.Decisions[model.AccessControlPolicyActionDMGMWriteAccess])
			require.Len(t, resp.Results, 2)
		}
	})

	for name, disable := range map[string]func(h *channelReadAccessHarness){
		"ABAC disabled": func(h *channelReadAccessHarness) {
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
		},
		// The channel branch skips the licence check; this one matches enforcement.
		"unlicensed": func(h *channelReadAccessHarness) {
			h.th.App.Srv().SetLicense(nil)
		},
	} {
		t.Run(name+" allows without consulting the access control service", func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			disable(h)

			resp := search(t, h, nil)
			require.Len(t, resp.Decisions, 3)
			for _, action := range model.DMGMActions() {
				require.Equal(t, model.RenderPermissionDecision{Allowed: true, Evaluated: true}, resp.Decisions[action])
			}
			require.Empty(t, mockACS.Calls)
		})
	}

	t.Run("an ungoverned action is allowed without evaluating", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)

		resp := search(t, h, nil)
		require.Len(t, resp.Results, 3)
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("an evaluation error denies with a reason", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		allDMGMGoverned(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		resp := search(t, h, []string{model.AccessControlPolicyActionDMGMReadAccess})
		require.Equal(t, model.RenderPermissionDecision{
			Allowed:   false,
			Evaluated: true,
			Reason:    model.RenderDecisionReasonRestrictedByPolicy,
		}, resp.Decisions[model.AccessControlPolicyActionDMGMReadAccess])
	})

	t.Run("the actions are rejected on a channel resource and channel actions on the system resource", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)

		_, appErr := h.th.App.SearchAllowedActionsForCurrentUser(h.rctx, model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id},
			Actions:  []string{model.AccessControlPolicyActionDMGMReadAccess},
		})
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		_, appErr = h.th.App.SearchAllowedActionsForCurrentUser(h.rctx, model.ActionSearchRequest{
			Resource: systemResource,
			Actions:  []string{model.AccessControlPolicyActionChannelReadAccess},
		})
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	for _, want := range []bool{true, false} {
		t.Run(fmt.Sprintf("render matches enforcement (pdp=%v)", want), func(t *testing.T) {
			h := setupChannelReadAccessTest(t)
			mockACS := h.mockACS(t)
			allDMGMGoverned(mockACS)
			decidesDMGM(mockACS, map[string]bool{
				model.AccessControlPolicyActionDMGMStart:       want,
				model.AccessControlPolicyActionDMGMReadAccess:  want,
				model.AccessControlPolicyActionDMGMWriteAccess: want,
			})

			resp := search(t, h, nil)
			for _, action := range model.DMGMActions() {
				enforced := h.th.App.HasDMGMAccess(WithChannelAccessMemo(h.th.Context.WithSession(h.rctx.Session())), h.th.BasicUser.Id, action)
				require.Equal(t, want, enforced)
				require.Equal(t, enforced, resp.Decisions[action].Allowed, action)
			}
		})
	}
}

// A conversation post linked from a channel post is never unfurled while reading
// conversations is governed, so no recipient has to be evaluated for the embed.
func TestDMGMPermalinkPreviewWithheld(t *testing.T) {
	setup := func(t *testing.T, readGoverned bool) (*dmGmFixture, *model.Post) {
		f := setupDMGMAccessTest(t)
		dmPost, _, appErr := f.th.App.CreatePost(f.th.Context, &model.Post{
			UserId:    f.th.BasicUser.Id,
			ChannelId: f.dm.Id,
			Message:   "linked",
		}, f.dm, model.CreatePostFlags{})
		require.Nil(t, appErr)

		mockACS := f.mockACS(t)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionDMGMReadAccess).Return(readGoverned, nil)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, nil)
		return f, dmPost
	}
	hostPost := func(f *dmGmFixture, dmPost *model.Post) *model.Post {
		return &model.Post{
			UserId:    f.th.BasicUser.Id,
			ChannelId: f.th.BasicChannel.Id,
			Metadata: &model.PostMetadata{Embeds: []*model.PostEmbed{{
				Type: model.PostEmbedPermalink,
				Data: &model.PreviewPost{PostID: dmPost.Id, Post: dmPost},
			}}},
		}
	}
	hooked := func(t *testing.T, f *dmGmFixture, dmPost *model.Post) (*model.Post, bool) {
		t.Helper()
		post := hostPost(f, dmPost)
		post.Metadata.Embeds = nil
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", f.th.BasicChannel.Id, "", nil, "")
		appErr := f.th.App.setupBroadcastHookForPermalink(f.rctx, post, message, &model.PreviewPost{PostID: dmPost.Id, Post: dmPost}, dmPost.Id)
		require.Nil(t, appErr)
		return post, slices.Contains(message.GetBroadcast().BroadcastHooks, broadcastPermalink)
	}

	t.Run("withheld while governed", func(t *testing.T) {
		f, dmPost := setup(t, true)

		sanitized, _, appErr := f.th.App.SanitizePostMetadataForUser(f.rctx, hostPost(f, dmPost), f.th.BasicUser.Id)
		require.Nil(t, appErr)
		require.Nil(t, sanitized.GetPreviewPost(), "no embed over REST")

		post, hasHook := hooked(t, f, dmPost)
		require.False(t, hasHook, "no permalink hook on the WebSocket event")
		require.Empty(t, post.Metadata.Embeds)
		mockACS := f.th.App.Srv().ch.AccessControl.(*eMocks.AccessControlServiceInterface)
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("unfurled while ungoverned", func(t *testing.T) {
		f, dmPost := setup(t, false)

		sanitized, _, appErr := f.th.App.SanitizePostMetadataForUser(f.rctx, hostPost(f, dmPost), f.th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, sanitized.GetPreviewPost())

		post, hasHook := hooked(t, f, dmPost)
		require.True(t, hasHook)
		require.Len(t, post.Metadata.Embeds, 1)
	})
}

func TestDMGMStartAllowedForSession(t *testing.T) {
	f := setupDMGMAccessTest(t)
	mockACS := f.mockACS(t)
	allDMGMGoverned(mockACS)
	decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

	require.False(t, f.th.App.DMGMStartAllowedForSession(f.rctx, f.th.BasicUser.Id))
	require.True(t, f.th.App.DMGMStartAllowedForSession(f.rctx, f.th.BasicUser2.Id),
		"a conversation started on someone else's behalf, such as by a system bot, is never refused")
	require.True(t, f.th.App.DMGMStartAllowedForSession(f.rctx, ""))
	mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
}

func TestDMGMGetDirectOrGroupChannelByName(t *testing.T) {
	f := setupDMGMAccessTest(t)

	channel, appErr := f.th.App.GetDirectOrGroupChannelByName(f.rctx, f.dm.Name)
	require.Nil(t, appErr)
	require.Equal(t, f.dm.Id, channel.Id)

	channel, appErr = f.th.App.GetDirectOrGroupChannelByName(f.rctx, model.GetDMNameFromIds(f.th.BasicUser.Id, model.NewId()))
	require.Nil(t, appErr)
	require.Nil(t, channel)
}
