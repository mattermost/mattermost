// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreateJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.LoginSystemManager(t)

	job := &model.Job{
		Type: model.JobTypeActiveUsers,
		Data: map[string]string{
			"thing": "stuff",
		},
	}

	t.Run("valid job as user without permissions", func(t *testing.T) {
		_, resp, err := th.SystemManagerClient.CreateJob(context.Background(), job)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("valid job as user with permissions", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.CreateJob(context.Background(), job)
		require.NoError(t, err)
		defer func() {
			result, appErr := th.App.Srv().Store().Job().Delete(received.Id)
			require.NoErrorf(t, appErr, "Failed to delete job (result: %v): %v", result, appErr)
		}()
	})

	t.Run("invalid job type as user without permissions", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.CreateJob(context.Background(), &model.Job{Type: model.NewId()})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	job := &model.Job{
		Id:     model.NewId(),
		Status: model.JobStatusPending,
		Type:   model.JobTypeMessageExport,
	}
	_, err := th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)

	defer func() {
		result, appErr := th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, appErr, "Failed to delete job (result: %v)", result)
	}()

	received, _, err := th.SystemAdminClient.GetJob(context.Background(), job.Id)
	require.NoError(t, err)

	require.Equal(t, job.Id, received.Id, "incorrect job received")
	require.Equal(t, job.Status, received.Status, "incorrect job received")

	_, resp, err := th.SystemAdminClient.GetJob(context.Background(), "1234")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetJob(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestGetJobs(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
		{
			Id:       model.NewId(),
			Type:     model.JobTypeLdapSync,
			CreateAt: t0 + 3,
			Status:   model.JobStatusPending,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)

		defer func(jobId string) {
			result, appErr := th.App.Srv().Store().Job().Delete(jobId)
			require.NoError(t, appErr, "Failed to delete job (result: %v)", result)
		}(job.Id)
	}

	t.Run("Get 2 jobs", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.GetJobs(context.Background(), "", "", 0, 2)
		require.NoError(t, err)

		require.Len(t, received, 2, "received wrong number of jobs")
		require.Equal(t, jobs[3].Id, received[0].Id, "should've received newest job first")
		require.Equal(t, jobs[2].Id, received[1].Id, "should've received second newest job second")
	})

	t.Run("Get oldest job using paging", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.GetJobs(context.Background(), "", "", 1, 3)
		require.NoError(t, err)
		require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")
	})

	t.Run("Return error fetching job without permissions", func(t *testing.T) {
		_, resp, err := th.Client.GetJobs(context.Background(), "", "", 0, 60)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Get job by type", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.GetJobs(context.Background(), model.JobTypeLdapSync, "", 0, 3)
		require.NoError(t, err)
		require.Len(t, received, 1, "received wrong number of jobs")
		require.Equal(t, jobs[3].Id, received[0].Id, "should've received the ldap sync job")
	})

	t.Run("Get job by status", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.GetJobs(context.Background(), "", model.JobStatusPending, 0, 3)
		require.NoError(t, err)
		require.Len(t, received, 1, "received wrong number of jobs")
		require.Equal(t, jobs[3].Id, received[0].Id, "should've received the ldap sync job")
	})

	t.Run("Get job by type and status", func(t *testing.T) {
		received, _, err := th.SystemAdminClient.GetJobs(context.Background(), model.JobTypeLdapSync, model.JobStatusPending, 0, 3)
		require.NoError(t, err)
		require.Len(t, received, 1, "received wrong number of jobs")
		require.Equal(t, jobs[3].Id, received[0].Id, "should've received the ldap sync job")
	})
}

