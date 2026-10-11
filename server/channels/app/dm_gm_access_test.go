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
