// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSearchAllowedActionsForCurrentUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	// rctx carrying a real session for BasicUser, required by the
	// session-subject build path.
	session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)
	rctx := th.Context.WithSession(session)

	channelResource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id}

	enableABAC := func(t *testing.T) {
		t.Helper()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})
	}

	withMockACS := func(t *testing.T) (*eMocks.AccessControlServiceInterface, func()) {
		t.Helper()
		mockACS := &eMocks.AccessControlServiceInterface{}
		original := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		return mockACS, func() { th.App.Srv().ch.AccessControl = original }
	}

	t.Run("invalid request returns bad request", func(t *testing.T) {
		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: model.Resource{Type: "", ID: th.BasicChannel.Id},
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("unsupported action returns bad request", func(t *testing.T) {
		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{"definitely_not_a_real_action"},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("action with wrong resource type returns bad request", func(t *testing.T) {
		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyScopeTeam, ID: th.BasicTeam.Id},
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("ABAC inactive returns allowed and evaluated", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
		original := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = nil
		defer func() { th.App.Srv().ch.AccessControl = original }()

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Actions, 2)
		for _, action := range []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment} {
			require.True(t, resp.Actions[action].Evaluated, action)
			require.True(t, resp.Actions[action].Allowed, action)
			require.Empty(t, resp.Actions[action].Reason, action)
		}
	})

	t.Run("ABAC allow returns allowed", func(t *testing.T) {
		enableABAC(t)
		mockACS, restore := withMockACS(t)
		defer restore()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Nil(t, appErr)
		require.True(t, resp.Actions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, resp.Actions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})

	t.Run("ABAC deny returns not allowed", func(t *testing.T) {
		enableABAC(t)
		mockACS, restore := withMockACS(t)
		defer restore()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Nil(t, appErr)
		require.False(t, resp.Actions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, resp.Actions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})

	t.Run("evaluation error fails closed for sensitive action", func(t *testing.T) {
		enableABAC(t)
		mockACS, restore := withMockACS(t)
		defer restore()

		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("test", "test.error", nil, "", 500))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		d := resp.Actions[model.AccessControlPolicyActionDownloadFileAttachment]
		require.False(t, d.Allowed)
		require.True(t, d.Evaluated)
		require.Equal(t, model.RenderDecisionReasonRestrictedByPolicy, d.Reason)
	})

	t.Run("builds subject once and evaluates once per action", func(t *testing.T) {
		enableABAC(t)
		mockACS, restore := withMockACS(t)
		defer restore()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Actions, 2)
		// One evaluation per requested action, against the same single subject.
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	t.Run("render decision matches enforcement decision", func(t *testing.T) {
		for _, want := range []bool{true, false} {
			enableABAC(t)
			mockACS, restore := withMockACS(t)

			mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
			})).Return(model.AccessDecision{Decision: want}, (*model.AppError)(nil))

			resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
				Resource: channelResource,
				Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			})
			require.Nil(t, appErr)

			enforced := th.App.HasPermissionToFileAction(rctx, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionUploadFileAttachment)
			require.Equal(t, enforced, resp.Actions[model.AccessControlPolicyActionUploadFileAttachment].Allowed, "render must equal enforcement (decision=%v)", want)
			require.Equal(t, want, enforced)

			restore()
		}
	})
}
