// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

func TestCreateAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       th.BasicChannel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
	}

	t.Run("CreateAccessControlPolicy without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), samplePolicy)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("CreateAccessControlPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create another user who will create the channel
		channelCreator := th.CreateUser(t)
		th.LinkUserToTeam(t, channelCreator, th.BasicTeam)
		channelCreatorClient := th.CreateClient()
		_, _, err := channelCreatorClient.Login(context.Background(), channelCreator.Email, channelCreator.Password)
		require.NoError(t, err)

		// Create a private channel with the other user (not th.BasicUser)
		privateChannel, _, err := channelCreatorClient.CreateChannel(context.Background(), &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "private-channel-" + model.NewId(),
			DisplayName: "Private Channel",
			Type:        model.ChannelTypePrivate,
		})
		require.NoError(t, err)

		// Create channel-specific policy (regular user should not have permission)
		channelPolicy := &model.AccessControlPolicy{
			ID:       privateChannel.Id, // Set to actual channel ID
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.CreateAccessControlPolicy(context.Background(), channelPolicy)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CreateAccessControlPolicy with channel admin for their channel", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Add the permission to channel admin role
		th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

		// Create a private channel and make user channel admin
		privateChannel := th.CreatePrivateChannel(t)
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, privateChannel)
		th.MakeUserChannelAdmin(t, channelAdmin, privateChannel)
		channelAdminClient := th.CreateClient()
		th.LoginBasicWithClient(t, channelAdminClient)
		_, _, err := channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		// Create channel-specific policy
		channelPolicy := &model.AccessControlPolicy{
			ID:       privateChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(channelPolicy, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := channelAdminClient.CreateAccessControlPolicy(context.Background(), channelPolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("CreateAccessControlPolicy with channel admin for another channel should fail", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create two private channels
		privateChannel1 := th.CreatePrivateChannel(t)
		privateChannel2 := th.CreatePrivateChannel(t)
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, privateChannel1)
		th.MakeUserChannelAdmin(t, channelAdmin, privateChannel1)
		channelAdminClient := th.CreateClient()
		th.LoginBasicWithClient(t, channelAdminClient)
		_, _, err := channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		// Try to create policy for different channel
		channelPolicy := &model.AccessControlPolicy{
			ID:       privateChannel2.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := channelAdminClient.CreateAccessControlPolicy(context.Background(), channelPolicy)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CreateAccessControlPolicy with channel admin creating parent policy should fail", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create a private channel and make user channel admin
		privateChannel := th.CreatePrivateChannel(t)
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, privateChannel)
		th.MakeUserChannelAdmin(t, channelAdmin, privateChannel)
		channelAdminClient := th.CreateClient()
		th.LoginBasicWithClient(t, channelAdminClient)
		_, _, err := channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		// Try to create parent-type policy
		parentPolicy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypeParent,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := channelAdminClient.CreateAccessControlPolicy(context.Background(), parentPolicy)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Set up a test license with Data Retention enabled
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		// Set up mock expectations
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(samplePolicy, nil).Times(1)

		// Set the mock on the app
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := client.CreateAccessControlPolicy(context.Background(), samplePolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "CreateAccessControlPolicy with system admin")

	t.Run("CreateAccessControlPolicy with channel scope permissions", func(t *testing.T) {
		// Set up a test license with Data Retention enabled
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		ch := th.CreatePrivateChannel(t)

		// Set up mock expectations
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(samplePolicy, nil).Times(1)

		// Set the mock on the app
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

		channelPolicy := &model.AccessControlPolicy{
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
			ID: ch.Id,
		}

		_, resp, err := th.Client.CreateAccessControlPolicy(context.Background(), channelPolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("CreatePermissionPolicy with feature flag disabled", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = false
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		permissionPolicy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypePermission,
			Name:     "test-permission-policy",
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.department == 'engineering'",
					Actions:    []string{model.AccessControlPolicyActionUploadFileAttachment},
				},
			},
		}

		_, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), permissionPolicy)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("CreatePermissionPolicy with feature flag enabled", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		permissionPolicy := &model.AccessControlPolicy{
			ID:       model.NewId(),
			Type:     model.AccessControlPolicyTypePermission,
			Name:     "test-permission-policy",
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.department == 'engineering'",
					Actions:    []string{model.AccessControlPolicyActionUploadFileAttachment},
				},
			},
		}

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(permissionPolicy, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.SystemAdminClient.CreateAccessControlPolicy(context.Background(), permissionPolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
	}

	t.Run("GetAccessControlPolicy without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetAccessControlPolicy(context.Background(), samplePolicy.ID)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("GetAccessControlPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.GetAccessControlPolicy(context.Background(), samplePolicy.ID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := client.GetAccessControlPolicy(context.Background(), samplePolicy.ID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "GetAccessControlPolicy with system admin")
}

func TestDeleteAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicyID := model.NewId()

	t.Run("DeleteAccessControlPolicy without license", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeleteAccessControlPolicy(context.Background(), samplePolicyID)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("DeleteAccessControlPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		// Mock the GetPolicy call that happens in ValidateAccessControlPolicyPermission
		channelPolicy := &model.AccessControlPolicy{
			ID:       samplePolicyID,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicyID).Return(channelPolicy, nil)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := th.Client.DeleteAccessControlPolicy(context.Background(), samplePolicyID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		// DeleteAccessControlPolicy resolves the policy first to decide whether
		// to broadcast a channel access-control update after deletion.
		channelPolicy := &model.AccessControlPolicy{
			ID:       samplePolicyID,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicyID).Return(channelPolicy, nil).Times(1)
		mockAccessControlService.On("DeletePolicy", mock.AnythingOfType("*request.Context"), samplePolicyID).Return(nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := client.DeleteAccessControlPolicy(context.Background(), samplePolicyID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestCheckExpression(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	t.Run("CheckExpression without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.CheckExpression(context.Background(), "true")
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("CheckExpression with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.CheckExpression(context.Background(), "true")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("CheckExpression", mock.AnythingOfType("*request.Context"), "true").Return([]model.CELExpressionError{}, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		errors, resp, err := client.CheckExpression(context.Background(), "true")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, errors, "expected no errors")
	}, "CheckExpression with system admin")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("CheckExpression", mock.AnythingOfType("*request.Context"), "true").Return([]model.CELExpressionError{
			{
				Line:    1,
				Column:  1,
				Message: "Syntax error",
			},
		}, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		errors, resp, err := client.CheckExpression(context.Background(), "true")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, errors, "expected errors")
	}, "CheckExpression with system admin errors returned")

	t.Run("CheckExpression with channel admin for their channel", func(t *testing.T) {
		// Reload config to pick up the feature flag
		err := th.App.ReloadConfig()
		require.NoError(t, err)

		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Add permission to channel admin role
		th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

		// Create private channel and make user channel admin
		privateChannel := th.CreatePrivateChannel(t)
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, privateChannel)
		th.MakeUserChannelAdmin(t, channelAdmin, privateChannel)
		channelAdminClient := th.CreateClient()
		_, _, err = channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("CheckExpression", mock.AnythingOfType("*request.Context"), "true").Return([]model.CELExpressionError{}, nil).Times(1)

		// Channel admin should be able to check expressions for their channel
		errors, resp, err := channelAdminClient.CheckExpression(context.Background(), "true", privateChannel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, errors, "expected no errors")
	})
}

func TestTestExpression(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	t.Run("TestExpression without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.TestExpression(context.Background(), model.QueryExpressionParams{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("TestExpression with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.TestExpression(context.Background(), model.QueryExpressionParams{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", model.SubjectSearchOptions{}).Return([]*model.User{}, int64(0), nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		usersResp, resp, err := client.TestExpression(context.Background(), model.QueryExpressionParams{
			Expression: "true",
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, usersResp.Users, "expected no users")
		require.Equal(t, int64(0), usersResp.Total, "expected count 0 users")
	}, "TestExpression with system admin")
}

func TestSearchAccessControlPolicies(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	t.Run("SearchAccessControlPolicies without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("SearchAccessControlPolicies with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("SearchPolicies", mock.AnythingOfType("*request.Context"), model.AccessControlPolicySearch{
			Term: "engineering",
		}).Return([]*model.AccessControlPolicy{}, int64(0), nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		policiesResp, resp, err := client.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Term: "engineering",
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, policiesResp.Policies, "expected no policies")
		require.Equal(t, int64(0), policiesResp.Total, "expected count 0 policies")
	}, "SearchAccessControlPolicies with system admin")

	t.Run("SearchPermissionPolicies with feature flag disabled", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = false
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Term: "test",
			Type: model.AccessControlPolicyTypePermission,
		})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("SearchPermissionPolicies with feature flag enabled", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("SearchPolicies", mock.AnythingOfType("*request.Context"), model.AccessControlPolicySearch{
			Term: "test",
			Type: model.AccessControlPolicyTypePermission,
		}).Return([]*model.AccessControlPolicy{}, int64(0), nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		policiesResp, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), model.AccessControlPolicySearch{
			Term: "test",
			Type: model.AccessControlPolicyTypePermission,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, policiesResp.Policies, "expected no policies")
	})
}

func TestSearchTeamAccessControlPolicies(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	teamSearch := model.AccessControlPolicySearch{TeamID: th.BasicTeam.Id}

	setupLicenseAndABAC := func(t *testing.T) {
		t.Helper()
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		th.AddPermissionToRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)
	}

	t.Run("without license returns not implemented", func(t *testing.T) {
		originalACS := th.App.Srv().Channels().AccessControl
		th.App.Srv().Channels().AccessControl = nil
		defer func() { th.App.Srv().Channels().AccessControl = originalACS }()

		_, resp, err := th.SystemAdminClient.SearchAccessControlPolicies(context.Background(), teamSearch)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("regular user without manage_team_access_rules permission gets forbidden", func(t *testing.T) {
		setupLicenseAndABAC(t)

		_, resp, err := th.Client.SearchAccessControlPolicies(context.Background(), teamSearch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("team admin with manage_team_access_rules can search", func(t *testing.T) {
		setupLicenseAndABAC(t)

		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		policiesResp, resp, err := th.Client.SearchAccessControlPolicies(context.Background(), teamSearch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policiesResp)
		require.Empty(t, policiesResp.Policies)
		require.Equal(t, int64(0), policiesResp.Total)
	})

	t.Run("team admin without manage_team_access_rules gets forbidden", func(t *testing.T) {
		setupLicenseAndABAC(t)

		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)

		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		_, resp, err := th.Client.SearchAccessControlPolicies(context.Background(), teamSearch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		setupLicenseAndABAC(t)

		policiesResp, resp, err := client.SearchAccessControlPolicies(context.Background(), teamSearch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policiesResp)
		require.Empty(t, policiesResp.Policies)
		require.Equal(t, int64(0), policiesResp.Total)
	}, "system admin and local can search team policies")
}

func TestAssignAccessPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{model.AccessControlPolicyActionMembership},
			},
		},
	}

	t.Run("AssignAccessPolicy without license", func(t *testing.T) {
		resp, err := th.SystemAdminClient.AssignAccessControlPolicies(context.Background(), model.NewId(), []string{model.NewId()})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("AssignAccessPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := th.Client.AssignAccessControlPolicies(context.Background(), model.NewId(), []string{model.NewId()})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Use a real private channel: GetChannels hits the DB and returns ErrNotFound
		// for a random UUID with no matching row, causing the handler to return 404.
		privateCh := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, th.BasicTeam.Id)

		// child must be a pointer — SavePolicy mock returns it via interface{} and the
		// generated mock does ret.Get(0).(*model.AccessControlPolicy), which panics on a value type.
		child := &model.AccessControlPolicy{
			ID:      privateCh.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_3,
			Imports: []string{samplePolicy.ID},
			Props:   map[string]any{},
		}

		// AssignAccessControlPolicyToChannels calls GetPolicy twice:
		//   1. GetAccessControlPolicy(parentID) — fetches the parent to inherit from
		//   2. Per channel: GetPolicy(channelId) — checks for an existing child policy
		notFound := model.NewAppError("GetPolicy", "app.access_control.not_found.app_error", nil, "", 404)

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Once()
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), privateCh.Id).Return(nil, notFound).Once()
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(child, nil).Once()

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := client.AssignAccessControlPolicies(context.Background(), samplePolicy.ID, []string{privateCh.Id})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "AssignAccessPolicy with system admin")
}

func TestUnassignAccessPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
	}

	t.Run("UnassignAccessPolicy without license", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UnassignAccessControlPolicies(context.Background(), samplePolicy.ID, []string{model.NewId()})
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("UnassignAccessPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := th.Client.UnassignAccessControlPolicies(context.Background(), samplePolicy.ID, []string{model.NewId()})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resourceID := model.NewId()

		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		child := &model.AccessControlPolicy{
			ID:       resourceID,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
		}

		appErr := child.Inherit(samplePolicy)
		require.Nil(t, appErr)

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Times(1)
		mockAccessControlService.On("SearchPolicies", mock.AnythingOfType("*request.Context"), model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: samplePolicy.ID,
		}).Return([]*model.AccessControlPolicy{child}, nil).Times(1)
		mockAccessControlService.On("DeletePolicy", mock.AnythingOfType("*request.Context"), child.ID).Return(nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := client.UnassignAccessControlPolicies(context.Background(), samplePolicy.ID, []string{child.ID})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "UnassignAccessPolicy with system admin")
}

func TestGetChannelsForAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
	}

	t.Run("GetChannelsForAccessControlPolicy without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetChannelsForAccessControlPolicy(context.Background(), samplePolicy.ID, "", 1000)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("GetChannelsForAccessControlPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.GetChannelsForAccessControlPolicy(context.Background(), samplePolicy.ID, "", 1000)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		channelsResp, resp, err := client.GetChannelsForAccessControlPolicy(context.Background(), samplePolicy.ID, "", 1000)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, channelsResp.Channels, "expected no channels")
		require.Equal(t, int64(0), channelsResp.TotalCount, "expected count 0 channels")
	}, "GetChannelsForAccessControlPolicy with system admin")
}

func TestSearchChannelsForAccessControlPolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) { cfg.FeatureFlags.AttributeBasedAccessControl = true }).InitBasic(t)

	newSamplePolicy := func() *model.AccessControlPolicy {
		return &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "test-policy-" + model.NewId(),
			Type:    model.AccessControlPolicyTypeParent,
			Version: model.AccessControlPolicyVersionV0_3,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
			Scope:   model.AccessControlPolicyScopeTeam,
			ScopeID: th.BasicTeam.Id,
		}
	}

	setupLicenseAndABAC := func(t *testing.T) {
		t.Helper()
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		th.AddPermissionToRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)
	}

	t.Run("regular user gets forbidden", func(t *testing.T) {
		setupLicenseAndABAC(t)

		_, resp, err := th.Client.SearchChannelsForAccessControlPolicy(context.Background(), model.NewId(), model.ChannelSearch{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("team admin without team_id query param gets forbidden", func(t *testing.T) {
		setupLicenseAndABAC(t)

		th.LinkUserToTeam(t, th.TeamAdminUser, th.BasicTeam)
		th.UpdateUserToTeamAdmin(t, th.TeamAdminUser, th.BasicTeam)

		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		// No team_id in query param → should be forbidden
		_, resp, err := th.Client.SearchChannelsForAccessControlPolicy(context.Background(), model.NewId(), model.ChannelSearch{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("team admin with valid team_id can search", func(t *testing.T) {
		setupLicenseAndABAC(t)

		policy := newSamplePolicy()
		savedPolicy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		defer func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, savedPolicy.ID)
		}()

		th.LinkUserToTeam(t, th.TeamAdminUser, th.BasicTeam)
		th.UpdateUserToTeamAdmin(t, th.TeamAdminUser, th.BasicTeam)

		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		channelsResp, resp, err := th.Client.SearchChannelsForAccessControlPolicyForTeam(
			context.Background(), savedPolicy.ID, th.BasicTeam.Id, model.ChannelSearch{})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, channelsResp)
	})

	t.Run("team admin body TeamIds forced to authorized team", func(t *testing.T) {
		setupLicenseAndABAC(t)

		policy := newSamplePolicy()
		savedPolicy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		defer func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, savedPolicy.ID)
		}()

		// Create a second team with a private channel
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)
		_ = otherChannel

		th.LinkUserToTeam(t, th.TeamAdminUser, th.BasicTeam)
		th.UpdateUserToTeamAdmin(t, th.TeamAdminUser, th.BasicTeam)

		th.LoginTeamAdmin(t)
		defer th.LoginBasic(t)

		// Attempt to search with body TeamIds pointing to a different team.
		// The authZ is against BasicTeam (via team_id query param), but the
		// body tries to query otherTeam's channels. The fix should force
		// TeamIds to BasicTeam.Id regardless of what the body says.
		channelsResp, resp, err := th.Client.SearchChannelsForAccessControlPolicyForTeam(
			context.Background(), savedPolicy.ID, th.BasicTeam.Id,
			model.ChannelSearch{TeamIds: []string{otherTeam.Id}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, channelsResp)

		// None of the returned channels should belong to the other team
		for _, ch := range channelsResp.Channels {
			require.Equal(t, th.BasicTeam.Id, ch.TeamId,
				"team admin should only see channels from the authorized team, got channel %s from team %s", ch.Id, ch.TeamId)
		}
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		setupLicenseAndABAC(t)

		policy := newSamplePolicy()
		savedPolicy, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, err)
		defer func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, savedPolicy.ID)
		}()

		// System admin can search with arbitrary TeamIds (no restriction)
		otherTeam := th.CreateTeam(t)

		channelsResp, resp, err := client.SearchChannelsForAccessControlPolicy(
			context.Background(), savedPolicy.ID,
			model.ChannelSearch{TeamIds: []string{otherTeam.Id}})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, channelsResp)
	}, "system admin can search with arbitrary TeamIds")
}

