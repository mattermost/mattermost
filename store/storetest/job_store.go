// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestJobStore(t *testing.T, ss store.Store) {
	t.Run("JobSaveGet", func(t *testing.T) { testJobSaveGet(t, ss) })
	t.Run("JobGetAllByType", func(t *testing.T) { testJobGetAllByType(t, ss) })
	t.Run("JobGetAllByTypePage", func(t *testing.T) { testJobGetAllByTypePage(t, ss) })
	t.Run("JobGetAllPage", func(t *testing.T) { testJobGetAllPage(t, ss) })
	t.Run("JobGetAllByStatus", func(t *testing.T) { testJobGetAllByStatus(t, ss) })
	t.Run("GetNewestJobByStatusAndType", func(t *testing.T) { testJobStoreGetNewestJobByStatusAndType(t, ss) })
	t.Run("GetCountByStatusAndType", func(t *testing.T) { testJobStoreGetCountByStatusAndType(t, ss) })
	t.Run("JobUpdateOptimistically", func(t *testing.T) { testJobUpdateOptimistically(t, ss) })
	t.Run("JobUpdateStatusUpdateStatusOptimistically", func(t *testing.T) { testJobUpdateStatusUpdateStatusOptimistically(t, ss) })
	t.Run("JobDelete", func(t *testing.T) { testJobDelete(t, ss) })
}

func testJobSaveGet(t *testing.T, ss store.Store) {
	job := &model.Job{
		Id:     model.NewId(),
		Type:   model.NewId(),
		Status: model.NewId(),
		Data: map[string]string{
			"Processed":     "0",
			"Total":         "12345",
			"LastProcessed": "abcd",
		},
	}

	if result := <-ss.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Job().Delete(job.Id)
	}()

	if result := <-ss.Job().Get(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.(*model.Job); received.Id != job.Id {
		t.Fatal("received incorrect job after save")
	} else if received.Data["Total"] != "12345" {
		t.Fatal("data field was not retrieved successfully:", received.Data)
	}
}

func testJobGetAllByType(t *testing.T, ss store.Store) {
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
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	if result := <-ss.Job().GetAllByType(jobType); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[0].Id && received[1].Id != jobs[0].Id {
		t.Fatal("should've received first jobs")
	} else if received[0].Id != jobs[1].Id && received[1].Id != jobs[1].Id {
		t.Fatal("should've received second jobs")
	}
}

func testJobGetAllByTypePage(t *testing.T, ss store.Store) {
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
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	if result := <-ss.Job().GetAllByTypePage(jobType, 0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if result := <-ss.Job().GetAllByTypePage(jobType, 2, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 1 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}
}

func testJobGetAllPage(t *testing.T, ss store.Store) {
	jobType := model.NewId()
	createAtTime := model.GetMillis()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: createAtTime + 1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: createAtTime,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: createAtTime + 2,
		},
	}

	for _, job := range jobs {
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	if result := <-ss.Job().GetAllPage(0, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 2 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[2].Id {
		t.Fatal("should've received newest job first")
	} else if received[1].Id != jobs[0].Id {
		t.Fatal("should've received second newest job second")
	}

	if result := <-ss.Job().GetAllPage(2, 2); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) < 1 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id {
		t.Fatal("should've received oldest job last")
	}
}

func testJobGetAllByStatus(t *testing.T, ss store.Store) {
	jobType := model.NewId()
	status := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1000,
			Status:   status,
			Data: map[string]string{
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
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	if result := <-ss.Job().GetAllByStatus(status); result.Err != nil {
		t.Fatal(result.Err)
	} else if received := result.Data.([]*model.Job); len(received) != 3 {
		t.Fatal("received wrong number of jobs")
	} else if received[0].Id != jobs[1].Id || received[1].Id != jobs[0].Id || received[2].Id != jobs[2].Id {
		t.Fatal("should've received jobs ordered by CreateAt time")
	} else if received[1].Data["test"] != "data" {
		t.Fatal("should've received job data field back as saved")
	}
}

func testJobStoreGetNewestJobByStatusAndType(t *testing.T, ss store.Store) {
	jobType1 := model.NewId()
	jobType2 := model.NewId()
	status1 := model.NewId()
	status2 := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 1001,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 1000,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType2,
			CreateAt: 1003,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 1004,
			Status:   status2,
		},
	}

	for _, job := range jobs {
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	result := <-ss.Job().GetNewestJobByStatusAndType(status1, jobType1)
	assert.Nil(t, result.Err)
	assert.EqualValues(t, jobs[0].Id, result.Data.(*model.Job).Id)

	result = <-ss.Job().GetNewestJobByStatusAndType(model.NewId(), model.NewId())
	assert.Nil(t, result.Err)
	assert.Nil(t, result.Data.(*model.Job))
}

