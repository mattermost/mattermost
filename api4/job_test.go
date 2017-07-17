// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestGetJobStatus(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}
	if result := <-app.Srv.Store.Job().Save(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer app.Srv.Store.Job().Delete(status.Id)

	received, resp := th.SystemAdminClient.GetJob(status.Id)
	CheckNoError(t, resp)

	if received.Id != status.Id || received.Status != status.Status {
		t.Fatal("incorrect job status received")
	}

	_, resp = th.SystemAdminClient.GetJob("1234")
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJob(status.Id)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJob(model.NewId())
	CheckNotFoundStatus(t, resp)
}

func TestGetJobStatusesByType(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()

	jobType := model.NewId()

	statuses := []*model.Job{
		{
			Id:      model.NewId(),
			Type:    jobType,
			StartAt: 1000,
		},
		{
			Id:      model.NewId(),
			Type:    jobType,
			StartAt: 999,
		},
		{
			Id:      model.NewId(),
			Type:    jobType,
			StartAt: 1001,
		},
	}

	for _, status := range statuses {
		store.Must(app.Srv.Store.Job().Save(status))
		defer app.Srv.Store.Job().Delete(status.Id)
	}

	received, resp := th.SystemAdminClient.GetJobsByType(jobType, 0, 2)
	CheckNoError(t, resp)

	if len(received) != 2 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[1].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != statuses[0].Id {
		t.Fatal("should've received second newest job second")
	}

	received, resp = th.SystemAdminClient.GetJobsByType(jobType, 1, 2)
	CheckNoError(t, resp)

	if len(received) != 1 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[2].Id {
		t.Fatal("should've received oldest job last")
	}

	_, resp = th.SystemAdminClient.GetJobsByType("", 0, 60)
	CheckNotFoundStatus(t, resp)

	_, resp = th.SystemAdminClient.GetJobsByType(strings.Repeat("a", 33), 0, 60)
	CheckBadRequestStatus(t, resp)

	_, resp = th.Client.GetJobsByType(jobType, 0, 60)
	CheckForbiddenStatus(t, resp)
}