func TestSetActiveStatus(t *testing.T) {
	th := Setup(t).InitBasic(t)

	samplePolicy := &model.AccessControlPolicy{
		ID:       th.BasicChannel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
	}
	var err error
	samplePolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, samplePolicy)
	require.NoError(t, err)

	// Sample update request
	updateReq := model.AccessControlPolicyActiveUpdateRequest{
		Entries: []model.AccessControlPolicyActiveUpdate{
			{ID: samplePolicy.ID, Active: true},
		},
	}

	t.Run("SetActiveStatus without license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.SetAccessControlPolicyActive(context.Background(), updateReq)
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	t.Run("SetActiveStatus with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Remove permission from regular user
		_, resp, err := th.Client.SetAccessControlPolicyActive(context.Background(), updateReq)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		policies, resp, err := client.SetAccessControlPolicyActive(context.Background(), updateReq)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "expected policies in response")
		require.Len(t, policies, 1, "expected one policy in response")
		require.Equal(t, samplePolicy.ID, policies[0].ID, "expected policy ID to match")
		require.True(t, policies[0].Active, "expected policy to be active")
	}, "SetActiveStatus with system admin")

	t.Run("SetActiveStatus with channel admin for their channel", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Add permission to channel admin role
		th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)
		// Create private channel and make user channel admin
		privateChannel := th.CreatePrivateChannel(t)
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, privateChannel)
		th.MakeUserChannelAdmin(t, channelAdmin, privateChannel)

		channelPolicy := &model.AccessControlPolicy{
			ID:       privateChannel.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}
		var err error
		channelPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, channelPolicy)
		require.NoError(t, err)

		channelAdminClient := th.CreateClient()
		_, _, err = channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		// Update request for the channel admin's channel
		channelUpdateReq := model.AccessControlPolicyActiveUpdateRequest{
			Entries: []model.AccessControlPolicyActiveUpdate{
				{ID: privateChannel.Id, Active: true},
			},
		}

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), privateChannel.Id).Return(channelPolicy, nil)
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		// Channel admin should be able to set active status for their channel
		policies, resp, err := channelAdminClient.SetAccessControlPolicyActive(context.Background(), channelUpdateReq)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "expected policies in response")
		require.Len(t, policies, 1, "expected one policy in response")
		require.Equal(t, channelPolicy.ID, policies[0].ID, "expected policy ID to match")
		require.True(t, policies[0].Active, "expected policy to be active")
	})

	t.Run("SetActiveStatus with channel admin for another channel should fail", func(t *testing.T) {
		// This test verifies the security fix: a channel admin cannot modify the active status
		// of a policy for a channel they don't have permissions on, even if they attempt to
		// use a policy ID that matches a channel they control.
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		// Add permission to channel admin role
		th.AddPermissionToRole(t, model.PermissionManageChannelAccessRules.Id, model.ChannelAdminRoleId)

		// Create two private channels
		channelA := th.CreatePrivateChannel(t)
		channelB := th.CreatePrivateChannel(t)

		// Create a channel admin who only has access to channel A
		channelAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, channelAdmin, th.BasicTeam)
		th.AddUserToChannel(t, channelAdmin, channelA)
		th.MakeUserChannelAdmin(t, channelAdmin, channelA)

		// Create a policy for channel B (which the channel admin does NOT have access to)
		channelBPolicy := &model.AccessControlPolicy{
			ID:       channelB.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_3,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"membership"},
				},
			},
		}
		_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, channelBPolicy)
		require.NoError(t, err)

		channelAdminClient := th.CreateClient()
		_, _, err = channelAdminClient.Login(context.Background(), channelAdmin.Email, channelAdmin.Password)
		require.NoError(t, err)

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), channelB.Id).Return(channelBPolicy, nil)

		// Attempt to update the policy for channel B (which the admin doesn't have access to)
		maliciousUpdateReq := model.AccessControlPolicyActiveUpdateRequest{
			Entries: []model.AccessControlPolicyActiveUpdate{
				{ID: channelB.Id, Active: true},
			},
		}

		// Channel admin should NOT be able to set active status for another channel's policy
		_, resp, err := channelAdminClient.SetAccessControlPolicyActive(context.Background(), maliciousUpdateReq)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func setupTeamAdminABAC(t *testing.T, th *TestHelper) *mocks.AccessControlServiceInterface {
	t.Helper()
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok, "SetLicense should return true")

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = mockACS

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
	})

	th.AddPermissionToRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)
	return mockACS
}

