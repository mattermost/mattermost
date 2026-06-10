// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func TestSearchAccessControlDecisionActions(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeBasedAccessControl = true
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	channelResource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id}

	t.Run("requires a session", func(t *testing.T) {
		client := th.CreateClient() // unauthenticated
		_, resp, err := client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("unsupported action returns bad request", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{"definitely_not_a_real_action"},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid request returns bad request", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: model.Resource{Type: "", ID: th.BasicChannel.Id},
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("returns allowed when ABAC is inactive", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment, model.AccessControlPolicyActionDownloadFileAttachment},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, out.Actions, 2)
		require.True(t, out.Actions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, out.Actions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})

	t.Run("returns PDP deny for the session user", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})
		mockACS := &mocks.AccessControlServiceInterface{}
		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		defer func() { th.App.Srv().Channels().AccessControl = original }()

		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Resource.ID == th.BasicChannel.Id && req.Action == model.AccessControlPolicyActionUploadFileAttachment
		})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.False(t, out.Actions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, out.Actions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
	})
}
