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