// makeTeamAdmin links the given user to the given team and promotes them to
// team admin. It also logs th.Client in as that user.
func makeTeamAdminAndLogin(t *testing.T, th *TestHelper, user *model.User, team *model.Team) {
	t.Helper()
	th.LinkUserToTeam(t, user, team)
	th.UpdateUserToTeamAdmin(t, user, team)
	_, _, err := th.Client.Login(context.Background(), user.Email, user.Password)
	require.NoError(t, err)
}

// newParentPolicy returns a parent-type policy ready for storage or mock use.
func newParentPolicy(teamID string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		ID:   model.NewId(),
		Name: "test-policy-" + model.NewId(),
		Type: model.AccessControlPolicyTypeParent,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.department == 'engineering'",
				Actions:    []string{"membership"},
			},
		},
		Version: model.AccessControlPolicyVersionV0_3,
		Scope:   model.AccessControlPolicyScopeTeam,
		ScopeID: teamID,
	}
}

func TestCreateAccessControlPolicyTeamAdmin(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	t.Run("team admin with permission can create parent policy scoped to their team", func(t *testing.T) {
		mockACS := setupTeamAdminABAC(t, th)

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		policy := newParentPolicy(th.BasicTeam.Id)
		// Strip ID, scope so the handler treats this as a CREATE and sets them itself.
		// A non-empty ID triggers the update-ownership check, which fails if the
		// policy doesn't already exist in the store.
		policy.ID = ""
		policy.Scope = ""
		policy.ScopeID = ""

		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Scope == model.AccessControlPolicyScopeTeam && p.ScopeID == th.BasicTeam.Id
		})).
			Return(policy, nil).Once()

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+th.BasicTeam.Id,
			policy,
		)
		require.NoError(t, err)
		defer r.Body.Close()
		require.Equal(t, 200, r.StatusCode)

		mockACS.AssertExpectations(t)
	})

	t.Run("team admin create ignores attacker-supplied scope_id and stamps from query team_id", func(t *testing.T) {
		// on create (ID empty), a team admin could craft a body
		// with scope_id for a different team. The handler must ignore it and stamp
		// scope from authenticated ?team_id.
		mockACS := setupTeamAdminABAC(t, th)

		otherTeam := th.CreateTeam(t)
		policy := newParentPolicy(th.BasicTeam.Id)
		policy.ID = ""
		policy.Scope = model.AccessControlPolicyScopeTeam
		policy.ScopeID = otherTeam.Id

		expectedSaved := newParentPolicy(th.BasicTeam.Id)
		expectedSaved.ID = model.NewId()

		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Scope == model.AccessControlPolicyScopeTeam && p.ScopeID == th.BasicTeam.Id
		})).Return(expectedSaved, nil).Once()

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+th.BasicTeam.Id,
			policy,
		)
		require.NoError(t, err)
		defer r.Body.Close()
		require.Equal(t, 200, r.StatusCode)
		mockACS.AssertExpectations(t)
	})

	t.Run("team admin without manage_team_access_rules permission gets 403", func(t *testing.T) {
		setupTeamAdminABAC(t, th)

		defaultPerms := th.SaveDefaultRolePermissions(t)
		defer th.RestoreDefaultRolePermissions(t, defaultPerms)
		th.RemovePermissionFromRole(t, model.PermissionManageTeamAccessRules.Id, model.TeamAdminRoleId)

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		policy := newParentPolicy(th.BasicTeam.Id)
		policy.Scope = ""
		policy.ScopeID = ""

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+th.BasicTeam.Id,
			policy,
		)
		require.Error(t, err)
		defer r.Body.Close()
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("team admin using a wrong team_id gets 403", func(t *testing.T) {
		setupTeamAdminABAC(t, th)

		// Create a second team that the team admin does NOT belong to.
		otherTeam := th.CreateTeam(t)

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		policy := newParentPolicy(otherTeam.Id)

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+otherTeam.Id,
			policy,
		)
		require.Error(t, err)
		defer r.Body.Close()
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("team admin omitting team_id gets 403 (falls through to system permission check)", func(t *testing.T) {
		setupTeamAdminABAC(t, th)

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		policy := newParentPolicy(th.BasicTeam.Id)

		// No team_id in query string — handler requires system permission.
		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies",
			policy,
		)
		require.Error(t, err)
		defer r.Body.Close()
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("regular user is denied even with team_id", func(t *testing.T) {
		setupTeamAdminABAC(t, th)

		th.LoginBasic(t)

		policy := newParentPolicy(th.BasicTeam.Id)

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+th.BasicTeam.Id,
			policy,
		)
		require.Error(t, err)
		defer r.Body.Close()
		require.Equal(t, 403, r.StatusCode)
	})

	t.Run("team admin cannot overwrite scope_id with another team's ID via body", func(t *testing.T) {
		// a team admin authenticates against ?team_id=BasicTeam
		// but crafts a body with scope_id pointing to a different team.
		// The handler must ignore the body's scope fields and stamp scope from the
		// authenticated query param, not from the untrusted request body.
		mockACS := setupTeamAdminABAC(t, th)

		otherTeam := th.CreateTeam(t)

		// Save a real policy scoped to BasicTeam so ValidateTeamAdminPolicyOwnership
		// (which queries the real store) confirms the team admin owns it.
		policy := newParentPolicy(th.BasicTeam.Id)
		savedPolicy, storeErr := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
		require.NoError(t, storeErr)
		defer func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, savedPolicy.ID)
		}()

		// Craft the request body: same policy ID but scope_id pointing to the other team.
		craftedPolicy := *savedPolicy
		craftedPolicy.Scope = model.AccessControlPolicyScopeTeam
		craftedPolicy.ScopeID = otherTeam.Id

		// Handler must force scope_id back to BasicTeam, not save the attacker-supplied value.
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Scope == model.AccessControlPolicyScopeTeam && p.ScopeID == th.BasicTeam.Id
		})).Return(savedPolicy, nil).Once()

		makeTeamAdminAndLogin(t, th, th.TeamAdminUser, th.BasicTeam)
		defer th.LoginBasic(t)

		r, err := th.Client.DoAPIPutJSON(
			context.Background(),
			"/access_control_policies?team_id="+th.BasicTeam.Id,
			&craftedPolicy,
		)
		require.NoError(t, err)
		defer r.Body.Close()
		require.Equal(t, 200, r.StatusCode)
		mockACS.AssertExpectations(t)
	})
}
