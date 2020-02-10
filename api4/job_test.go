// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestCreateJob(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	job := &model.Job{
		Type: model.JOB_TYPE_DATA_RETENTION,
		Data: map[string]string{
			"thing": "stuff",
		},
	}

	received, resp := th.SystemAdminClient.CreateJob(job)
	require.Nil(t, resp.Error)

	defer th.App.Srv.Store.Job().Delete(received.Id)

	job = &model.Job{
		Type: model.NewId(),
	}

	_, resp = th.SystemAdminClient.CreateJob(job)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.CreateJob(job)
	CheckForbiddenStatus(t, resp)
}

func TestGetJob(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	job := &model.Job{
		Id:     model.NewId(),
		Status: model.JOB_STATUS_PENDING,
	}
	_, err := th.App.Srv.Store.Job().Save(job)
	require.Nil(t, err)

	defer th.App.Srv.Store.Job().Delete(job.Id)

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
	th := Setup(t).InitBasic()
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
		_, err := th.App.Srv.Store.Job().Save(job)
		require.Nil(t, err)
		defer th.App.Srv.Store.Job().Delete(job.Id)
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
	th := Setup(t).InitBasic()
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
		_, err := th.App.Srv.Store.Job().Save(job)
		require.Nil(t, err)
		defer th.App.Srv.Store.Job().Delete(job.Id)
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
}

func TestCancelJob(t *testing.T) {
	th := Setup(t).InitBasic()
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
		_, err := th.App.Srv.Store.Job().Save(job)
		require.Nil(t, err)
		defer th.App.Srv.Store.Job().Delete(job.Id)
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
