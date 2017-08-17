// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
	"time"
)

func TestJobSaveGet(t *testing.T) {
	Setup()

	job := &model.Job{
		Id:     model.NewId(),
		Type:   model.NewId(),
		Status: model.NewId(),
		Data:   map[string]string{
			"Processed":     "0",
			"Total":         "12345",
			"LastProcessed": "abcd",
		},
	}

	if result := <-store.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-store.Job().Delete(job.Id)
	}()

	if result := <-store.Job().Get(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.Job); received.Id != job.Id {
		t.Fatal("received incorrect job after save")
	} else if received.Data["Total"] != "12345" {
		t.Fatal("data field was not retrieved successfully:", received.Data)
	}
}

func TestJobGetAllByType(t *testing.T) {
	Setup()

	jobType := model.NewId()

	jobs := []*model.Job{
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

	for _, job := range jobs {
		Must(store.Job().Save(job))
		defer store.Job().Delete(job.Id)
	}

	if result := <-store.Job().GetAllByType(jobType); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[0].Id && received[1].Id != jobs[0].Id {
		t.Fatal("should've received first jobs")
	} else if received[0].Id != jobs[1].Id && received[1].Id != jobs[1].Id {
		t.Fatal("should've received second jobs")
	}
}

func TestJobGetAllByTypePage(t *testing.T) {
	Setup()

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
		Must(store.Job().Save(job))
		defer store.Job().Delete(job.Id)
	}

	if result := <-store.Job().GetAllByTypePage(jobType, 0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if result := <-store.Job().GetAllByTypePage(jobType, 2, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 1 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}
}

func TestJobGetAllPage(t *testing.T) {
	Setup()

	jobType := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: model.GetMillis() + 1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: model.GetMillis(),
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: model.GetMillis() + 2,
		},
	}

	for _, job := range jobs {
		Must(store.Job().Save(job))
		defer store.Job().Delete(job.Id)
	}

	if result := <-store.Job().GetAllPage(0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if result := <-store.Job().GetAllPage(2, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) < 1 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}
}

func TestJobGetAllByStatus(t *testing.T) {
	jobType := model.NewId()
	status := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1000,
			Status:   status,
			Data:     map[string]string{
				"test": "data",
			},
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 999,
			Status:   status,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1001,
			Status:   status,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1002,
			Status:   model.NewId(),
		},
	}

	for _, job := range jobs {
		Must(store.Job().Save(job))
		defer store.Job().Delete(job.Id)
	}

	if result := <-store.Job().GetAllByStatus(status); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 3 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id || received[1].Id != jobs[0].Id || received[2].Id != jobs[2].Id {
		t.Fatal("should've received jobs ordered by CreateAt time")
	} else if received[1].Data["test"] != "data" {
		t.Fatal("should've received job data field back as saved")
	}
}

func TestJobUpdateOptimistically(t *testing.T) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JOB_TYPE_DATA_RETENTION,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_PENDING,
	}

	if result := <-store.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	}
	defer store.Job().Delete(job.Id)

	job.LastActivityAt = model.GetMillis()
	job.Status = model.JOB_STATUS_IN_PROGRESS
	job.Progress = 50
	job.Data = map[string]string{
		"Foo": "Bar",
	}

	if result := <-store.Job().UpdateOptimistically(job, model.JOB_STATUS_SUCCESS); result.Err != nil {
		if result.Data.(bool) {
			t.Fatal("should have failed due to incorrect old status")
		}
	}

	time.Sleep(2 * time.Millisecond)

	if result := <-store.Job().UpdateOptimistically(job, model.JOB_STATUS_PENDING); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("Should have successfully updated")
		}

		var updatedJob *model.Job

		if result := <-store.Job().Get(job.Id); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			updatedJob = result.Data.(*model.Job)
		}

		if updatedJob.Type != job.Type || updatedJob.CreateAt != job.CreateAt || updatedJob.Status != job.Status || updatedJob.LastActivityAt <= job.LastActivityAt || updatedJob.Progress != job.Progress || updatedJob.Data["Foo"] != job.Data["Foo"] {
			t.Fatal("Some update property was not as expected")
		}
	}

}

func TestJobUpdateStatusUpdateStatusOptimistically(t *testing.T) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JOB_TYPE_DATA_RETENTION,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_SUCCESS,
	}

	var lastUpdateAt int64
	if result := <-store.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		lastUpdateAt = result.Data.(*model.Job).LastActivityAt
	}

	defer store.Job().Delete(job.Id)

	time.Sleep(2 * time.Millisecond)

	if result := <-store.Job().UpdateStatus(job.Id, model.JOB_STATUS_PENDING); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.Job)
		if received.Status != model.JOB_STATUS_PENDING {
			t.Fatal("status wasn't updated")
		}
		if received.LastActivityAt <= lastUpdateAt {
			t.Fatal("lastActivityAt wasn't updated")
		}
		lastUpdateAt = received.LastActivityAt
	}

	time.Sleep(2 * time.Millisecond)

	if result := <-store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_SUCCESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(bool) {
			t.Fatal("should be false due to incorrect original status")
		}
	}

	if result := <-store.Job().Get(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.Job)
		if received.Status != model.JOB_STATUS_PENDING {
			t.Fatal("should still be pending")
		}
		if received.LastActivityAt != lastUpdateAt {
			t.Fatal("last activity at shouldn't have changed")
		}
	}

	time.Sleep(2 * time.Millisecond)

	if result := <-store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("should have succeeded")
		}
	}

	var startAtSet int64
	if result := <-store.Job().Get(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.Job)
		if received.Status != model.JOB_STATUS_IN_PROGRESS {
			t.Fatal("should be in progress")
		}
		if received.StartAt == 0 {
			t.Fatal("received should have start at set")
		}
		if received.LastActivityAt <= lastUpdateAt {
			t.Fatal("lastActivityAt wasn't updated")
		}
		lastUpdateAt = received.LastActivityAt
		startAtSet = received.StartAt
	}

	time.Sleep(2 * time.Millisecond)

	if result := <-store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_SUCCESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("should have succeeded")
		}
	}

	if result := <-store.Job().Get(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.Job)
		if received.Status != model.JOB_STATUS_SUCCESS {
			t.Fatal("should be success status")
		}
		if received.StartAt != startAtSet {
			t.Fatal("startAt should not have changed")
		}
		if received.LastActivityAt <= lastUpdateAt {
			t.Fatal("lastActivityAt wasn't updated")
		}
		lastUpdateAt = received.LastActivityAt
	}
}

func TestJobDelete(t *testing.T) {
	Setup()

	job := Must(store.Job().Save(&model.Job{
		Id: model.NewId(),
	})).(*model.Job)

	if result := <-store.Job().Delete(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	}
}
