// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCreateJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	job := &model.Job{
		Type: model.JOB_TYPE_MESSAGE_EXPORT,
		Data: map[string]string{
			"thing": "stuff",
		},
	}

	_, resp := th.SystemManagerClient.CreateJob(job)
	require.Nil(t, resp.Error)

	received, resp := th.SystemAdminClient.CreateJob(job)
	require.Nil(t, resp.Error)

	defer th.App.Srv().Store.Job().Delete(received.Id)

	job = &model.Job{
		Type: model.NewId(),
	}

	_, resp = th.SystemAdminClient.CreateJob(job)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.CreateJob(job)
	CheckForbiddenStatus(t, resp)
}

func TestGetJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	job := &model.Job{
		Id:     model.NewId(),
		Status: model.JOB_STATUS_PENDING,
	}
	_, err := th.App.Srv().Store.Job().Save(job)
	require.NoError(t, err)

	defer th.App.Srv().Store.Job().Delete(job.Id)

	received, resp := th.SystemAdminClient.GetJob(job.Id)
	require.Nil(t, resp.Error)

	require.Equal(t, job.Id, received.Id, "incorrect job received")
	require.Equal(t, job.Status, received.Status, "incorrect job received")

	_, resp = th.SystemAdminClient.GetJob("1234")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJob(job.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJob(model.NewId())
	CheckNotFoundStatus(t, resp)
}

func TestGetJobs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobType := model.NewId()

	t0 := model.GetMillis()
	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: t0 + 1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: t0,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: t0 + 2,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store.Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store.Job().Delete(job.Id)
	}

	received, resp := th.SystemAdminClient.GetJobs(0, 2)
	require.Nil(t, resp.Error)

	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, jobs[2].Id, received[0].Id, "should've received newest job first")
	require.Equal(t, jobs[0].Id, received[1].Id, "should've received second newest job second")

	received, resp = th.SystemAdminClient.GetJobs(1, 2)
	require.Nil(t, resp.Error)

	require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")

	_, resp = th.Client.GetJobs(0, 60)
	CheckForbiddenStatus(t, resp)
}

func TestGetJobsByType(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobType := model.NewId()

	jobs := []*model.Job{
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
		{
			Id:       model.NewId(),
			Type:     model.NewId(),
			CreateAt: 1002,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store.Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store.Job().Delete(job.Id)
	}

	received, resp := th.SystemAdminClient.GetJobsByType(jobType, 0, 2)
	require.Nil(t, resp.Error)

	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, jobs[2].Id, received[0].Id, "should've received newest job first")
	require.Equal(t, jobs[0].Id, received[1].Id, "should've received second newest job second")

	received, resp = th.SystemAdminClient.GetJobsByType(jobType, 1, 2)
	require.Nil(t, resp.Error)

	require.Len(t, received, 1, "received wrong number of jobs")
	require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")

	_, resp = th.SystemAdminClient.GetJobsByType("", 0, 60)
	CheckNotFoundStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJobsByType(strings.Repeat("a", 33), 0, 60)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJobsByType(jobType, 0, 60)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemManagerClient.GetJobsByType(model.JOB_TYPE_MESSAGE_EXPORT, 0, 60)
	require.Nil(t, resp.Error)
}

func TestDownloadJob(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	jobName := model.NewId()
	job := &model.Job{
		Id:   jobName,
		Type: model.JOB_TYPE_MESSAGE_EXPORT,
		Data: map[string]string{
			"export_type": "csv",
		},
		Status: model.JOB_STATUS_SUCCESS,
	}

	// DownloadExportResults is not set to true so we should get a not implemented error status
	_, resp := th.Client.DownloadJob(job.Id)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.DownloadExportResults = true
	})

	// Normal user cannot download the results of these job (non-existent job)
	_, resp = th.Client.DownloadJob(job.Id)
	CheckNotFoundStatus(t, resp)

	// System admin trying to download the results of a non-existent job
	_, resp = th.SystemAdminClient.DownloadJob(job.Id)
	CheckNotFoundStatus(t, resp)

	// Here we have a job that exist in our database but the results do not exist therefore when we try to download the results
	// as a system admin, we should get a not found status.
	_, err := th.App.Srv().Store.Job().Save(job)
	require.NoError(t, err)
	defer th.App.Srv().Store.Job().Delete(job.Id)

	filePath := "./data/export/" + job.Id + "/testdat.txt"
	mkdirAllErr := os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, mkdirAllErr)
	os.Create(filePath)

	// Normal user cannot download the results of these job (not the right permission)
	_, resp = th.Client.DownloadJob(job.Id)
	CheckForbiddenStatus(t, resp)

	// System manager with default permissions cannot download the results of these job (Doesn't have correct permissions)
	_, resp = th.SystemManagerClient.DownloadJob(job.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.DownloadJob(job.Id)
	CheckBadRequestStatus(t, resp)

	job.Data["is_downloadable"] = "true"
	updateStatus, err := th.App.Srv().Store.Job().UpdateOptimistically(job, model.JOB_STATUS_SUCCESS)
	require.True(t, updateStatus)
	require.NoError(t, err)

	_, resp = th.SystemAdminClient.DownloadJob(job.Id)
	CheckNotFoundStatus(t, resp)

	// Now we stub the results of the job into the same directory and try to download it again
	// This time we should successfully retrieve the results without any error
	filePath = "./data/export/" + job.Id + ".zip"
	mkdirAllErr = os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, mkdirAllErr)
	os.Create(filePath)

	_, resp = th.SystemAdminClient.DownloadJob(job.Id)
	require.Nil(t, resp.Error)

	// Here we are creating a new job which doesn't have type of message export
	jobName = model.NewId()
	job = &model.Job{
		Id:   jobName,
		Type: model.JOB_TYPE_CLOUD,
		Data: map[string]string{
			"export_type": "csv",
		},
		Status: model.JOB_STATUS_SUCCESS,
	}
	_, err = th.App.Srv().Store.Job().Save(job)
	require.NoError(t, err)
	defer th.App.Srv().Store.Job().Delete(job.Id)

	// System admin shouldn't be able to download since the job type is not message export
	_, resp = th.SystemAdminClient.DownloadJob(job.Id)
	CheckBadRequestStatus(t, resp)
}

func TestCancelJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobs := []*model.Job{
		{
			Id:     model.NewId(),
			Type:   model.NewId(),
			Status: model.JOB_STATUS_PENDING,
		},
		{
			Id:     model.NewId(),
			Type:   model.NewId(),
			Status: model.JOB_STATUS_IN_PROGRESS,
		},
		{
			Id:     model.NewId(),
			Type:   model.NewId(),
			Status: model.JOB_STATUS_SUCCESS,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store.Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store.Job().Delete(job.Id)
	}

	_, resp := th.Client.CancelJob(jobs[0].Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(jobs[0].Id)
	require.Nil(t, resp.Error)

	_, resp = th.SystemAdminClient.CancelJob(jobs[1].Id)
	require.Nil(t, resp.Error)

	_, resp = th.SystemAdminClient.CancelJob(jobs[2].Id)
	CheckInternalErrorStatus(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(model.NewId())
	CheckInternalErrorStatus(t, resp)
}
