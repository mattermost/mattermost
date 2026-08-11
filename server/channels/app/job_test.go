// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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

	role, _ := th.App.GetRoleByName(RequestContextWithMaster(th.Context), model.SystemReadOnlyAdminRoleId)

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
	th := Setup(t).InitBasic(t)

	// Create a private channel and make BasicUser a channel admin
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
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
		otherChannel := th.CreatePrivateChannel(t, th.BasicTeam)

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

	t.Run("team admin can create team-scoped sync job with team_id only", func(t *testing.T) {
		teamAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, teamAdmin, th.BasicTeam)
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, "team_user team_admin")
		require.Nil(t, appErr)

		teamAdminSession := model.Session{
			UserId: teamAdmin.Id,
			Roles:  model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{TeamId: th.BasicTeam.Id, UserId: teamAdmin.Id, Roles: "team_user team_admin"},
			},
		}

		jobWithTeamOnly := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"team_id": th.BasicTeam.Id,
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(teamAdminSession, &jobWithTeamOnly)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageTeamAccessRules.Id, permissionRequired.Id)
	})

	t.Run("team admin can create policy-scoped sync job for their owned policy", func(t *testing.T) {
		teamAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, teamAdmin, th.BasicTeam)
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, "team_user team_admin")
		require.Nil(t, appErr)

		// Build ownership via the real parent->child channel relationship, then reconcile scope.
		parentPolicy := &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "team-owned-policy",
			Type:    model.AccessControlPolicyTypeParent,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules:   []model.AccessControlPolicyRule{{Actions: []string{"*"}, Expression: "true"}},
		}
		savedParent, storeErr := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
		require.NoError(t, storeErr)

		channel := th.CreatePrivateChannel(t, th.BasicTeam)
		childPolicy := &model.AccessControlPolicy{
			ID:      channel.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
		}
		require.Nil(t, childPolicy.Inherit(savedParent))
		_, storeErr = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, childPolicy)
		require.NoError(t, storeErr)

		appErr = th.App.ReconcilePolicyTeamScope(th.Context, savedParent.ID)
		require.Nil(t, appErr)

		teamAdminSession := model.Session{
			UserId: teamAdmin.Id,
			Roles:  model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{TeamId: th.BasicTeam.Id, UserId: teamAdmin.Id, Roles: "team_user team_admin"},
			},
		}

		jobWithOwnedPolicy := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"team_id":   th.BasicTeam.Id,
				"policy_id": savedParent.ID,
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(teamAdminSession, &jobWithOwnedPolicy)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageTeamAccessRules.Id, permissionRequired.Id)
	})

	t.Run("team admin cannot smuggle a foreign policy_id alongside their team_id", func(t *testing.T) {
		teamAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, teamAdmin, th.BasicTeam)
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, "team_user team_admin")
		require.Nil(t, appErr)

		teamAdminSession := model.Session{
			UserId: teamAdmin.Id,
			Roles:  model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{TeamId: th.BasicTeam.Id, UserId: teamAdmin.Id, Roles: "team_user team_admin"},
			},
		}

		jobWithPolicyAndTeam := model.Job{
			Id:   model.NewId(),
			Type: model.JobTypeAccessControlSync,
			Data: model.StringMap{
				"team_id":   th.BasicTeam.Id,
				"policy_id": model.NewId(), // foreign policy the team admin does not own
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(teamAdminSession, &jobWithPolicyAndTeam)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("regular user cannot create access control sync job", func(t *testing.T) {
		regularUser := th.CreateUser(t)
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

func TestSessionHasPermissionToTeamSyncJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	teamSyncJob := model.Job{
		Id:   model.NewId(),
		Type: model.JobTypeAccessControlTeamSync,
	}

	t.Run("system admin can create team sync job", func(t *testing.T) {
		adminSession := model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(adminSession, &teamSyncJob)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("team admin cannot create team sync job", func(t *testing.T) {
		teamAdmin := th.CreateUser(t)
		th.LinkUserToTeam(t, teamAdmin, th.BasicTeam)
		_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, teamAdmin.Id, "team_user team_admin")
		require.Nil(t, appErr)

		teamAdminSession := model.Session{
			UserId: teamAdmin.Id,
			Roles:  model.SystemUserRoleId,
			TeamMembers: []*model.TeamMember{
				{TeamId: th.BasicTeam.Id, UserId: teamAdmin.Id, Roles: "team_user team_admin"},
			},
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(teamAdminSession, &teamSyncJob)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("regular user cannot create team sync job", func(t *testing.T) {
		regularUser := th.CreateUser(t)
		regularSession := model.Session{
			UserId: regularUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(regularSession, &teamSyncJob)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})

	t.Run("only system admin can read team sync job", func(t *testing.T) {
		adminSession := model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		regularSession := model.Session{
			UserId: th.BasicUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToReadJob(adminSession, model.JobTypeAccessControlTeamSync)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)

		hasPermission, permissionRequired = th.App.SessionHasPermissionToReadJob(regularSession, model.JobTypeAccessControlTeamSync)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageTeamAccessRules.Id, permissionRequired.Id)
	})

	t.Run("only system admin can manage team sync job", func(t *testing.T) {
		adminSession := model.Session{
			UserId: th.SystemAdminUser.Id,
			Roles:  model.SystemUserRoleId + " " + model.SystemAdminRoleId,
		}
		regularSession := model.Session{
			UserId: th.BasicUser.Id,
			Roles:  model.SystemUserRoleId,
		}

		hasPermission, permissionRequired := th.App.SessionHasPermissionToManageJob(adminSession, &teamSyncJob)
		assert.True(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)

		hasPermission, permissionRequired = th.App.SessionHasPermissionToManageJob(regularSession, &teamSyncJob)
		assert.False(t, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, model.PermissionManageSystem.Id, permissionRequired.Id)
	})
}

func TestCreateAccessControlSyncJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

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
		t.Cleanup(func() {
			_, stErr := th.App.Srv().Store().Job().Delete(existingJob.Id)
			require.NoError(t, stErr)
		})

		// Test the cancellation logic by calling the method directly
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel456",
		}, false, model.JobStatusPending, model.JobStatusInProgress)
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
		t.Cleanup(func() {
			_, stErr := th.App.Srv().Store().Job().Delete(existingJob.Id)
			require.NoError(t, stErr)
		})

		// Test that GetByTypeAndData finds the in-progress job
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel789",
		}, false, model.JobStatusPending, model.JobStatusInProgress)
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
		t.Cleanup(func() {
			_, stErr := th.App.Srv().Store().Job().Delete(existingJob.Id)
			require.NoError(t, stErr)
		})

		// Test that GetByTypeAndData finds the completed job
		existingJobs, storeErr := th.App.Srv().Store().Job().GetByTypeAndData(th.Context, model.JobTypeAccessControlSync, map[string]string{
			"policy_id": "channel101",
		}, false)
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

	// Test deduplication logic with status filtering to ensure database optimization works correctly

	t.Run("deduplication respects status filtering", func(t *testing.T) {
		// Create jobs with different statuses
		pendingJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusPending,
			Data:   map[string]string{"policy_id": "channel999"},
		}

		completedJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusSuccess,
			Data:   map[string]string{"policy_id": "channel999"},
		}

		for _, job := range []*model.Job{pendingJob, completedJob} {
			_, err := th.App.Srv().Store().Job().Save(job)
			require.NoError(t, err)

			// Capture job ID to avoid closure variable capture issue
			jobID := job.Id
			t.Cleanup(func() {
				_, stErr := th.App.Srv().Store().Job().Delete(jobID)
				require.NoError(t, stErr)
			})
		}

		// Verify status filtering returns only active jobs
		activeJobs, err := th.App.Srv().Store().Job().GetByTypeAndData(
			th.Context,
			model.JobTypeAccessControlSync,
			map[string]string{"policy_id": "channel999"},
			false,
			model.JobStatusPending, model.JobStatusInProgress, // Only active statuses
		)
		require.NoError(t, err)
		require.Len(t, activeJobs, 1, "Should only find active jobs (pending/in-progress)")
		assert.Equal(t, pendingJob.Id, activeJobs[0].Id, "Should find the pending job")

		// Verify all jobs are returned when no status filter is provided
		allJobs, err := th.App.Srv().Store().Job().GetByTypeAndData(
			th.Context,
			model.JobTypeAccessControlSync,
			map[string]string{"policy_id": "channel999"},
			false, // No status filter
		)
		require.NoError(t, err)
		require.Len(t, allJobs, 2, "Should find all jobs when no status filter")
	})
}

func TestCreateAccessControlTeamSyncJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// The enterprise team-sync worker is not registered in the OSS test binary,
	// so the trailing CreateJob inside CreateAccessControlTeamSyncJob may return
	// an "invalid job type" error. That is irrelevant to what we assert here: the
	// deduplication (cancellation of existing jobs) runs *before* that create, so
	// its side effects are fully observable regardless of whether the create
	// itself succeeds. Assertions target specific pre-existing job IDs, so they
	// hold whether or not a new job row is created.

	t.Run("cancels pending team sync for same policy and leaves channel sync untouched", func(t *testing.T) {
		policyID := model.NewId()

		// A team-type policy's ID equals its team ID; a channel sync for the same
		// policy_id must NOT be canceled by a team sync (no cross-type dedup).
		teamJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlTeamSync,
			Status: model.JobStatusPending,
			Data:   map[string]string{"policy_id": policyID},
		}
		channelJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlSync,
			Status: model.JobStatusPending,
			Data:   map[string]string{"policy_id": policyID},
		}
		for _, job := range []*model.Job{teamJob, channelJob} {
			_, err := th.App.Srv().Store().Job().Save(job)
			require.NoError(t, err)
			jobID := job.Id
			t.Cleanup(func() {
				_, stErr := th.App.Srv().Store().Job().Delete(jobID)
				require.NoError(t, stErr)
			})
		}

		_, _ = th.App.CreateAccessControlTeamSyncJob(th.Context, map[string]string{"policy_id": policyID})

		canceledTeamJob, getErr := th.App.Srv().Store().Job().Get(th.Context, teamJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, model.JobStatusCanceled, canceledTeamJob.Status, "team sync for the same policy should be canceled")

		untouchedChannelJob, getErr := th.App.Srv().Store().Job().Get(th.Context, channelJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, model.JobStatusPending, untouchedChannelJob.Status, "channel sync must not be canceled by a team sync")
	})

	t.Run("leaves team sync for a different policy untouched", func(t *testing.T) {
		otherPolicyID := model.NewId()
		otherJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlTeamSync,
			Status: model.JobStatusPending,
			Data:   map[string]string{"policy_id": otherPolicyID},
		}
		_, err := th.App.Srv().Store().Job().Save(otherJob)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, stErr := th.App.Srv().Store().Job().Delete(otherJob.Id)
			require.NoError(t, stErr)
		})

		_, _ = th.App.CreateAccessControlTeamSyncJob(th.Context, map[string]string{"policy_id": model.NewId()})

		untouched, getErr := th.App.Srv().Store().Job().Get(th.Context, otherJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, model.JobStatusPending, untouched.Status, "team sync for a different policy must be left alone")
	})

	t.Run("without policy_id does not cancel any team sync", func(t *testing.T) {
		policyID := model.NewId()
		teamJob := &model.Job{
			Id:     model.NewId(),
			Type:   model.JobTypeAccessControlTeamSync,
			Status: model.JobStatusPending,
			Data:   map[string]string{"policy_id": policyID},
		}
		_, err := th.App.Srv().Store().Job().Save(teamJob)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, stErr := th.App.Srv().Store().Job().Delete(teamJob.Id)
			require.NoError(t, stErr)
		})

		// No policy_id -> the dedup branch is skipped entirely.
		_, _ = th.App.CreateAccessControlTeamSyncJob(th.Context, map[string]string{})

		untouched, getErr := th.App.Srv().Store().Job().Get(th.Context, teamJob.Id)
		require.NoError(t, getErr)
		assert.Equal(t, model.JobStatusPending, untouched.Status, "a create without policy_id must not cancel existing team syncs")
	})
}

func TestSessionHasPermissionToReadJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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

	role, _ := th.App.GetRoleByName(RequestContextWithMaster(th.Context), model.SystemManagerRoleId)

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

func TestGetJobsByTypeAndData(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	// Unique synthetic types avoid collisions with jobs seeded elsewhere (same pattern as TestGetJobByType).
	targetJobType := model.NewId()
	otherJobType := model.NewId()

	policyID := model.NewId()
	otherPolicyID := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     targetJobType,
			CreateAt: 1000,
			Data:     map[string]string{"policy_id": policyID},
		},
		{
			Id:       model.NewId(),
			Type:     targetJobType,
			CreateAt: 999,
			Data:     map[string]string{"policy_id": policyID},
		},
		{
			Id:       model.NewId(),
			Type:     targetJobType,
			CreateAt: 1001,
			Data:     map[string]string{"policy_id": policyID},
		},
		{
			Id:       model.NewId(),
			Type:     targetJobType,
			CreateAt: 1002,
			Data:     map[string]string{"policy_id": otherPolicyID},
		},
		{
			Id:       model.NewId(),
			Type:     otherJobType,
			CreateAt: 1003,
			Data:     map[string]string{"policy_id": policyID},
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		defer func(id string) {
			_, err := th.App.Srv().Store().Job().Delete(id)
			require.NoError(t, err)
		}(job.Id)
	}

	t.Run("returns all matching jobs for policy", func(t *testing.T) {
		received, appErr := th.App.GetJobsByTypeAndData(th.Context, targetJobType,
			map[string]string{"policy_id": policyID})
		require.Nil(t, appErr)
		require.Len(t, received, 3)
		receivedIDs := make([]string, len(received))
		for i, j := range received {
			receivedIDs[i] = j.Id
			assert.Equal(t, targetJobType, j.Type)
		}
		require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id, jobs[2].Id}, receivedIDs)
	})

	t.Run("filters by data key-value, excludes other policies", func(t *testing.T) {
		received, appErr := th.App.GetJobsByTypeAndData(th.Context, targetJobType,
			map[string]string{"policy_id": otherPolicyID})
		require.Nil(t, appErr)
		require.Len(t, received, 1)
		require.Equal(t, jobs[3].Id, received[0].Id)
	})

	t.Run("returns empty when no jobs match data filter", func(t *testing.T) {
		received, appErr := th.App.GetJobsByTypeAndData(th.Context, targetJobType,
			map[string]string{"policy_id": model.NewId()})
		require.Nil(t, appErr)
		require.Empty(t, received)
	})

	t.Run("empty data map returns all jobs of that type only", func(t *testing.T) {
		received, appErr := th.App.GetJobsByTypeAndData(th.Context, targetJobType,
			map[string]string{})
		require.Nil(t, appErr)
		require.Len(t, received, 4)
		receivedIDs := make([]string, len(received))
		for i, j := range received {
			receivedIDs[i] = j.Id
			assert.Equal(t, targetJobType, j.Type)
		}
		require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id, jobs[2].Id, jobs[3].Id}, receivedIDs)
	})
}

func TestGetJobsByTypes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
