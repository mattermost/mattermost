// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
)

func TestGetJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}
	_, err := th.App.Srv().Store().Job().Save(status)
	require.NoError(t, err)

	defer th.App.Srv().Store().Job().Delete(status.Id)

	received, appErr := th.App.GetJob(status.Id)
	require.Nil(t, appErr)
	require.Equal(t, status, received, "incorrect job status received")
}

func TestSessionHasPermissionToCreateJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobs := []model.Job{
		{
			Id:       model.NewId(),
			Type:     model.JobTypeBlevePostIndexing,
			CreateAt: 1000,
		},
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
			PermissionRequired: model.PermissionCreatePostBleveIndexesJob,
		},
		{
			Job:                jobs[1],
			PermissionRequired: model.PermissionCreateDataRetentionJob,
		},
		{
			Job:                jobs[2],
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

	role.Permissions = append(role.Permissions, model.PermissionCreatePostBleveIndexesJob.Id)

	_, err := th.App.UpdateRole(role)
	require.Nil(t, err)

	// Now system read only admin should have ability to create a Belve Post Index job but not the others
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(session, &testCase.Job)
		expectedHasPermission := testCase.Job.Type == model.JobTypeBlevePostIndexing
		assert.Equal(t, expectedHasPermission, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}

	role.Permissions = append(role.Permissions, model.PermissionCreateDataRetentionJob.Id)
	role.Permissions = append(role.Permissions, model.PermissionCreateComplianceExportJob.Id)

	_, err = th.App.UpdateRole(role)
	require.Nil(t, err)

	// Now system read only admin should have ability to create all jobs
	for _, testCase := range testCases {
		hasPermission, permissionRequired := th.App.SessionHasPermissionToCreateJob(session, &testCase.Job)
		assert.Equal(t, true, hasPermission)
		require.NotNil(t, permissionRequired)
		assert.Equal(t, testCase.PermissionRequired.Id, permissionRequired.Id)
	}
}

func TestSessionHasPermissionToReadJob(t *testing.T) {
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
		defer th.App.Srv().Store().Job().Delete(status.Id)
	}

	received, err := th.App.GetJobsByType(jobType, 0, 2)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of statuses")
	require.Equal(t, statuses[2], received[0], "should've received newest job first")
	require.Equal(t, statuses[0], received[1], "should've received second newest job second")

	received, err = th.App.GetJobsByType(jobType, 2, 2)
	require.Nil(t, err)
	require.Len(t, received, 1, "received wrong number of statuses")
	require.Equal(t, statuses[1], received[0], "should've received oldest job last")
}

func TestGetJobsByTypes(t *testing.T) {
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
		defer th.App.Srv().Store().Job().Delete(status.Id)
	}

	jobTypes := []string{jobType, jobType1, jobType2}
	received, err := th.App.GetJobsByTypes(jobTypes, 0, 2)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, statuses[2], received[0], "should've received newest job first")
	require.Equal(t, statuses[0], received[1], "should've received second newest job second")

	received, err = th.App.GetJobsByTypes(jobTypes, 2, 2)
	require.Nil(t, err)
	require.Len(t, received, 1, "received wrong number of jobs")
	require.Equal(t, statuses[1], received[0], "should've received oldest job last")

	jobTypes = []string{jobType1, jobType2}
	received, err = th.App.GetJobsByTypes(jobTypes, 0, 3)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, statuses[2], received[0], "received wrong job type")
	require.Equal(t, statuses[1], received[1], "received wrong job type")
}