func testJobStoreGetCountByStatusAndType(t *testing.T, ss store.Store) {
	jobType1 := model.NewId()
	jobType2 := model.NewId()
	status1 := model.NewId()
	status2 := model.NewId()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 1000,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 999,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType2,
			CreateAt: 1001,
			Status:   status1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType1,
			CreateAt: 1002,
			Status:   status2,
		},
	}

	for _, job := range jobs {
		store.Must(ss.Job().Save(job))
		defer ss.Job().Delete(job.Id)
	}

	result := <-ss.Job().GetCountByStatusAndType(status1, jobType1)
	assert.Nil(t, result.Err)
	assert.EqualValues(t, 2, result.Data.(int64))

	result = <-ss.Job().GetCountByStatusAndType(status2, jobType2)
	assert.Nil(t, result.Err)
	assert.EqualValues(t, 0, result.Data.(int64))

	result = <-ss.Job().GetCountByStatusAndType(status1, jobType2)
	assert.Nil(t, result.Err)
	assert.EqualValues(t, 1, result.Data.(int64))

	result = <-ss.Job().GetCountByStatusAndType(status2, jobType1)
	assert.Nil(t, result.Err)
	assert.EqualValues(t, 1, result.Data.(int64))
}

func testJobUpdateOptimistically(t *testing.T, ss store.Store) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JOB_TYPE_DATA_RETENTION,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_PENDING,
	}

	if result := <-ss.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	}
	defer ss.Job().Delete(job.Id)

	job.LastActivityAt = model.GetMillis()
	job.Status = model.JOB_STATUS_IN_PROGRESS
	job.Progress = 50
	job.Data = map[string]string{
		"Foo": "Bar",
	}

	if result := <-ss.Job().UpdateOptimistically(job, model.JOB_STATUS_SUCCESS); result.Err != nil {
		if result.Data.(bool) {
			t.Fatal("should have failed due to incorrect old status")
		}
	}

	time.Sleep(2 * time.Millisecond)

	if result := <-ss.Job().UpdateOptimistically(job, model.JOB_STATUS_PENDING); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("Should have successfully updated")
		}

		var updatedJob *model.Job

		if result := <-ss.Job().Get(job.Id); result.Err != nil {
			t.Fatal(result.Err)
		} else {
			updatedJob = result.Data.(*model.Job)
		}

		if updatedJob.Type != job.Type || updatedJob.CreateAt != job.CreateAt || updatedJob.Status != job.Status || updatedJob.LastActivityAt <= job.LastActivityAt || updatedJob.Progress != job.Progress || updatedJob.Data["Foo"] != job.Data["Foo"] {
			t.Fatal("Some update property was not as expected")
		}
	}

}

func testJobUpdateStatusUpdateStatusOptimistically(t *testing.T, ss store.Store) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JOB_TYPE_DATA_RETENTION,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_SUCCESS,
	}

	var lastUpdateAt int64
	if result := <-ss.Job().Save(job); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		lastUpdateAt = result.Data.(*model.Job).LastActivityAt
	}

	defer ss.Job().Delete(job.Id)

	time.Sleep(2 * time.Millisecond)

	if result := <-ss.Job().UpdateStatus(job.Id, model.JOB_STATUS_PENDING); result.Err != nil {
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

	if result := <-ss.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_SUCCESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if result.Data.(bool) {
			t.Fatal("should be false due to incorrect original status")
		}
	}

	if result := <-ss.Job().Get(job.Id); result.Err != nil {
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

	if result := <-ss.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("should have succeeded")
		}
	}

	var startAtSet int64
	if result := <-ss.Job().Get(job.Id); result.Err != nil {
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

	if result := <-ss.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_SUCCESS); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if !result.Data.(bool) {
			t.Fatal("should have succeeded")
		}
	}

	if result := <-ss.Job().Get(job.Id); result.Err != nil {
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
	}
}

func testJobDelete(t *testing.T, ss store.Store) {
	job := store.Must(ss.Job().Save(&model.Job{
		Id: model.NewId(),
	})).(*model.Job)

	if result := <-ss.Job().Delete(job.Id); result.Err != nil {
		t.Fatal(result.Err)
	}
}
