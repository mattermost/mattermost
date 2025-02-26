// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestDataRetentionGetPolicy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	_, resp, err := th.Client.GetDataRetentionPolicy(context.Background())
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}

func TestGetPolicies(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return a sample policy list
	var postDurationDays int64 = 30
	samplePolicies := []*model.RetentionPolicyWithTeamAndChannelCounts{
		{
			RetentionPolicy: model.RetentionPolicy{
				ID:               "sample_policy_id",
				DisplayName:      "Sample Policy",
				PostDurationDays: &postDurationDays,
			},
			ChannelCount: 1,
			TeamCount:    1,
		},
	}
	samplePolicyList := &model.RetentionPolicyWithTeamAndChannelCountsList{
		Policies:   samplePolicies,
		TotalCount: int64(len(samplePolicies)),
	}

	// Set up mock expectations
	mockDataRetentionInterface.On("GetPolicies", mock.AnythingOfType("int"), mock.AnythingOfType("int")).Return(samplePolicyList, nil)

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("as system admin", func(t *testing.T) {
		policies, resp, err := th.SystemAdminClient.GetDataRetentionPolicies(context.Background(), 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.NotEmpty(t, policies.Policies, "Policies should not be empty")
		require.Len(t, policies.Policies, 1, "Should return 1 policy")
		assert.Equal(t, "sample_policy_id", policies.Policies[0].ID, "Policy ID should match")
		assert.Equal(t, int64(1), policies.Policies[0].ChannelCount, "ChannelCount should be 1")
		assert.Equal(t, int64(1), policies.Policies[0].TeamCount, "TeamCount should be 1")
	})

	t.Run("with different page and per_page", func(t *testing.T) {
		page := 1
		perPage := 50
		policies, resp, err := th.SystemAdminClient.GetDataRetentionPolicies(context.Background(), page, perPage)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.NotEmpty(t, policies.Policies, "Policies should not be empty")
		require.Len(t, policies.Policies, 1, "Should return 1 policy")
	})

	t.Run("as regular user", func(t *testing.T) {
		// Ensure the basic user doesn't have the necessary permission
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemUserRoleId)

		policies, resp, err := th.Client.GetDataRetentionPolicies(context.Background(), 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil on forbidden access")
	})

	t.Run("without login", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, "Logout should be successful")

		policies, resp, err := th.Client.GetDataRetentionPolicies(context.Background(), 0, 100)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil on unauthorized access")
	})
}

func TestGetDataRetentionPoliciesCount(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return a count of 3 policies
	mockDataRetentionInterface.On("GetPoliciesCount").Return(int64(3), (*model.AppError)(nil))

	// Set the mock on the app
	th.App.Channels().DataRetention = mockDataRetentionInterface
	t.Run("get policies count without permissions", func(t *testing.T) {
		count, resp, err := th.Client.GetDataRetentionPoliciesCount(context.Background())
		require.Equal(t, int64(0), count, "Expected count to be 0")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get policies count with permissions", func(t *testing.T) {
		// Add necessary permissions
		th.AddPermissionToRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemUserRoleId)

		count, resp, err := th.Client.GetDataRetentionPoliciesCount(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, int64(3), count, "Expected count to be 3")
	})

	t.Run("get policies count as system admin", func(t *testing.T) {
		count, resp, err := th.SystemAdminClient.GetDataRetentionPoliciesCount(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, int64(3), count, "Expected count to be 3")
	})
}

func TestGetPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()

	// Set up the mock to return a sample policy
	var postDurationDays int64 = 30
	samplePolicy := &model.RetentionPolicyWithTeamAndChannelCounts{
		RetentionPolicy: model.RetentionPolicy{
			ID:               validPolicyId,
			DisplayName:      "Sample Policy",
			PostDurationDays: &postDurationDays,
		},
		ChannelCount: 5,
		TeamCount:    2,
	}
	mockDataRetentionInterface.On("GetPolicy", validPolicyId).Return(samplePolicy, nil)
	mockDataRetentionInterface.On("GetPolicy", nonExistentPolicyId).Return(nil, model.NewAppError("GetPolicy", "app.data_retention.get_policy.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		policy, resp, err := th.SystemAdminClient.GetDataRetentionPolicyByID(context.Background(), validPolicyId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policy, "Policy should not be nil")
		assert.Equal(t, validPolicyId, policy.ID, "Policy ID should match")
		assert.Equal(t, "Sample Policy", policy.DisplayName, "Policy DisplayName should match")
		assert.Equal(t, int64(30), *policy.PostDurationDays, "PostDurationDays should match")
		assert.Equal(t, int64(5), policy.ChannelCount, "ChannelCount should match")
		assert.Equal(t, int64(2), policy.TeamCount, "TeamCount should match")
	})

	t.Run("NonExistent", func(t *testing.T) {
		policy, resp, err := th.SystemAdminClient.GetDataRetentionPolicyByID(context.Background(), nonExistentPolicyId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil for non-existent ID")
	})

	t.Run("Forbidden", func(t *testing.T) {
		// Ensure the basic user doesn't have the necessary permission
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemUserRoleId)

		policy, resp, err := th.Client.GetDataRetentionPolicyByID(context.Background(), validPolicyId)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil on forbidden access")
	})

	t.Run("Unauthorized", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, "Logout should be successful")

		policy, resp, err := th.Client.GetDataRetentionPolicyByID(context.Background(), validPolicyId)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil on unauthorized access")
	})

	t.Run("InvalidID", func(t *testing.T) {
		policy, resp, err := th.SystemAdminClient.GetDataRetentionPolicyByID(context.Background(), "invalid_id!")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil for invalid ID format")
	})
}

func TestCreatePolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()

	// Set up the mock to return a sample policy
	var postDurationDays int64 = 30
	samplePolicy := &model.RetentionPolicyWithTeamAndChannelCounts{
		RetentionPolicy: model.RetentionPolicy{
			ID:               validPolicyId,
			DisplayName:      "Sample Policy",
			PostDurationDays: &postDurationDays,
		},
		ChannelCount: 1,
		TeamCount:    1,
	}

	// Set up the mock expectation
	mockDataRetentionInterface.On("CreatePolicy", mock.AnythingOfType("*model.RetentionPolicyWithTeamAndChannelIDs")).Return(samplePolicy, (*model.AppError)(nil))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		var postDurationDays int64 = 30
		policyToCreate := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "Test Policy",
				PostDurationDays: &postDurationDays,
			},
			TeamIDs:    []string{},
			ChannelIDs: []string{},
		}

		policy, resp, err := th.SystemAdminClient.CreateDataRetentionPolicy(context.Background(), policyToCreate)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, policy, "Policy should not be nil")
		assert.Equal(t, validPolicyId, policy.ID, "Policy ID should match")
		assert.Equal(t, "Sample Policy", policy.DisplayName, "Policy DisplayName should match")
		assert.Equal(t, int64(30), *policy.PostDurationDays, "PostDurationDays should match")
		assert.Equal(t, int64(1), policy.ChannelCount, "ChannelCount should be 1")
		assert.Equal(t, int64(1), policy.TeamCount, "TeamCount should be 1")
	})

	t.Run("Forbidden", func(t *testing.T) {
		// Ensure the basic user doesn't have the necessary permission
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemUserRoleId)

		var postDurationDays int64 = 30
		policyToCreate := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "Test Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.Client.CreateDataRetentionPolicy(context.Background(), policyToCreate)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil on forbidden access")
	})

	t.Run("Unauthorized", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, "Logout should be successful")

		var postDurationDays int64 = 30
		policyToCreate := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				DisplayName:      "Test Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.Client.CreateDataRetentionPolicy(context.Background(), policyToCreate)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil on unauthorized access")
	})
}

func TestPatchPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()

	// Set up the mock to return a sample patched policy
	var postDurationDays int64 = 60
	samplePatchedPolicy := &model.RetentionPolicyWithTeamAndChannelCounts{
		RetentionPolicy: model.RetentionPolicy{
			ID:               validPolicyId,
			DisplayName:      "Updated Policy",
			PostDurationDays: &postDurationDays,
		},
		ChannelCount: 2,
		TeamCount:    1,
	}
	mockDataRetentionInterface.On("PatchPolicy", mock.AnythingOfType("*model.RetentionPolicyWithTeamAndChannelIDs")).Return(samplePatchedPolicy, nil)

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		var postDurationDays int64 = 60
		patchPayload := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:               validPolicyId,
				DisplayName:      "Updated Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.SystemAdminClient.PatchDataRetentionPolicy(context.Background(), patchPayload)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policy, "Policy should not be nil")
		assert.Equal(t, validPolicyId, policy.ID, "Policy ID should match")
		assert.Equal(t, "Updated Policy", policy.DisplayName, "Policy DisplayName should match")
		assert.Equal(t, int64(60), *policy.PostDurationDays, "PostDurationDays should match")
		assert.Equal(t, int64(2), policy.ChannelCount, "ChannelCount should match")
		assert.Equal(t, int64(1), policy.TeamCount, "TeamCount should match")

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("InvalidPolicyID", func(t *testing.T) {
		var postDurationDays int64 = 60
		patchPayload := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:               "invalid_id!", // Invalid ID
				DisplayName:      "Updated Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.Client.PatchDataRetentionPolicy(context.Background(), patchPayload)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil for invalid policy ID")
	})

	t.Run("NoPermission", func(t *testing.T) {
		var postDurationDays int64 = 60
		patchPayload := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:               validPolicyId,
				DisplayName:      "Updated Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.Client.PatchDataRetentionPolicy(context.Background(), patchPayload)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil when user has no permission")
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, "Logout should be successful")

		var postDurationDays int64 = 60
		patchPayload := &model.RetentionPolicyWithTeamAndChannelIDs{
			RetentionPolicy: model.RetentionPolicy{
				ID:               validPolicyId,
				DisplayName:      "Updated Policy",
				PostDurationDays: &postDurationDays,
			},
		}

		policy, resp, err := th.Client.PatchDataRetentionPolicy(context.Background(), patchPayload)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policy, "Policy should be nil when user is not logged in")
	})
}

func TestDeletePolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()

	mockDataRetentionInterface.On("DeletePolicy", validPolicyId).Return(nil)
	mockDataRetentionInterface.On("DeletePolicy", nonExistentPolicyId).Return(model.NewAppError("DeletePolicy", "app.data_retention.delete_policy.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.DeleteDataRetentionPolicy(context.Background(), validPolicyId)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.DeleteDataRetentionPolicy(context.Background(), nonExistentPolicyId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		resp, err := th.Client.DeleteDataRetentionPolicy(context.Background(), validPolicyId)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.Client.DeleteDataRetentionPolicy(context.Background(), validPolicyId)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetTeamPoliciesForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return sample team policies
	samplePolicies := &model.RetentionPolicyForTeamList{
		Policies: []*model.RetentionPolicyForTeam{
			{
				TeamID:           th.BasicTeam.Id,
				PostDurationDays: 30,
			},
			{
				TeamID:           "team2",
				PostDurationDays: 60,
			},
		},
		TotalCount: 2,
	}

	// Update the mock to expect the correct parameters
	mockDataRetentionInterface.On("GetTeamPoliciesForUser", th.BasicUser.Id, 0, 60).Return(samplePolicies, nil)
	mockDataRetentionInterface.On("GetTeamPoliciesForUser", "nonexistent_user", 0, 60).Return(nil, model.NewAppError("GetTeamPoliciesForUser", "app.user.get.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("OwnPolicies", func(t *testing.T) {
		policies, resp, err := th.Client.GetTeamPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.Len(t, policies.Policies, 2, "Should return 2 policies")
		assert.Equal(t, th.BasicTeam.Id, policies.Policies[0].TeamID, "First policy TeamID should match")
		assert.Equal(t, int64(30), policies.Policies[0].PostDurationDays, "First policy PostDurationDays should match")
	})

	t.Run("AsSystemAdmin", func(t *testing.T) {
		policies, resp, err := th.SystemAdminClient.GetTeamPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.Len(t, policies.Policies, 2, "Should return 2 policies")
	})

	t.Run("AsOtherUser", func(t *testing.T) {
		th.LoginBasic2()

		policies, resp, err := th.Client.GetTeamPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil for forbidden access")
	})

	t.Run("NonexistentUser", func(t *testing.T) {
		policies, resp, err := th.SystemAdminClient.GetTeamPoliciesForUser(context.Background(), "nonexistent_user", 0, 60)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil for non-existent user")
	})

	t.Run("Unauthorized", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		policies, resp, err := th.Client.GetTeamPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil on unauthorized access")
	})
}

func TestGetChannelPoliciesForUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return sample channel policies
	samplePolicies := &model.RetentionPolicyForChannelList{
		Policies: []*model.RetentionPolicyForChannel{
			{
				ChannelID:        th.BasicChannel.Id,
				PostDurationDays: 30,
			},
			{
				ChannelID:        "channel2",
				PostDurationDays: 60,
			},
		},
		TotalCount: 2,
	}

	// Update the mock to expect the correct parameters
	mockDataRetentionInterface.On("GetChannelPoliciesForUser", th.BasicUser.Id, 0, 60).Return(samplePolicies, nil)
	mockDataRetentionInterface.On("GetChannelPoliciesForUser", "nonexistent_user", 0, 60).Return(nil, model.NewAppError("GetChannelPoliciesForUser", "app.user.get.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("OwnPolicies", func(t *testing.T) {
		policies, resp, err := th.Client.GetChannelPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.Len(t, policies.Policies, 2, "Should return 2 policies")
		assert.Equal(t, th.BasicChannel.Id, policies.Policies[0].ChannelID, "First policy ChannelID should match")
		assert.Equal(t, int64(30), policies.Policies[0].PostDurationDays, "First policy PostDurationDays should match")
	})

	t.Run("AsSystemAdmin", func(t *testing.T) {
		policies, resp, err := th.SystemAdminClient.GetChannelPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, policies, "Policies should not be nil")
		require.Len(t, policies.Policies, 2, "Should return 2 policies")
	})

	t.Run("AsOtherUser", func(t *testing.T) {
		th.LoginBasic2()

		policies, resp, err := th.Client.GetChannelPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil for forbidden access")
	})

	t.Run("NonexistentUser", func(t *testing.T) {
		policies, resp, err := th.SystemAdminClient.GetChannelPoliciesForUser(context.Background(), "nonexistent_user", 0, 60)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil for non-existent user")
	})

	t.Run("Unauthorized", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		policies, resp, err := th.Client.GetChannelPoliciesForUser(context.Background(), th.BasicUser.Id, 0, 60)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, policies, "Policies should be nil on unauthorized access")
	})
}

func TestGetTeamsForPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return sample teams
	sampleTeams := &model.TeamsWithCount{
		Teams: []*model.Team{
			{
				Id:   model.NewId(),
				Name: "team1",
			},
			{
				Id:   model.NewId(),
				Name: "team2",
			},
		},
		TotalCount: 2,
	}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()

	mockDataRetentionInterface.On("GetTeamsForPolicy", validPolicyId, 0, 100).Return(sampleTeams, nil)
	mockDataRetentionInterface.On("GetTeamsForPolicy", nonExistentPolicyId, 0, 100).Return(nil, model.NewAppError("GetTeamsForPolicy", "app.data_retention.get_teams_for_policy.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		teams, resp, err := th.SystemAdminClient.GetTeamsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, teams, "Teams should not be nil")
		require.Len(t, teams.Teams, 2, "Should return 2 teams")
		assert.Equal(t, "team1", teams.Teams[0].Name, "First team name should match")
		assert.Equal(t, "team2", teams.Teams[1].Name, "Second team name should match")
		assert.Equal(t, int64(2), teams.TotalCount, "Total count should be 2")

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		teams, resp, err := th.SystemAdminClient.GetTeamsForRetentionPolicy(context.Background(), nonExistentPolicyId, 0, 100)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, teams, "Teams should be nil for non-existent policy")

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		teams, resp, err := th.Client.GetTeamsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, teams, "Teams should be nil when user has no permission")
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		teams, resp, err := th.Client.GetTeamsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, teams, "Teams should be nil when user is not logged in")
	})
}

func TestAddTeamsToPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()
	validTeamIDs := []string{model.NewId(), model.NewId()}
	invalidTeamIDs := []string{"invalid_team_id"}

	mockDataRetentionInterface.On("AddTeamsToPolicy", validPolicyId, mock.Anything).Return(nil)
	mockDataRetentionInterface.On("AddTeamsToPolicy", nonExistentPolicyId, mock.Anything).Return(model.NewAppError("AddTeamsToPolicy", "app.data_retention.add_teams_to_policy.app_error", nil, "", http.StatusNotFound))
	mockDataRetentionInterface.On("AddTeamsToPolicy", validPolicyId, invalidTeamIDs).Return(model.NewAppError("AddTeamsToPolicy", "app.data_retention.add_teams_to_policy.app_error", nil, "", http.StatusBadRequest))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.AddTeamsToRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.AddTeamsToRetentionPolicy(context.Background(), nonExistentPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		resp, err := th.Client.AddTeamsToRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.Client.AddTeamsToRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRemoveTeamsFromPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()
	validTeamIDs := []string{model.NewId(), model.NewId()}
	invalidTeamIDs := []string{"invalid_team_id"}

	mockDataRetentionInterface.On("RemoveTeamsFromPolicy", validPolicyId, mock.Anything).Return(nil)
	mockDataRetentionInterface.On("RemoveTeamsFromPolicy", nonExistentPolicyId, mock.Anything).Return(model.NewAppError("RemoveTeamsFromPolicy", "app.data_retention.remove_teams_from_policy.app_error", nil, "", http.StatusNotFound))
	mockDataRetentionInterface.On("RemoveTeamsFromPolicy", validPolicyId, invalidTeamIDs).Return(model.NewAppError("RemoveTeamsFromPolicy", "app.data_retention.remove_teams_from_policy.app_error", nil, "", http.StatusBadRequest))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.RemoveTeamsFromRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.RemoveTeamsFromRetentionPolicy(context.Background(), nonExistentPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		resp, err := th.Client.RemoveTeamsFromRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.Client.RemoveTeamsFromRetentionPolicy(context.Background(), validPolicyId, validTeamIDs)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetChannelsForPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	// Set up the mock to return sample channels
	sampleChannels := &model.ChannelsWithCount{
		Channels: model.ChannelListWithTeamData{
			{
				Channel: model.Channel{
					Id:   model.NewId(),
					Name: "channel1",
				},
				TeamDisplayName: "team1",
				TeamName:        "team1",
				TeamUpdateAt:    123456789,
			},
			{
				Channel: model.Channel{
					Id:   model.NewId(),
					Name: "channel2",
				},
				TeamDisplayName: "team2",
				TeamName:        "team2",
				TeamUpdateAt:    987654321,
			},
		},
		TotalCount: 2,
	}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()

	mockDataRetentionInterface.On("GetChannelsForPolicy", validPolicyId, 0, 100).Return(sampleChannels, nil)
	mockDataRetentionInterface.On("GetChannelsForPolicy", nonExistentPolicyId, 0, 100).Return(nil, model.NewAppError("GetChannelsForPolicy", "app.data_retention.get_channels_for_policy.app_error", nil, "", http.StatusNotFound))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		channels, resp, err := th.SystemAdminClient.GetChannelsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, channels, "Channels should not be nil")
		require.Len(t, channels.Channels, 2, "Should return 2 channels")
		assert.Equal(t, "channel1", channels.Channels[0].Name, "First channel name should match")
		assert.Equal(t, "channel2", channels.Channels[1].Name, "Second channel name should match")
		assert.Equal(t, int64(2), channels.TotalCount, "Total count should be 2")

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		channels, resp, err := th.SystemAdminClient.GetChannelsForRetentionPolicy(context.Background(), nonExistentPolicyId, 0, 100)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		assert.Nil(t, channels, "Channels should be nil for non-existent policy")

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleReadComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		channels, resp, err := th.Client.GetChannelsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.Nil(t, channels, "Channels should be nil when user has no permission")
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		channels, resp, err := th.Client.GetChannelsForRetentionPolicy(context.Background(), validPolicyId, 0, 100)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
		assert.Nil(t, channels, "Channels should be nil when user is not logged in")
	})
}

func TestAddChannelsToPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()
	validChannelIDs := []string{model.NewId(), model.NewId()}
	invalidChannelIDs := []string{"invalid_channel_id"}

	// Custom function to compare slices regardless of order
	unorderedSlicesEqual := func(a, b []string) bool {
		if len(a) != len(b) {
			return false
		}
		counts := make(map[string]int)
		for _, item := range a {
			counts[item]++
		}
		for _, item := range b {
			counts[item]--
			if counts[item] < 0 {
				return false
			}
		}
		return true
	}

	// Custom matcher for unordered slice comparison
	unorderedSliceMatcher := func(expected []string) func(actual []string) bool {
		return func(actual []string) bool {
			return unorderedSlicesEqual(expected, actual)
		}
	}

	mockDataRetentionInterface.On(
		"AddChannelsToPolicy",
		validPolicyId,
		mock.MatchedBy(unorderedSliceMatcher(validChannelIDs)),
	).Return(nil)
	mockDataRetentionInterface.On(
		"AddChannelsToPolicy",
		nonExistentPolicyId,
		mock.MatchedBy(unorderedSliceMatcher(validChannelIDs)),
	).Return(model.NewAppError("AddChannelsToPolicy", "app.data_retention.add_channels_to_policy.app_error", nil, "", http.StatusNotFound))
	mockDataRetentionInterface.On(
		"AddChannelsToPolicy",
		validPolicyId,
		mock.MatchedBy(unorderedSliceMatcher(invalidChannelIDs)),
	).Return(model.NewAppError("AddChannelsToPolicy", "app.data_retention.add_channels_to_policy.app_error", nil, "", http.StatusBadRequest))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.AddChannelsToRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.AddChannelsToRetentionPolicy(context.Background(), nonExistentPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("InvalidChannelIDs", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.AddChannelsToRetentionPolicy(context.Background(), validPolicyId, invalidChannelIDs)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		resp, err := th.Client.AddChannelsToRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.Client.AddChannelsToRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestRemoveChannelsFromPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up a test license with Data Retention enabled
	ok := th.App.Srv().SetLicense(model.NewTestLicense("data_retention"))
	require.True(t, ok, "SetLicense should return true")

	// Ensure the enterprise features are enabled
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.DataRetentionSettings.EnableMessageDeletion = true
		*cfg.DataRetentionSettings.EnableFileDeletion = true
	})

	// Create and set up the mock
	mockDataRetentionInterface := &mocks.DataRetentionInterface{}

	validPolicyId := model.NewId()
	nonExistentPolicyId := model.NewId()
	validChannelIDs := []string{model.NewId(), model.NewId()}
	invalidChannelIDs := []string{"invalid_channel_id"}

	// Custom matcher to ignore order of channelIDs
	matchChannelIDs := func(expected []string) func([]string) bool {
		return func(actual []string) bool {
			if len(expected) != len(actual) {
				return false
			}
			expectedMap := make(map[string]bool)
			for _, id := range expected {
				expectedMap[id] = true
			}
			for _, id := range actual {
				if !expectedMap[id] {
					return false
				}
			}
			return true
		}
	}

	mockDataRetentionInterface.On("RemoveChannelsFromPolicy", validPolicyId, mock.MatchedBy(matchChannelIDs(validChannelIDs))).Return(nil)
	mockDataRetentionInterface.On("RemoveChannelsFromPolicy", nonExistentPolicyId, mock.MatchedBy(matchChannelIDs(validChannelIDs))).Return(model.NewAppError("RemoveChannelsFromPolicy", "app.data_retention.remove_channels_from_policy.app_error", nil, "", http.StatusNotFound))
	mockDataRetentionInterface.On("RemoveChannelsFromPolicy", validPolicyId, mock.MatchedBy(matchChannelIDs(invalidChannelIDs))).Return(model.NewAppError("RemoveChannelsFromPolicy", "app.data_retention.remove_channels_from_policy.app_error", nil, "", http.StatusBadRequest))

	// Set the mock on the app
	th.App.Srv().Channels().DataRetention = mockDataRetentionInterface

	t.Run("Success", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.RemoveChannelsFromRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NonExistentPolicy", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.RemoveChannelsFromRetentionPolicy(context.Background(), nonExistentPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("InvalidChannelIDs", func(t *testing.T) {
		// Grant necessary permission to system admin
		th.AddPermissionToRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)

		resp, err := th.SystemAdminClient.RemoveChannelsFromRetentionPolicy(context.Background(), validPolicyId, invalidChannelIDs)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		// Clean up: remove the permission after the test
		th.RemovePermissionFromRole(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy.Id, model.SystemAdminRoleId)
	})

	t.Run("NoPermission", func(t *testing.T) {
		resp, err := th.Client.RemoveChannelsFromRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("NotLoggedIn", func(t *testing.T) {
		resp, err := th.Client.Logout(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		resp, err = th.Client.RemoveChannelsFromRetentionPolicy(context.Background(), validPolicyId, validChannelIDs)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