func TestGetJobsByType(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	th.LoginSystemManager(t)

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

		defer func(jobId string) {
			result, appErr := th.App.Srv().Store().Job().Delete(jobId)
			require.NoError(t, appErr, "Failed to delete job (result: %v)", result)
		}(job.Id)
	}

	received, _, err := th.SystemAdminClient.GetJobsByType(context.Background(), jobType, 0, 2)
	require.NoError(t, err)

	require.Len(t, received, 2, "received wrong number of jobs")
	require.Equal(t, jobs[2].Id, received[0].Id, "should've received newest job first")
	require.Equal(t, jobs[0].Id, received[1].Id, "should've received second newest job second")

	received, _, err = th.SystemAdminClient.GetJobsByType(context.Background(), jobType, 1, 2)
	require.NoError(t, err)

	require.Len(t, received, 1, "received wrong number of jobs")
	require.Equal(t, jobs[1].Id, received[0].Id, "should've received oldest job last")

	_, resp, err := th.SystemAdminClient.GetJobsByType(context.Background(), "", 0, 60)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetJobsByType(context.Background(), strings.Repeat("a", 33), 0, 60)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = th.Client.GetJobsByType(context.Background(), jobType, 0, 60)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, _, err = th.SystemManagerClient.GetJobsByType(context.Background(), model.JobTypeElasticsearchPostIndexing, 0, 60)
	require.NoError(t, err)
}

func TestDownloadJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.LoginSystemManager(t)
	jobName := model.NewId()
	job := &model.Job{
		Id:   jobName,
		Type: model.JobTypeMessageExport,
		Data: map[string]string{
			"export_type": "csv",
		},
		Status: model.JobStatusSuccess,
	}

	// Save job first - the handler needs to fetch the job to determine its type
	_, err := th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)
	defer func() {
		_, delErr := th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, delErr, "Failed to delete job %s", job.Id)
	}()

	// DownloadExportResults is not set to true so we should get a not implemented error status
	_, resp, err := th.Client.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.DownloadExportResults = true
	})

	// Test with a non-existent job ID - should get 404
	nonExistentJobId := model.NewId()
	_, resp, err = th.Client.DownloadJob(context.Background(), nonExistentJobId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// System admin trying to download the results of a non-existent job
	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), nonExistentJobId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	filePath := filepath.Join(*th.App.Config().FileSettings.Directory, "export/"+job.Id+"/testdat.txt")
	err = os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, err)

	_, createErr := os.Create(filePath)
	require.NoError(t, createErr)

	// Normal user cannot download the results of these job (not the right permission)
	_, resp, err = th.Client.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	_, resp, err = th.SystemManagerClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	// System manager with default permissions cannot download the results of these job (Doesn't have correct permissions)
	_, resp, err = th.SystemManagerClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	job.Data["is_downloadable"] = "true"
	updateStatus, err := th.App.Srv().Store().Job().UpdateOptimistically(job, model.JobStatusSuccess)
	require.True(t, updateStatus)
	require.NoError(t, err)

	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Now we stub the results of the job into the same directory and try to download it again
	// This time we should successfully retrieve the results without any error
	filePath = filepath.Join(*th.App.Config().FileSettings.Directory, "export/"+job.Id+".zip")
	err = os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, err)

	_, createErr = os.Create(filePath)
	require.NoError(t, createErr)

	_, _, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
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
	defer func() {
		_, delErr := th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, delErr, "Failed to delete job %s", job.Id)
	}()

	// System admin shouldn't be able to download since the job type is not message export
	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Test the case where export_dir is not valid
	jobName = model.NewId()
	job = &model.Job{
		Id:   jobName,
		Type: model.JobTypeMessageExport,
		Data: map[string]string{
			"export_type":     "csv",
			"is_downloadable": "true",
			"export_dir":      "/bad/absolute/path",
		},
		Status: model.JobStatusSuccess,
	}
	_, err = th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)
	defer func() {
		_, delErr := th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, delErr, "Failed to delete job %s", job.Id)
	}()

	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	require.EqualError(t, err, "Unable to download this job")
	CheckNotFoundStatus(t, resp)
}

func TestDownloadWikiExportJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	jobName := model.NewId()
	job := &model.Job{
		Id:     jobName,
		Type:   model.JobTypeWikiExport,
		Status: model.JobStatusSuccess,
		Data:   map[string]string{},
	}

	_, err := th.App.Srv().Store().Job().Save(job)
	require.NoError(t, err)
	defer func() {
		_, delErr := th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, delErr, "Failed to delete job %s", job.Id)
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.DownloadExportResults = true
	})

	// Normal user cannot download wiki export (no permission)
	_, resp, err := th.Client.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// System admin without is_downloadable flag should get bad request
	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Set is_downloadable but missing export_dir/export_file
	job.Data[model.WikiJobDataKeyIsDownloadable] = "true"
	updateStatus, err := th.App.Srv().Store().Job().UpdateOptimistically(job, model.JobStatusSuccess)
	require.True(t, updateStatus)
	require.NoError(t, err)

	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Set export_dir and export_file but file doesn't exist
	exportDir := "export"
	exportFile := job.Id + model.WikiExportFileSuffix
	job.Data[model.WikiJobDataKeyExportDir] = exportDir
	job.Data[model.WikiJobDataKeyExportFile] = exportFile
	updateStatus, err = th.App.Srv().Store().Job().UpdateOptimistically(job, model.JobStatusSuccess)
	require.True(t, updateStatus)
	require.NoError(t, err)

	_, resp, err = th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	// Create the actual export file
	filePath := filepath.Join(*th.App.Config().FileSettings.Directory, exportDir, exportFile)
	err = os.MkdirAll(filepath.Dir(filePath), 0770)
	require.NoError(t, err)

	testContent := `{"type":"version","version":{"version":1}}` + "\n"
	err = os.WriteFile(filePath, []byte(testContent), 0600)
	require.NoError(t, err)
	defer os.Remove(filePath)

	// System admin should now be able to download
	data, resp, err := th.SystemAdminClient.DownloadJob(context.Background(), job.Id)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Equal(t, testContent, string(data))

	// Verify content-type header is set correctly for JSONL
	require.Contains(t, resp.Header.Get("Content-Type"), "application/x-ndjson")
}

func TestCancelJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

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
		defer func(jobId string) {
			_, delErr := th.App.Srv().Store().Job().Delete(jobId)
			require.NoError(t, delErr, "Failed to delete job %s", jobId)
		}(job.Id)
	}
	resp, err := th.Client.CancelJob(context.Background(), jobs[0].Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.SystemAdminClient.CancelJob(context.Background(), jobs[0].Id)
	require.NoError(t, err)

	_, err = th.SystemAdminClient.CancelJob(context.Background(), jobs[1].Id)
	require.NoError(t, err)

	resp, err = th.SystemAdminClient.CancelJob(context.Background(), jobs[2].Id)
	require.Error(t, err)
	CheckInternalErrorStatus(t, resp)

	resp, err = th.SystemAdminClient.CancelJob(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestUpdateJobStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	jobType := model.JobTypeDataRetention
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
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusPending,
		},
	}

	for _, job := range jobs {
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		defer func(jobID string) {
			_, delErr := th.App.Srv().Store().Job().Delete(jobID)
			require.NoError(t, delErr, "Failed to delete job %s", jobID)
		}(job.Id)
	}

	t.Run("Fail to update job status without permission", func(t *testing.T) {
		resp, err := th.Client.UpdateJobStatus(context.Background(), jobs[0].Id, model.JobStatusCancelRequested, false)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Change a pending job to cancel requested without force with sysadmin client", func(t *testing.T) {
		_, err := th.SystemAdminClient.UpdateJobStatus(context.Background(), jobs[0].Id, model.JobStatusCancelRequested, false)
		require.NoError(t, err)
	})

	t.Run("Change a pending job to cancel requested without force with local client", func(t *testing.T) {
		_, err := th.LocalClient.UpdateJobStatus(context.Background(), jobs[3].Id, model.JobStatusCancelRequested, false)
		require.NoError(t, err)
	})

	t.Run("Fail to change a pending job to canceled without force", func(t *testing.T) {
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			resp, err := client.UpdateJobStatus(context.Background(), jobs[0].Id, model.JobStatusCanceled, false)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("Change a pending job to canceled with force", func(t *testing.T) {
		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			_, err := client.UpdateJobStatus(context.Background(), jobs[0].Id, model.JobStatusCanceled, true)
			require.NoError(t, err)
		})
	})
}
