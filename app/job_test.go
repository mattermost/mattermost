// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestGetJob(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}
	if result := <-th.App.Srv.Store.Job().Save(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer th.App.Srv.Store.Job().Delete(status.Id)

	if received, err := th.App.GetJob(status.Id); err != nil {
		t.Fatal(err)
	} else if received.Id != status.Id || received.Status != status.Status {
		t.Fatal("inccorrect job status received")
	}
}

func TestGetJobByType(t *testing.T) {
	th := Setup()
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
		store.Must(th.App.Srv.Store.Job().Save(status))
		defer th.App.Srv.Store.Job().Delete(status.Id)
	}

	if received, err := th.App.GetJobsByType(jobType, 0, 2); err != nil {
		t.Fatal(err)
	} else if len(received) != 2 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != statuses[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if received, err := th.App.GetJobsByType(jobType, 2, 2); err != nil {
		t.Fatal(err)
	} else if len(received) != 1 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[1].Id {
		t.Fatal("should've received oldest job last")
	}
}
