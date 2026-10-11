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

	t.Run("unsupported resource type returns bad request", func(t *testing.T) {
		// A non-channel resource type must be rejected outright rather than silently skipping
		// the resource-access check. Discovery mode (no actions) previously returned an empty 200.
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: th.BasicTeam.Id},
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
		require.Len(t, out.Decisions, 2)
		require.True(t, out.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, out.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
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
		require.False(t, out.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
		require.True(t, out.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Evaluated)
		require.Empty(t, out.Results) // denied actions must not appear in the AuthZEN results list
	})

	t.Run("discovery mode returns all actions when ABAC inactive", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		// upload_file_attachment, download_file_attachment, channel_read_access,
		// channel_write_access, channel_management_access and
		// create_burn_on_read_post.
		require.Len(t, out.Decisions, 6)
		require.Len(t, out.Results, 6)
	})

	t.Run("subject not matching session user returns 403", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Subject:  &model.ActionSearchSubject{ID: model.NewId()},
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("subject matching session user is accepted", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Subject:  &model.ActionSearchSubject{ID: th.BasicUser.Id},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.True(t, out.Decisions[model.AccessControlPolicyActionUploadFileAttachment].Allowed)
	})

	t.Run("non-member of private channel returns 403", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
		// Create a private channel as system admin; BasicUser is not a member.
		privateCh, _, err := th.SystemAdminClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        model.NewId(),
			DisplayName: "Private Not Member",
			Type:        model.ChannelTypePrivate,
		})
		require.NoError(t, err)

		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: privateCh.Id},
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("page field accepted and ignored", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: channelResource,
			Actions:  []string{model.AccessControlPolicyActionUploadFileAttachment},
			Page:     &model.ActionSearchPage{NextToken: "tok"},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, out.Page)
	})
}

// channel_read_access is evaluated by the render-decision endpoint and listed
// in discovery mode.
func TestSearchAccessControlDecisionActionsChannelReadAccess(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	channelResource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id}

	targeted, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
		Actions:  []string{model.AccessControlPolicyActionChannelReadAccess},
	})
	require.NoError(t, err)
	require.Contains(t, targeted.Decisions, model.AccessControlPolicyActionChannelReadAccess)
	// ABAC is inactive in this fixture, so the registry default applies.
	require.True(t, targeted.Decisions[model.AccessControlPolicyActionChannelReadAccess].Allowed)

	discovered, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
	})
	require.NoError(t, err)
	require.Contains(t, discovered.Decisions, model.AccessControlPolicyActionChannelReadAccess)
	require.Contains(t, discovered.Decisions, model.AccessControlPolicyActionUploadFileAttachment)
}

// The composer resolves its disabled state through this endpoint, so
// channel_write_access has to be evaluated and listed in discovery mode.
func TestSearchAccessControlDecisionActionsChannelWriteAccess(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	channelResource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id}

	targeted, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
		Actions:  []string{model.AccessControlPolicyActionChannelWriteAccess},
	})
	require.NoError(t, err)
	require.Contains(t, targeted.Decisions, model.AccessControlPolicyActionChannelWriteAccess)
	// ABAC is inactive in this fixture, so the registry default applies — the
	// composer must not grey itself out on a server with the feature switched off.
	require.True(t, targeted.Decisions[model.AccessControlPolicyActionChannelWriteAccess].Allowed)

	discovered, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
	})
	require.NoError(t, err)
	require.Contains(t, discovered.Decisions, model.AccessControlPolicyActionChannelWriteAccess)
	require.Contains(t, discovered.Decisions, model.AccessControlPolicyActionChannelReadAccess)
}

func TestSearchAccessControlDecisionActionsChannelManagementAccess(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	channelResource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id}

	targeted, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
		Actions:  []string{model.AccessControlPolicyActionChannelManagementAccess},
	})
	require.NoError(t, err)
	require.Contains(t, targeted.Decisions, model.AccessControlPolicyActionChannelManagementAccess)
	// ABAC is inactive in this fixture, so the registry default applies — Channel
	// Settings must not go read-only on a server with the feature switched off.
	require.True(t, targeted.Decisions[model.AccessControlPolicyActionChannelManagementAccess].Allowed)

	discovered, _, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: channelResource,
	})
	require.NoError(t, err)
	require.Contains(t, discovered.Decisions, model.AccessControlPolicyActionChannelManagementAccess)
}

// The direct and group message actions are asked about the system resource
// {permission, ""}, never a conversation.
func TestSearchAccessControlDecisionActionsDMGM(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	systemResource := model.Resource{Type: model.AccessControlPolicyTypePermission, ID: ""}

	t.Run("discovery mode returns the three actions allowed when ABAC is inactive", func(t *testing.T) {
		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: systemResource,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, systemResource, out.Resource)
		require.Len(t, out.Decisions, 3)
		require.Len(t, out.Results, 3)
		for _, action := range model.DMGMActions() {
			require.Equal(t, model.RenderPermissionDecision{Allowed: true, Evaluated: true}, out.Decisions[action])
		}
	})

	t.Run("returns the PDP decision for the session user", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
		})
		mockACS := installMockACS(t, th)
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Action == model.AccessControlPolicyActionDMGMReadAccess &&
				req.Resource == systemResource &&
				req.Subject.ID == th.BasicUser.Id
		})).Return(model.AccessDecision{Decision: false}, nil)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{Decision: true}, nil)

		out, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: systemResource,
			Actions:  model.DMGMActions(),
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, model.RenderPermissionDecision{Allowed: false, Evaluated: true}, out.Decisions[model.AccessControlPolicyActionDMGMReadAccess])
		require.True(t, out.Decisions[model.AccessControlPolicyActionDMGMStart].Allowed)
		require.True(t, out.Decisions[model.AccessControlPolicyActionDMGMWriteAccess].Allowed)
		require.Len(t, out.Results, 2)
	})

	t.Run("a permission resource with an id returns bad request", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypePermission, ID: th.BasicChannel.Id},
			Actions:  model.DMGMActions(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Equal(t, "api.access_control.decision.unsupported_resource_type.app_error", err.(*model.AppError).Id)
	})

	t.Run("a channel action on the system resource returns bad request", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: systemResource,
			Actions:  []string{model.AccessControlPolicyActionChannelReadAccess},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("a direct and group message action on a channel returns bad request", func(t *testing.T) {
		_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: th.BasicChannel.Id},
			Actions:  []string{model.AccessControlPolicyActionDMGMReadAccess},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
