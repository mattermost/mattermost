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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       th.BasicChannel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
				},
			},
			ID: ch.Id,
		}

		_, resp, err := th.Client.CreateAccessControlPolicy(context.Background(), channelPolicy)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetAccessControlPolicy(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

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
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
			Rules: []model.AccessControlPolicyRule{
				{
					Expression: "user.attributes.team == 'engineering'",
					Actions:    []string{"*"},
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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

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
}

func TestAssignAccessPolicy(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
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
		resourceID := model.NewId()

		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		child := model.AccessControlPolicy{
			ID:       resourceID,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
		}

		appErr := child.Inherit(samplePolicy)
		require.Nil(t, appErr)

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService
		mockAccessControlService.On("GetPolicy", mock.AnythingOfType("*request.Context"), samplePolicy.ID).Return(samplePolicy, nil).Times(1)
		mockAccessControlService.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(child, nil).Times(1)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		resp, err := client.AssignAccessControlPolicies(context.Background(), samplePolicy.ID, []string{resourceID})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	}, "AssignAccessPolicy with system admin")
}

func TestUnassignAccessPolicy(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
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
			Version:  model.AccessControlPolicyVersionV0_2,
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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
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
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t).InitBasic(t)
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{"*"},
			},
		},
	}

	t.Run("SearchChannelsForAccessControlPolicy with regular user", func(t *testing.T) {
		ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		require.True(t, ok, "SetLicense should return true")

		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.SearchChannelsForAccessControlPolicy(context.Background(), samplePolicy.ID, model.ChannelSearch{})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
