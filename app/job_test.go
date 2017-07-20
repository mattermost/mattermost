// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
)

func TestGetJob(t *testing.T) {
	Setup()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}
	if result := <-Srv.Store.Job().Save(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer Srv.Store.Job().Delete(status.Id)

	if received, err := GetJob(status.Id); err != nil {
		t.Fatal(err)
	} else if received.Id != status.Id || received.Status != status.Status {
		t.Fatal("inccorrect job status received")
	}
}

func TestGetJobByType(t *testing.T) {
	Setup()

	jobType := model.NewId()

	statuses := []*model.Job{
		{
			Id:      model.NewId(),
			Type:    jobType,
			CreateAt: 1000,
		},
		{
			Id:      model.NewId(),
			Type:    jobType,
			CreateAt: 999,
		},
		{
			Id:      model.NewId(),
			Type:    jobType,
			CreateAt: 1001,
		},
	}

	for _, status := range statuses {
		store.Must(Srv.Store.Job().Save(status))
		defer Srv.Store.Job().Delete(status.Id)
	}

	if received, err := GetJobsByType(jobType, 0, 2); err != nil {
		t.Fatal(err)
	} else if len(received) != 2 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != statuses[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if received, err := GetJobsByType(jobType, 2, 2); err != nil {
		t.Fatal(err)
	} else if len(received) != 1 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[1].Id {
		t.Fatal("should've received oldest job last")
	}
}
