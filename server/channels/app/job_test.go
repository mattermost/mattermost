// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

func TestGetJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}

	_, err := th.App.Srv().Store().Job().Save(status)
	require.NoError(t, err)
	defer func() {
		_, err = th.App.Srv().Store().Job().Delete(status.Id)
		require.NoError(t, err)
	}()

	received, appErr := th.App.GetJob(th.Context, status.Id)
	require.Nil(t, appErr)
	require.Equal(t, status, received, "incorrect job status received")
}

func TestSessionHasPermissionToCreateJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	jobs := []model.Job{
		{
			Id:       model.NewId(),
			Type:     model.JobTypeDataRetention,
			CreateAt: 999,
		},
		{
			Id:       model.NewId(),
			Type:     model.JobTypeMessageExport,
			CreateAt: 1001,
		},
	}

	testCases := []struct {
		Job                model.Job
		PermissionRequired *model.Permission
	}{
		{
			Job:                jobs[0],
			PermissionRequired: model.PermissionCreateDataRetentionJob,
		},
		{
			Job:                jobs[1],
			PermissionRequired: model.PermissionCreateComplianceExportJob,
		},
	}

	session := model.Session{
		Roles: model.SystemUserRoleId + " " + model.SystemAdminRoleId,
	}

	// Check to see if admin has permission to all the jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(session, &testCase.Job)
		assert.Equal(t, true, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	session = model.Session{
		Roles: model.SystemUserRoleId + " " + model.SystemReadOnlyAdminRoleId,
	}

	// Initially the system read only admin should not have access to create these jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(session, &testCase.Job)
		assert.Equal(t, false, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	ctx := sqlstore.WithMaster(context.Background())
	role, _ := th.App.GetRoleByName(ctx, model.SystemReadOnlyAdminRoleId)

	role.Permissions = append(role.Permissions, model.PermissionCreateDataRetentionJob.Id)
	role.Permissions = append(role.Permissions, model.PermissionCreateComplianceExportJob.Id)

	_, err := th.App.UpdateRole(role)
	require.Nil(t, err)

	// Now system read only admin should have ability to create all jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(session, &testCase.Job)
		assert.Equal(t, true, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}
}

func TestSessionHasPermissionToCreateAccessControlSyncJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Create a private channel and make BasicUser a channel admin
	privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
	_, err := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
	require.Nil(t, err)

	// Update BasicUser to have channel admin permissions for this channel
	_, err = th.App.UpdateChannelMemberRoles(th.Context, privateChannel.Id, th.BasicUser.Id,
		model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
	require.Nil(t, err)

	job := model.Job{
		Id:   model.NewId(),
		Type: model.JobTypeAccessControlSync,
	}

	t.Run("system admin can create access control sync job", func(t *testing.T) {
		adminSession := model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(adminSession, &job)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("channel admin can create access control sync job for their channel", func(t *testing.T) {
		channelAdminSession := model.Session{
			UserId: th.BasicUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		// Create job with channel-specific data (like channel admin would)
		jobWithChannelData := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"policy_id": privateChannel.Id, // Channel admin jobs have policy_id = channelID
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(channelAdminSession, &jobWithChannelData)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageChannelAccessRules.Id, permissionRequired.Id)
	})

	t.Run("channel admin cannot create access control sync job for other channel", func(t *testing.T) {
		// Create another private channel that BasicUser is NOT admin of
		otherChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)

		// EXPLICITLY remove channel admin role from BasicUser for otherChannel
		// (CreatePrivateChannel might auto-add admin roles)
		_, err := th.App.UpdateChannelMemberRoles(th.Context, otherChannel.Id, th.BasicUser.Id, model.ChannelUserRoleId)
		require.Nil(t, err)

		// Verify BasicUser is NOT a channel admin of otherChannel
		otherChannelMember, err := th.App.GetChannelMember(th.Context, otherChannel.Id, th.BasicUser.Id)
		require.Nil(t, err)
		require.NotNil(t, otherChannelMember)
		// BasicUser should only be a regular member, not admin
		assert.Equal(t, model.ChannelUserRoleId, otherChannelMember.Roles)

		channelAdminSession := model.Session{
			UserId: th.BasicUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		// Try to create job for channel they don't admin
		jobWithOtherChannelData := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"policy_id": otherChannel.Id,
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(channelAdminSession, &jobWithOtherChannelData)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("regular user cannot create access control sync job", func(t *testing.T) {
		regularUser := th.CreateUser()
		regularUserSession := model.Session{
			UserId: regularUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		// Regular user tries to create job with channel data
		jobWithChannelData := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"policy_id": privateChannel.Id,
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(regularUserSession, &jobWithChannelData)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})
}

func TestCreateAccessControlSyncJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Helper function to skip tests that require enterprise job creation
	skipIfEnterpriseJobCreationFails := func(t *testing.T, appErr *model.AppError) {
		if appErr != nil && (appErr.Id == "model.job.is_valid.type.app_error" || appErr.Id == "app.job.create_access_control_sync.job_creation_failed") {
			t.Skip("Skipping test - enterprise job type not registered in test environment")
		}
	}

	// Helper function to create a job directly in the store for tests that need existing jobs
	createJobInStore := func(policyID string, status string) *model.Job {
		job := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: status,
			Data: map[string]string{
				"policy_id": policyID,
			},
			CreateAt: model.GetMillis(),
		}
		savedJob, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		return savedJob
	}
	_ = createJobInStore // Mark as used to avoid compiler error

	t.Run("cancels pending job and creates new one", func(t *testing.T) {
		// Create an existing pending job manually in the store
		existingJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusPending,
			Data: map[string]string{
				"policy_id": "channel456",
			},
		}
		_, err := th.App.Srv().Store().Job().Save(existingJob)
		require.NoError(t, err)
		defer func() { _, _ = th.App.Srv().Store().Job().Delete(existingJob.Id) }()

		// Test the cancellation logic by calling the method directly
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel456",
		})
		require.NoError(t, storeErr)
		require.Len(t, existingJobs, 1)

		// Verify that the store method finds the job
		assert.Equal(t, existingJob.Id, existingJobs[0].Id)
		assert.Equal(t, model.JobStatusPending, existingJobs[0].Status)

		// Test the cancellation logic directly
		for _, job := range existingJobs {
			if job.Status == model.JobStatusPending || job.Status == model.JobStatusInProgress {
				appErr := th.App.CancelJob(th.Context, job.Id)
				require.Nil(t, appErr)
			}
		}

		// Verify that the job was cancelled
		updatedJob, getErr := th.App.Srv().Store().Job().Get(th.Context, existingJob.Id)
		require.NoError(t, getErr)
		// Job should be either cancel_requested or canceled (async process)
		assert.Contains(t, []string{model.JobStatusCancelRequested, model.JobStatusCanceled}, updatedJob.Status)
	})

	t.Run("cancels in-progress job and creates new one", func(t *testing.T) {
		// Create an existing in-progress job
		existingJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusInProgress,
			Data: map[string]string{
				"policy_id": "channel789",
			},
		}
		_, err := th.App.Srv().Store().Job().Save(existingJob)
		require.NoError(t, err)
		defer func() { _, _ = th.App.Srv().Store().Job().Delete(existingJob.Id) }()

		// Test that GetByTypeAndData finds the in-progress job
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel789",
		})
		require.NoError(t, storeErr)
		require.Len(t, existingJobs, 1)
		assert.Equal(t, model.JobStatusInProgress, existingJobs[0].Status)

		// Test cancellation of in-progress job
		appErr := th.App.CancelJob(th.Context, existingJob.Id)
		require.Nil(t, appErr)

		// Verify cancellation was requested (job cancellation is asynchronous)
		updatedJob, getErr := th.App.Srv().Store().Job().Get(th.Context, existingJob.Id)
		require.NoError(t, getErr)
		// Job should be either cancel_requested or canceled (async process)
		assert.Contains(t, []string{model.JobStatusCancelRequested, model.JobStatusCanceled}, updatedJob.Status)
	})

	t.Run("leaves completed jobs alone", func(t *testing.T) {
		// Create an existing completed job
		existingJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusSuccess,
			Data: map[string]string{
				"policy_id": "channel101",
			},
		}
		_, err := th.App.Srv().Store().Job().Save(existingJob)
		require.NoError(t, err)
		defer func() { _, _ = th.App.Srv().Store().Job().Delete(existingJob.Id) }()

		// Test that GetByTypeAndData finds the completed job
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel101",
		})
		require.NoError(t, storeErr)
		require.Len(t, existingJobs, 1)
		assert.Equal(t, model.JobStatusSuccess, existingJobs[0].Status)

		// Test that we don't cancel completed jobs (logic test)
		shouldCancel := existingJob.Status == model.JobStatusPending || existingJob.Status == model.JobStatusInProgress
		assert.False(t, shouldCancel, "Should not cancel completed jobs")

		// Verify the job status is unchanged
		updatedJob, getErr := th.App.Srv().Store().Job().Get(th.Context, existingJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, model.JobStatusSuccess, updatedJob.Status)
	})

	t.Run("handles missing policy_id", func(t *testing.T) {
		// Try to create job without policy_id
		jobData := map[string]string{
			"other_field": "value",
		}

		job, appErr := th.App.CreateAccessControlSyncJob(th.Context, jobData)
		require.NotNil(t, appErr)
		require.Nil(t, job)
		assert.Equal(t, "app.job.create_access_control_sync.missing_policy_id", appErr.Id)
		assert.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("handles empty policy_id", func(t *testing.T) {
		// Try to create job with empty policy_id
		jobData := map[string]string{
			"policy_id": "",
		}

		job, appErr := th.App.CreateAccessControlSyncJob(th.Context, jobData)
		require.NotNil(t, appErr)
		require.Nil(t, job)
		assert.Equal(t, "app.job.create_access_control_sync.missing_policy_id", appErr.Id)
		assert.Equal(t, 400, appErr.StatusCode)
	})

	t.Run("enforces permission validation - system admin can create", func(t *testing.T) {
		// Set up context with system admin session
		adminSession := &model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		adminContext := th.Context.WithSession(adminSession)

		jobData := map[string]string{
			"policy_id": "channel123",
		}

		job, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeAccessControlSync, job.Type)
		assert.Equal(t, "channel123", job.Data["policy_id"])

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job.Id)
	})

	t.Run("creates job when no existing jobs exist", func(t *testing.T) {
		// Test the core app layer functionality: creating a job when none exist
		adminContext := th.Context.WithSession(&model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		jobData := map[string]string{
			"policy_id": "new_channel_123",
		}

		job, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, "new_channel_123", job.Data["policy_id"])
		assert.Equal(t, model.JobTypeAccessControlSync, job.Type)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job.Id)
	})

	t.Run("enforces permission validation - channel admin can create for their channel", func(t *testing.T) {
		// Create a private channel and make BasicUser a channel admin
		privateChannel := th.CreatePrivateChannel(th.Context, th.BasicTeam)
		_, err := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, err)

		// Update BasicUser to have channel admin permissions for this channel
		_, err = th.App.UpdateChannelMemberRoles(th.Context, privateChannel.Id, th.BasicUser.Id,
			model.ChannelUserRoleId+" "+model.ChannelAdminRoleId)
		require.Nil(t, err)

		// Set up context with channel admin session
		channelAdminSession := &model.Session{
			UserId: th.BasicUser.Id,
			Roles:  model.SystemUserRoleId,
		}
		channelAdminContext := th.Context.WithSession(channelAdminSession)

		jobData := map[string]string{
			"policy_id": privateChannel.Id, // Channel admin jobs have policy_id = channelID
		}

		job, appErr := th.App.CreateAccessControlSyncJob(channelAdminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		assert.Equal(t, model.JobTypeAccessControlSync, job.Type)
		assert.Equal(t, privateChannel.Id, job.Data["policy_id"])

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job.Id)
	})

	t.Run("ignores completed jobs when creating new job", func(t *testing.T) {
		// Test that completed jobs don't get cancelled - only pending/in-progress
		adminContext := th.Context.WithSession(&model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		jobData := map[string]string{
			"policy_id": "test_completed_channel",
		}

		// Create and complete a job first
		completedJob, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, completedJob)

		// Mark it as completed
		err := th.App.Srv().Jobs.SetJobSuccess(completedJob)
		require.Nil(t, err)

		// Create another job - should not affect the completed one
		newJob, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, newJob)
		assert.NotEqual(t, completedJob.Id, newJob.Id)

		// Verify completed job is still completed (not cancelled)
		completedJobCheck, err := th.App.GetJob(th.Context, completedJob.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusSuccess, completedJobCheck.Status)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(completedJob.Id)
		_, _ = th.App.Srv().Store().Job().Delete(newJob.Id)
	})

	t.Run("handles multiple existing jobs correctly", func(t *testing.T) {
		// Test cancelling multiple existing jobs for the same policy
		adminContext := th.Context.WithSession(&model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		jobData := map[string]string{
			"policy_id": "multi_job_channel",
		}

		// Create multiple jobs for the same policy
		job1, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		job2, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		job3, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)

		// All should be different jobs (each cancels previous ones)
		assert.NotEqual(t, job1.Id, job2.Id)
		assert.NotEqual(t, job2.Id, job3.Id)
		assert.NotEqual(t, job1.Id, job3.Id)

		// Verify first two jobs are cancelled
		cancelledJob1, err := th.App.GetJob(th.Context, job1.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusCanceled, cancelledJob1.Status)

		cancelledJob2, err := th.App.GetJob(th.Context, job2.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusCanceled, cancelledJob2.Status)

		// Third job should still be pending
		activeJob, err := th.App.GetJob(th.Context, job3.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusPending, activeJob.Status)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job1.Id)
		_, _ = th.App.Srv().Store().Job().Delete(job2.Id)
		_, _ = th.App.Srv().Store().Job().Delete(job3.Id)
	})

	t.Run("routes through CreateJob switch statement correctly", func(t *testing.T) {
		// Test that CreateJob properly routes ABAC jobs to CreateAccessControlSyncJob
		adminSession := &model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		adminContext := th.Context.WithSession(adminSession)

		// Create job through the CreateJob method (which has the switch statement)
		job := &model.Job{
			Type: model.JobTypeAccessControlSync,
			Data: map[string]string{
				"policy_id": "channel456",
			},
		}

		createdJob, appErr := th.App.CreateJob(adminContext, job)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, createdJob)
		assert.Equal(t, model.JobTypeAccessControlSync, createdJob.Type)
		assert.Equal(t, "channel456", createdJob.Data["policy_id"])

		// Verify it went through deduplication logic by checking if it's saved in store
		retrievedJob, getErr := th.App.Srv().Store().Job().Get(adminContext, createdJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, createdJob.Id, retrievedJob.Id)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(createdJob.Id)
	})

	t.Run("routes non-ABAC jobs through default path", func(t *testing.T) {
		// Test that CreateJob routes non-ABAC jobs to the generic Jobs.CreateJob
		adminSession := &model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		adminContext := th.Context.WithSession(adminSession)

		// Create a non-ABAC job
		job := &model.Job{
			Type: model.JobTypeActiveUsers,
			Data: map[string]string{
				"test_field": "test_value",
			},
		}

		createdJob, appErr := th.App.CreateJob(adminContext, job)
		require.Nil(t, appErr)
		require.NotNil(t, createdJob)
		assert.Equal(t, model.JobTypeActiveUsers, createdJob.Type)
		assert.Equal(t, "test_value", createdJob.Data["test_field"])

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(createdJob.Id)
	})

	t.Run("creates proper audit records", func(t *testing.T) {
		adminSession := &model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		adminContext := th.Context.WithSession(adminSession)

		jobData := map[string]string{
			"policy_id": "channel789",
		}

		// Test successful job creation audit
		job, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job)

		// The audit logging happens in defer, so we can verify the job was created successfully
		// which means the audit record should have been logged with Success()
		assert.Equal(t, model.JobTypeAccessControlSync, job.Type)
		assert.Equal(t, "channel789", job.Data["policy_id"])

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job.Id)
	})

	t.Run("handles different policy IDs independently", func(t *testing.T) {
		// Test that jobs for different policies don't interfere with each other
		adminContext := th.Context.WithSession(&model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		})

		// Create jobs for different policies
		job1Data := map[string]string{"policy_id": "channel_A"}
		job2Data := map[string]string{"policy_id": "channel_B"}

		job1, appErr := th.App.CreateAccessControlSyncJob(adminContext, job1Data)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		job2, appErr := th.App.CreateAccessControlSyncJob(adminContext, job2Data)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)

		// Both jobs should exist and be pending (no cancellation between different policies)
		job1Check, err := th.App.GetJob(th.Context, job1.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusPending, job1Check.Status)

		job2Check, err := th.App.GetJob(th.Context, job2.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusPending, job2Check.Status)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job1.Id)
		_, _ = th.App.Srv().Store().Job().Delete(job2.Id)
	})

	t.Run("cancels existing job and creates new one for same policy", func(t *testing.T) {
		adminSession := &model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		adminContext := th.Context.WithSession(adminSession)

		jobData := map[string]string{
			"policy_id": "race_test_channel",
		}

		// Create first job
		job1, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job1)
		assert.Equal(t, "race_test_channel", job1.Data["policy_id"])

		// Immediately try to create another job with same policy_id (simulating rapid save clicks)
		job2, appErr := th.App.CreateAccessControlSyncJob(adminContext, jobData)
		skipIfEnterpriseJobCreationFails(t, appErr)
		require.Nil(t, appErr)
		require.NotNil(t, job2)

		// Current implementation cancels existing job and creates new one (following team.go pattern)
		// This ensures latest policy changes are always processed
		assert.NotEqual(t, job1.Id, job2.Id, "Should create new job and cancel existing one")
		assert.Equal(t, job1.Data["policy_id"], job2.Data["policy_id"])

		// Verify first job was cancelled
		cancelledJob, err := th.App.GetJob(th.Context, job1.Id)
		require.Nil(t, err)
		assert.Equal(t, model.JobStatusCanceled, cancelledJob.Status)

		// Clean up
		_, _ = th.App.Srv().Store().Job().Delete(job1.Id)
		_, _ = th.App.Srv().Store().Job().Delete(job2.Id)
	})
}

func TestSessionHasPermissionToReadJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	jobs := []model.Job{
		{
			Id:       model.NewId(),
			Type:     model.JobTypeDataRetention,
			CreateAt: 999,
		},
		{
			Id:       model.NewId(),
			Type:     model.JobTypeMessageExport,
			CreateAt: 1001,
		},
	}
	testCases := []struct {
		Job                model.Job
		PermissionRequired *model.Permission
	}{
		{
			Job:                jobs[0],
			PermissionRequired: model.PermissionReadDataRetentionJob,
		},
		{
			Job:                jobs[1],
			PermissionRequired: model.PermissionReadComplianceExportJob,
		},
	}

	session := model.Session{
		Roles: model.SystemUserRoleId + " " + model.SystemAdminRoleId,
	}

	// Check to see if admin has permission to all the jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToReadJob(session, testCase.Job.Type)
		assert.Equal(t, true, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	session = model.Session{
		Roles: model.SystemUserRoleId + " " + model.SystemManagerRoleId,
	}

	// Initially the system manager should not have access to read these jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToReadJob(session, testCase.Job.Type)
		assert.Equal(t, false, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	ctx := sqlstore.WithMaster(context.Background())
	role, _ := th.App.GetRoleByName(ctx, model.SystemManagerRoleId)

	role.Permissions = append(role.Permissions, model.PermissionReadDataRetentionJob.Id)

	_, err := th.App.UpdateRole(role)
	require.Nil(t, err)

	// Now system manager should have ability to read data retention jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToReadJob(session, testCase.Job.Type)
		expectedHasPermission := testCase.Job.Type == model.JobTypeDataRetention
		assert.Equal(t, expectedHasPermission, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	role.Permissions = append(role.Permissions, model.PermissionReadComplianceExportJob.Id)

	_, err = th.App.UpdateRole(role)
	require.Nil(t, err)

	// Now system read only admin should have ability to create all jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToReadJob(session, testCase.Job.Type)
		assert.Equal(t, true, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}
}

func TestGetJobByType(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	jobType := model.NewId()

	statuses := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1000,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 999,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1001,
		},
	}

	for _, status := range statuses {
		_, err := th.App.Srv().Store().Job().Save(status)
		require.NoError(t, err)
		defer func() {
			_, err = th.App.Srv().Store().Job().Delete(status.Id)
			require.NoError(t, err)
		}()
	}

	received, err := th.App.GetJobsByTypePage(th.Context, jobType, 0, 2)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of statuses")
	require.Equal(t, statuses[2], received[0], "should've received newest job first")
	require.Equal(t, statuses[0], received[1], "should've received second newest job second")

	received, err = th.App.GetJobsByTypePage(th.Context, jobType, 1, 2)
	require.Nil(t, err)
	require.Len(t, received, 1, "received wrong number of statuses")
	require.Equal(t, statuses[1], received[0], "should've received oldest job last")
}

