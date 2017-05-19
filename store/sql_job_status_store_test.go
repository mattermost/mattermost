// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestJobStatusSaveGetUpdate(t *testing.T) {
	Setup()

	status := &model.JobStatus{
		Id:     model.NewId(),
		Type:   model.NewId(),
		Status: model.NewId(),
		Data: map[string]interface{}{
			"Processed":     0,
			"Total":         12345,
			"LastProcessed": "abcd",
		},
	}

	if result := <-store.JobStatus().SaveOrUpdate(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-store.JobStatus().Delete(status.Id)
	}()

	if result := <-store.JobStatus().Get(status.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.JobStatus); received.Id != status.Id {
		t.Fatal("received incorrect status after save")
	}

	status.Status = model.NewId()
	status.Data = map[string]interface{}{
		"Processed":     12345,
		"Total":         12345,
		"LastProcessed": "abcd",
	}

	if result := <-store.JobStatus().SaveOrUpdate(status); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.JobStatus().Get(status.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.JobStatus); received.Id != status.Id || received.Status != status.Status {
		t.Fatal("received incorrect status after update")
	}
}

func TestJobStatusGetAllByType(t *testing.T) {
	Setup()

	jobType := model.NewId()

	statuses := []*model.JobStatus{
		{
			Id:   model.NewId(),
			Type: jobType,
		},
		{
			Id:   model.NewId(),
			Type: jobType,
		},
		{
			Id:   model.NewId(),
			Type: model.NewId(),
		},
	}

	for _, status := range statuses {
		Must(store.JobStatus().SaveOrUpdate(status))
		defer store.JobStatus().Delete(status.Id)
	}

	if result := <-store.JobStatus().GetAllByType(jobType); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.JobStatus); len(received) != 2 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[0].Id && received[1].Id != statuses[0].Id {
		t.Fatal("should've received first status")
	} else if received[0].Id != statuses[1].Id && received[1].Id != statuses[1].Id {
		t.Fatal("should've received second status")
	}
}

func TestJobStatusGetAllByTypePage(t *testing.T) {
	Setup()

	jobType := model.NewId()

	statuses := []*model.JobStatus{
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
		Must(store.JobStatus().SaveOrUpdate(status))
		defer store.JobStatus().Delete(status.Id)
	}

	if result := <-store.JobStatus().GetAllByTypePage(jobType, 0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.JobStatus); len(received) != 2 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[1].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != statuses[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if result := <-store.JobStatus().GetAllByTypePage(jobType, 2, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.JobStatus); len(received) != 1 {
		t.Fatal("received wrong number of statuses")
	} else if received[0].Id != statuses[2].Id {
		t.Fatal("should've received oldest job last")
	}
}

func TestJobStatusDelete(t *testing.T) {
	Setup()

	status := Must(store.JobStatus().SaveOrUpdate(&model.JobStatus{
		Id: model.NewId(),
	})).(*model.JobStatus)

	if result := <-store.JobStatus().Delete(status.Id); result.Err != nil {
		t.Fatal(result.Err)
	}
}
