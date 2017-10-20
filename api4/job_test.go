// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestCreateJob(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	job := &model.Job{
		Type: model.JOB_TYPE_DATA_RETENTION,
		Data: map[string]string{
			"thing": "stuff",
		},
	}

	received, resp := th.SystemAdminClient.CreateJob(job)
	CheckNoError(t, resp)

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
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	job := &model.Job{
		Id:     model.NewId(),
		Status: model.JOB_STATUS_PENDING,
	}
	if result := <-th.App.Srv.Store.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer th.App.Srv.Store.Job().Delete(job.Id)

	received, resp := th.SystemAdminClient.GetJob(job.Id)
	CheckNoError(t, resp)

	if received.Id != job.Id || received.Status != job.Status {
		t.Fatal("incorrect job received")
	}

	_, resp = th.SystemAdminClient.GetJob("1234")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJob(job.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJob(model.NewId())
	CheckNotFoundStatus(t, resp)
}

func TestGetJobs(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
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
		store.Must(th.App.Srv.Store.Job().Save(job))
		defer th.App.Srv.Store.Job().Delete(job.Id)
	}

	received, resp := th.SystemAdminClient.GetJobs(0, 2)
	CheckNoError(t, resp)

	if len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	received, resp = th.SystemAdminClient.GetJobs(1, 2)
	CheckNoError(t, resp)

	if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}

	_, resp = th.Client.GetJobs(0, 60)
	CheckForbiddenStatus(t, resp)
}

func TestGetJobsByType(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
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
		store.Must(th.App.Srv.Store.Job().Save(job))
		defer th.App.Srv.Store.Job().Delete(job.Id)
	}

	received, resp := th.SystemAdminClient.GetJobsByType(jobType, 0, 2)
	CheckNoError(t, resp)

	if len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	received, resp = th.SystemAdminClient.GetJobsByType(jobType, 1, 2)
	CheckNoError(t, resp)

	if len(received) != 1 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}

	_, resp = th.SystemAdminClient.GetJobsByType("", 0, 60)
	CheckNotFoundStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJobsByType(strings.Repeat("a", 33), 0, 60)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJobsByType(jobType, 0, 60)
	CheckForbiddenStatus(t, resp)
}

func TestCancelJob(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
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
		store.Must(th.App.Srv.Store.Job().Save(job))
		defer th.App.Srv.Store.Job().Delete(job.Id)
	}

	_, resp := th.Client.CancelJob(jobs[0].Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(jobs[0].Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(jobs[1].Id)
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(jobs[2].Id)
	CheckInternalErrorStatus(t, resp)

	_, resp = th.SystemAdminClient.CancelJob(model.NewId())
	CheckInternalErrorStatus(t, resp)
}