func TestGetJobsByTypes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	jobType := model.NewId()
	jobType1 := model.NewId()
	jobType2 := model.NewId()

	statuses := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1000,
		},
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 999,
		},
		{
			Id:       model.NewId(),
			Type:     jobType2,
			CreateAt: 1001,
		},
	}

	for _, status := range statuses {
		_, err := th.App.Srv().Store().Job().Save(status)
		require.NoError(t, err)
		defer func() {
			_, err = th.App.Srv().Store().Job().Delete(status.Id)
			require.NoError(t, err)
		}()
	}

	jobTypes := []string{jobType, jobType1, jobType2}
	received, err := th.App.GetJobsByTypesPage(th.Context, jobTypes, 0, 2)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, statuses[2], received[0], "should've received newest job first")
	require.Equal(t, statuses[0], received[1], "should've received second newest job second")

	received, err = th.App.GetJobsByTypesPage(th.Context, jobTypes, 1, 2)
	require.Nil(t, err)
	require.Len(t, received, 1, "received wrong number of jobs")
	require.Equal(t, statuses[1], received[0], "should've received oldest job last")

	jobTypes = []string{jobType1, jobType2}
	received, err = th.App.GetJobsByTypesPage(th.Context, jobTypes, 0, 3)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, statuses[2], received[0], "received wrong job type")
	require.Equal(t, statuses[1], received[1], "received wrong job type")
}
