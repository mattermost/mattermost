// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
)

func TestCreateJob(t *testing.T) {
	th := Setup(t)
	th.LoginSystemManager()
	defer th.TearDown()

	job := &model.Job{
		Type: model.JobTypeActiveUsers,
		Data: map[string]string{
			"thing": "stuff",
		},
	}

	t.Run("valid job as user without permissions", func(t *testing.T) {
		_, resp, err := th.SystemManagerClient.CreateJob(job)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("valid job as user with permissions", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.CreateJob(job)
		require.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(received.Id)
	})

	t.Run("invalid job type as user without permissions", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.CreateJob(&model.Job{Type: model.NewId()})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	job := &model.Job{
		Id:     model.NewId(),
		Status: model.JobStatusPending,
		Type:   model.JobTypeMessageExport,
	}
	_, err := th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)

	defer th.App.Srv().Store().Job().Delete(job.Id)

	received, _, err := th.SystemAdminClient.GetJob(job.Id)
	require.NoError(t, err)

	require.Equal(t, job.Id, received.Id, "incorrect job received")
	require.Equal(t, job.Status, received.Status, "incorrect job received")

	_, resp, err := th.SystemAdminClient.GetJob("1234")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetJob(job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetJob(model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestGetJobs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobType := model.JobTypeDataRetention

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
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(job.Id)
	}

	received, _, err := th.SystemAdminClient.GetJobs(0, 2)
	require.NoError(t, err)

	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, jobs[2].Id, received[0].Id, "should've received newest job first")
	require.Equal(t, jobs[0].Id, received[1].Id, "should've received second newest job second")

	received, _, err = th.SystemAdminClient.GetJobs(1, 2)
	require.NoError(t, err)

	require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")

	_, resp, err := th.Client.GetJobs(0, 60)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetJobsByType(t *testing.T) {
	th := Setup(t)
	th.LoginSystemManager()
	defer th.TearDown()

	jobType := model.JobTypeDataRetention

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
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(job.Id)
	}

	received, _, err := th.SystemAdminClient.GetJobsByType(jobType, 0, 2)
	require.NoError(t, err)

	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, jobs[2].Id, received[0].Id, "should've received newest job first")
	require.Equal(t, jobs[0].Id, received[1].Id, "should've received second newest job second")

	received, _, err = th.SystemAdminClient.GetJobsByType(jobType, 1, 2)
	require.NoError(t, err)

	require.Len(t, received, 1, "received wrong number of jobs")
	require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")

	_, resp, err := th.SystemAdminClient.GetJobsByType("", 0, 60)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetJobsByType(strings.Repeat("a", 33), 0, 60)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetJobsByType(jobType, 0, 60)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemManagerClient.GetJobsByType(model.JobTypeElasticsearchPostIndexing, 0, 60)
	require.NoError(t, err)
}

func TestDownloadJob(t *testing.T) {
	th := Setup(t).InitBasic()
	th.LoginSystemManager()
	defer th.TearDown()
	jobName := model.NewId()
	job := &model.Job{
		Id:   jobName,
		Type: model.JobTypeMessageExport,
		Data: map[string]string{
			"export_type": "csv",
		},
		Status: model.JobStatusSuccess,
	}

	// DownloadExportResults is not set to true so we should get a not implemented error status
	_, resp, err := th.Client.DownloadJob(job.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.DownloadExportResults = true
	})

	// Normal user cannot download the results of these job (non-existent job)
	_, resp, err = th.Client.DownloadJob(job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// System admin trying to download the results of a non-existent job
	_, resp, err = th.SystemAdminClient.DownloadJob(job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Here we have a job that exist in our database but the results do not exist therefore when we try to download the results
	// as a system admin, we should get a not found status.
	_, err = th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(job.Id)

	filePath := "./data/export/" + job.Id + "/testdat.txt"
	mkdirAllErr := os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, mkdirAllErr)
	os.Create(filePath)

	// Normal user cannot download the results of these job (not the right permission)
	_, resp, err = th.Client.DownloadJob(job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	th.SystemManagerClient.DownloadJob(job.Id)
	// System manager with default permissions cannot download the results of these job (Doesn't have correct permissions)
	_, resp, err = th.SystemManagerClient.DownloadJob(job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.SystemAdminClient.DownloadJob(job.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	job.Data["is_downloadable"] = "true"
	updateStatus, err := th.App.Srv().Store().Job().UpdateOptimistically(job, model.JobStatusSuccess)
	require.True(t, updateStatus)
	require.NoError(t, err)

	_, resp, err = th.SystemAdminClient.DownloadJob(job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Now we stub the results of the job into the same directory and try to download it again
	// This time we should successfully retrieve the results without any error
	filePath = "./data/export/" + job.Id + ".zip"
	mkdirAllErr = os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, mkdirAllErr)
	os.Create(filePath)

	_, _, err = th.SystemAdminClient.DownloadJob(job.Id)
	require.NoError(t, err)

	// Here we are creating a new job which doesn't have type of message export
	jobName = model.NewId()
	job = &model.Job{
		Id:   jobName,
		Type: model.JobTypeCloud,
		Data: map[string]string{
			"export_type": "csv",
		},
		Status: model.JobStatusSuccess,
	}
	_, err = th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(job.Id)

	// System admin shouldn't be able to download since the job type is not message export
	_, resp, err = th.SystemAdminClient.DownloadJob(job.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestCancelJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobType := model.JobTypeMessageExport
	jobs := []*model.Job{
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusPending,
		},
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusInProgress,
		},
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusSuccess,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		defer th.App.Srv().Store().Job().Delete(job.Id)
	}

	resp, err := th.Client.CancelJob(jobs[0].Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.SystemAdminClient.CancelJob(jobs[0].Id)
	require.NoError(t, err)

	_, err = th.SystemAdminClient.CancelJob(jobs[1].Id)
	require.NoError(t, err)

	resp, err = th.SystemAdminClient.CancelJob(jobs[2].Id)
	require.Error(t, err)
	CheckInternalErrorStatus(t, resp)

	resp, err = th.SystemAdminClient.CancelJob(model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}
