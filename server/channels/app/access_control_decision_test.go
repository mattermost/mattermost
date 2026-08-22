// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
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
	disableABAC := func(t *testing.T) {
		t.Helper()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
	}

	withMockACS := func(t *testing.T) *eMocks.AccessControlServiceInterface {
		t.Helper()
		mockACS := &eMocks.AccessControlServiceInterface{}
		original := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = original })
		return mockACS
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
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id},
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("ABAC inactive returns allowed and evaluated", func(t *testing.T) {
		disableABAC(t)
		original := th.App.Srv().ch.AccessControl
		th.App.Srv().ch.AccessControl = nil
		defer func() { th.App.Srv().ch.AccessControl = original }()

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Decisions, 2)
		for _, action := range []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment} {
			require.True(t, resp.Decisions[action].Evaluated, action)
			require.True(t, resp.Decisions[action].Allowed, action)
			require.Empty(t, resp.Decisions[action].Reason, action)
		}
	})

	t.Run("ABAC allow returns allowed", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Nil(t, appErr)
		require.True(t, resp.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, resp.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})

	t.Run("ABAC deny returns not allowed", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Nil(t, appErr)
		require.False(t, resp.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, resp.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})

	t.Run("evaluation error fails closed for sensitive action", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("test", "test.error", nil, "", 500))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		d := resp.Decisions[model.AccessControlPolicyActionDownloadFileAttachment]
		require.False(t, d.Allowed)
		require.True(t, d.Evaluated)
		require.Equal(t, model.RenderDecisionReasonRestrictedByPolicy, d.Reason)
	})

	t.Run("builds subject once and evaluates once per action", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Decisions, 2)
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	for _, want := range []bool{true, false} {
		t.Run(fmt.Sprintf("render decision matches enforcement (pdp=%v)", want), func(t *testing.T) {
			enableABAC(t)
			mockACS := withMockACS(t)

			mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
				return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
			})).Return(model.AccessDecision{Decision: want}, (*model.AppError)(nil))

			resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
				Resource: channelResource,
				Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			})
			require.Nil(t, appErr)

			enforced := th.App.HasPermissionToFileAction(rctx, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionUploadFileAttachment)
			require.Equal(t, enforced, resp.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
			require.Equal(t, want, enforced)
		})
	}

	// --- Discovery mode ---

	t.Run("discovery mode ABAC inactive returns all registry actions in results", func(t *testing.T) {
		disableABAC(t)

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Decisions, 2)
		require.Len(t, resp.Results, 2)
		resultNames := make(map[string]bool, len(resp.Results))
		for _, r := range resp.Results {
			resultNames[r.Action.Name] = true
		}
		require.True(t, resultNames[model.AccessControlPolicyActionUploadFileAttachment])
		require.True(t, resultNames[model.AccessControlPolicyActionDownloadFileAttachment])
	})

	t.Run("discovery mode ABAC active permitted in results denied excluded", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
		})
		require.Nil(t, appErr)
		require.Len(t, resp.Decisions, 2)
		require.Len(t, resp.Results, 1)
		require.Equal(t, model.AccessControlPolicyActionUploadFileAttachment, resp.Results[0].Action.Name)
	})

	t.Run("discovery mode wrong resource type returns empty candidates without error", func(t *testing.T) {
		disableABAC(t)

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id},
			// No actions → discovery mode, but no registry entries for team type.
		})
		require.Nil(t, appErr)
		require.Empty(t, resp.Decisions)
		require.Empty(t, resp.Results)
	})

	t.Run("discovery mode results order is deterministic", func(t *testing.T) {
		disableABAC(t)

		var firstOrder []string
		for i := range 5 {
			resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
				Resource: channelResource,
			})
			require.Nil(t, appErr)
			names := make([]string, len(resp.Results))
			for j, r := range resp.Results {
				names[j] = r.Action.Name
			}
			if i == 0 {
				firstOrder = names
			} else {
				require.Equal(t, firstOrder, names, "Results order changed on iteration %d", i)
			}
		}
	})

	t.Run("results is empty slice not nil when all denied", func(t *testing.T) {
		enableABAC(t)
		mockACS := withMockACS(t)

		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Nil(t, appErr)
		require.Empty(t, resp.Results)

		// Wire check: "results":[] not "results":null
		wire, err := json.Marshal(resp)
		require.NoError(t, err)
		require.Contains(t, string(wire), `"results":[]`)
		require.Contains(t, string(wire), `"decisions":{`)
	})

	t.Run("subject matching session user is accepted", func(t *testing.T) {
		disableABAC(t)

		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Subject:  &model.ActionSearchSubject{ID: session.UserId},
		})
		require.Nil(t, appErr)
	})

	t.Run("subject not matching session user returns 403", func(t *testing.T) {
		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Subject:  &model.ActionSearchSubject{ID: model.NewId()},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 403, appErr.StatusCode)
	})

	t.Run("subject invalid ID format returns 400 from IsValid", func(t *testing.T) {
		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Subject:  &model.ActionSearchSubject{ID: "not-a-valid-id"},
		})
		require.NotNil(t, appErr)
		require.Equal(t, 400, appErr.StatusCode)
	})
}
