// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
		require.Len(t, out.Decisions, 3)
		require.Len(t, out.Results, 3)
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

func TestGetDelegatedAdminActions(t *testing.T) {
	th := Setup(t).InitBasic(t)

	const delegable = "run_test_delegable"
	const restricted = "run_test_restricted"
	delegablePermissions := []string{model.PermissionSysconsoleReadExperimentalBleve.Id, model.PermissionSysconsoleWriteExperimentalBleve.Id}
	model.RegisterActionsForTesting(t,
		model.ActionEntry{Name: delegable, ResourceType: model.AccessControlPolicyTypeSystem, Grantable: true, Permissions: delegablePermissions},
		model.ActionEntry{Name: restricted, ResourceType: model.AccessControlPolicyTypeSystem, Grantable: true, Permissions: []string{model.PermissionSysconsoleReadExperimentalFeatureFlags.Id}},
	)
	for _, permission := range delegablePermissions {
		th.AddPermissionToRole(t, permission, model.SystemAdminRoleId)
		t.Cleanup(func() { th.RemovePermissionFromRole(t, permission, model.SystemAdminRoleId) })
	}

	names := func(resp *model.DelegatedActionsResponse) []string {
		out := []string{}
		for _, a := range resp.Results {
			out = append(out, a.Name)
		}
		return out
	}

	t.Run("requires a session", func(t *testing.T) {
		_, resp, err := th.CreateClient().GetDelegatedAdminActions(context.Background())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("with ABAC inactive, role grants decide", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(false)
		})

		resp, _, err := th.Client.GetDelegatedAdminActions(context.Background())
		require.NoError(t, err)
		require.Equal(t, model.Resource{Type: model.AccessControlPolicyTypeSystem}, resp.Resource)
		require.NotNil(t, resp.Results)
		require.Empty(t, resp.Results, "nothing is allowed by default")

		resp, _, err = th.SystemAdminClient.GetDelegatedAdminActions(context.Background())
		require.NoError(t, err)
		require.Subset(t, names(resp), []string{delegable, restricted})
	})

	t.Run("with ABAC active, policies grant and restrict", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		original := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })
		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
			cfg.FeatureFlags.PermissionPolicies = true
		})
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))

		// A policy on the delegable action matches only the basic user; the
		// restricted action has a policy that matches nobody.
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
			return model.AccessDecision{Decision: req.Action == delegable && req.Subject.ID == th.BasicUser.Id}
		}, nil)

		resp, _, err := th.Client.GetDelegatedAdminActions(context.Background())
		require.NoError(t, err)
		require.Equal(t, []model.DelegatedAction{{Name: delegable, Permissions: delegablePermissions}}, resp.Results)

		resp, _, err = th.SystemAdminClient.GetDelegatedAdminActions(context.Background())
		require.NoError(t, err)
		require.Empty(t, resp.Results, "policies restrict a system admin who doesn't match them")
	})

	t.Run("the response carries no decisions map", func(t *testing.T) {
		r, err := th.Client.DoAPIGet(context.Background(), "/access_control/decisions/actions/admin", "")
		require.NoError(t, err)
		defer r.Body.Close()
		var raw map[string]json.RawMessage
		require.NoError(t, json.NewDecoder(r.Body).Decode(&raw))
		require.Contains(t, raw, "results")
		require.NotContains(t, raw, "decisions")
	})
}
