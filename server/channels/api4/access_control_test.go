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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_1,
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

		// Create and set up the mock
		mockAccessControlService := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockAccessControlService

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})

		_, resp, err := th.Client.CreateAccessControlPolicy(context.Background(), samplePolicy)
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
}

func TestGetAccessControlPolicy(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_1,
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
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
}

func TestTestExpression(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_1,
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

		child, appErr := samplePolicy.Inherit(resourceID, model.AccessControlPolicyTypeChannel)
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_1,
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

		child, appErr := samplePolicy.Inherit(resourceID, model.AccessControlPolicyTypeChannel)
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_1,
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
	th := Setup(t)
	t.Cleanup(func() {
		th.TearDown()
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})

	samplePolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_1,
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
