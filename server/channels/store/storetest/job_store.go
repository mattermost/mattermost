// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("JobSaveGet", func(t *testing.T) { testJobSaveGet(t, rctx, ss) })
	t.Run("JobSaveOnce", func(t *testing.T) { testJobSaveOnce(t, rctx, ss) })
	t.Run("JobGetAllByType", func(t *testing.T) { testJobGetAllByType(t, rctx, ss) })
	t.Run("JobGetAllByTypeAndStatus", func(t *testing.T) { testJobGetAllByTypeAndStatus(t, rctx, ss) })
	t.Run("JobGetAllByTypePage", func(t *testing.T) { testJobGetAllByTypePage(t, rctx, ss) })
	t.Run("JobGetAllByTypesPage", func(t *testing.T) { testJobGetAllByTypesPage(t, rctx, ss) })
	t.Run("JobGetAllByTypeAndStatusPage", func(t *testing.T) { testJobGetAllByTypeAndStatusPage(t, rctx, ss) })
	t.Run("JobGetAllByTypesAndStatusesPage", func(t *testing.T) { testJobGetAllByTypesAndStatusesPage(t, rctx, ss) })
	t.Run("JobGetAllByStatus", func(t *testing.T) { testJobGetAllByStatus(t, rctx, ss) })
	t.Run("GetNewestJobByStatusAndType", func(t *testing.T) { testJobStoreGetNewestJobByStatusAndType(t, rctx, ss) })
	t.Run("GetNewestJobByStatusesAndType", func(t *testing.T) { testJobStoreGetNewestJobByStatusesAndType(t, rctx, ss) })
	t.Run("GetCountByStatusAndType", func(t *testing.T) { testJobStoreGetCountByStatusAndType(t, rctx, ss) })
	t.Run("JobUpdateOptimistically", func(t *testing.T) { testJobUpdateOptimistically(t, rctx, ss) })
	t.Run("JobUpdateStatusUpdateStatusOptimistically", func(t *testing.T) { testJobUpdateStatusUpdateStatusOptimistically(t, rctx, ss) })
	t.Run("JobGetByTypeAndData", func(t *testing.T) { testJobGetByTypeAndData(t, rctx, ss) })
	t.Run("JobDelete", func(t *testing.T) { testJobDelete(t, rctx, ss) })
	t.Run("JobCleanup", func(t *testing.T) { testJobCleanup(t, rctx, ss) })
}

func testJobSaveGet(t *testing.T, rctx request.CTX, ss store.Store) {
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

	_, err := ss.Job().Save(job)
	require.NoError(t, err)

	defer ss.Job().Delete(job.Id)

	received, err := ss.Job().Get(rctx, job.Id)
	require.NoError(t, err)
	require.Equal(t, job.Id, received.Id, "received incorrect job after save")
	require.Equal(t, "12345", received.Data["Total"])
}

func testJobSaveOnce(t *testing.T, rctx request.CTX, ss store.Store) {
	var wg sync.WaitGroup

	ids := make([]string, 2)
	for i := range 2 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			job := &model.Job{
				Id:     model.NewId(),
				Type:   model.JobTypeS3PathMigration,
				Status: model.JobStatusPending,
				Data: map[string]string{
					"Processed":     "0",
					"Total":         "12345",
					"LastProcessed": "abcd",
				},
			}

			job, err := ss.Job().SaveOnce(job)
			if err != nil {
				var pqErr *pq.Error
				if errors.As(err, &pqErr) {
					t.Logf("%#v\n", pqErr)
				}
			}
			require.NoError(t, err)

			if job != nil {
				ids[i] = job.Id
			}
		}(i)
	}

	wg.Wait()

	cnt, err := ss.Job().GetCountByStatusAndType(model.JobStatusPending, model.JobTypeS3PathMigration)
	require.NoError(t, err)
	assert.Equal(t, 1, int(cnt))

	for _, id := range ids {
		ss.Job().Delete(id)
	}
}

func testJobGetAllByType(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetAllByType(rctx, jobType)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id}, []string{received[0].Id, received[1].Id})
}

func testJobGetAllByTypeAndStatus(t *testing.T, rctx request.CTX, ss store.Store) {
	jobType := model.NewId()

	jobs := []*model.Job{
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusPending,
		},
		{
			Id:     model.NewId(),
			Type:   jobType,
			Status: model.JobStatusPending,
		},
	}

	for _, job := range jobs {
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetAllByTypeAndStatus(rctx, jobType, model.JobStatusPending)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id}, []string{received[0].Id, received[1].Id})
}

func testJobGetAllByTypePage(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetAllByTypePage(rctx, jobType, 0, 2)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	received, err = ss.Job().GetAllByTypePage(rctx, jobType, 1, 2)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[1].Id, "should've received oldest job last")
}

func testJobGetAllByTypesPage(t *testing.T, rctx request.CTX, ss store.Store) {
	jobType := model.NewId()
	jobType2 := model.NewId()

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
			Type:     jobType2,
			CreateAt: 1001,
		},
		{
			Id:       model.NewId(),
			Type:     model.NewId(),
			CreateAt: 1002,
		},
	}

	for _, job := range jobs {
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	// test return all
	jobTypes := []string{jobType, jobType2}
	received, err := ss.Job().GetAllByTypesPage(rctx, jobTypes, 0, 4)
	require.NoError(t, err)
	require.Len(t, received, 3)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	// test paging
	jobTypes = []string{jobType, jobType2}
	received, err = ss.Job().GetAllByTypesPage(rctx, jobTypes, 0, 2)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	received, err = ss.Job().GetAllByTypesPage(rctx, jobTypes, 1, 2)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[1].Id, "should've received oldest job last")
}

func testJobGetAllByTypeAndStatusPage(t *testing.T, rctx request.CTX, ss store.Store) {
	jobType := model.NewId()
	jobType2 := model.NewId()
	t0 := model.GetMillis()

	jobs := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			Status:   model.JobStatusPending,
			CreateAt: t0,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			Status:   model.JobStatusPending,
			CreateAt: t0 + 1,
		},
		{
			Id:       model.NewId(),
			Type:     jobType2,
			Status:   model.JobStatusCanceled,
			CreateAt: t0 + 2,
		},
		{
			Id:       model.NewId(),
			Type:     jobType2,
			Status:   model.JobStatusCanceled,
			CreateAt: t0 + 3,
		},
	}

	for _, job := range jobs {
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	jobTypes := []string{jobType, jobType2}
	received, err := ss.Job().GetAllByTypesAndStatusesPage(rctx, jobTypes, []string{model.JobStatusPending}, 0, 4)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, received[0].Id, jobs[1].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received oldest job last")

	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, jobTypes, []string{model.JobStatusPending}, 1, 1)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[0].Id, "should've received the oldest pending job")

	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, []string{jobType2}, []string{model.JobStatusCanceled}, 1, 1)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received the oldest canceled job")
}

func testJobGetAllByTypesAndStatusesPage(t *testing.T, rctx request.CTX, ss store.Store) {
	jobType1 := model.NewId()
	jobType2 := model.NewId()
	jobType3 := model.NewId()
	status1 := model.JobStatusPending
	status2 := model.JobStatusInProgress
	status3 := model.JobStatusSuccess
	t0 := model.GetMillis()

	jobs := []*model.Job{
		{
			Id:       model.NewId(), // 0: type1, status1, t0
			Type:     jobType1,
			Status:   status1,
			CreateAt: t0,
		},
		{
			Id:       model.NewId(), // 1: type1, status2, t0+1
			Type:     jobType1,
			Status:   status2,
			CreateAt: t0 + 1,
		},
		{
			Id:       model.NewId(), // 2: type2, status1, t0+2
			Type:     jobType2,
			Status:   status1,
			CreateAt: t0 + 2,
		},
		{
			Id:       model.NewId(), // 3: type2, status2, t0+3
			Type:     jobType2,
			Status:   status2,
			CreateAt: t0 + 3,
		},
		{
			Id:       model.NewId(), // 4: type1, status3, t0+4
			Type:     jobType1,
			Status:   status3,
			CreateAt: t0 + 4,
		},
		{
			Id:       model.NewId(), // 5: type3, status1, t0+5
			Type:     jobType3,
			Status:   status1,
			CreateAt: t0 + 5,
		},
	}

	for _, job := range jobs {
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	// Test case 1: Get jobs of type1 or type2 with status1 or status2, limit 4, offset 0
	types1 := []string{jobType1, jobType2}
	statuses1 := []string{status1, status2}
	received, err := ss.Job().GetAllByTypesAndStatusesPage(rctx, types1, statuses1, 0, 4)
	require.NoError(t, err)
	require.Len(t, received, 4)
	require.Equal(t, jobs[3].Id, received[0].Id, "case 1: newest job type2/status2")
	require.Equal(t, jobs[2].Id, received[1].Id, "case 1: second newest job type2/status1")
	require.Equal(t, jobs[1].Id, received[2].Id, "case 1: third newest job type1/status2")
	require.Equal(t, jobs[0].Id, received[3].Id, "case 1: oldest job type1/status1")

	// Test case 2: Get jobs of type1 or type2 with status1 or status2, limit 2, offset 2
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, types1, statuses1, 2, 2)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, jobs[1].Id, received[0].Id, "case 2: third newest job type1/status2")
	require.Equal(t, jobs[0].Id, received[1].Id, "case 2: oldest job type1/status1")

	// Test case 3: Get jobs of type1 with status1 or status3, limit 5, offset 0
	types2 := []string{jobType1}
	statuses2 := []string{status1, status3}
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, types2, statuses2, 0, 5)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, jobs[4].Id, received[0].Id, "case 3: newest job type1/status3")
	require.Equal(t, jobs[0].Id, received[1].Id, "case 3: oldest job type1/status1")

	// Test case 4: Get jobs of type3 with status1, limit 1, offset 0
	types3 := []string{jobType3}
	statuses3 := []string{status1}
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, types3, statuses3, 0, 1)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, jobs[5].Id, received[0].Id, "case 4: only job type3/status1")

	// Test case 5: Get jobs with non-existent type
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, []string{model.NewId()}, statuses1, 0, 5)
	require.NoError(t, err)
	require.Len(t, received, 0, "case 5: no jobs with non-existent type")

	// Test case 6: Get jobs with non-existent status
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, types1, []string{model.NewId()}, 0, 5)
	require.NoError(t, err)
	require.Len(t, received, 0, "case 6: no jobs with non-existent status")

	// Test case 7: Empty types slice
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, []string{}, statuses1, 0, 5)
	require.NoError(t, err)
	require.Len(t, received, 0, "case 7: empty types slice should return no jobs")

	// Test case 8: Empty statuses slice
	received, err = ss.Job().GetAllByTypesAndStatusesPage(rctx, types1, []string{}, 0, 5)
	require.NoError(t, err)
	require.Len(t, received, 0, "case 8: empty statuses slice should return no jobs")
}

func testJobGetAllByStatus(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetAllByStatus(rctx, status)
	require.NoError(t, err)
	require.Len(t, received, 3)
	require.Equal(t, received[0].Id, jobs[1].Id)
	require.Equal(t, received[1].Id, jobs[0].Id)
	require.Equal(t, received[2].Id, jobs[2].Id)
	require.Equal(t, "data", received[1].Data["test"], "should've received job data field back as saved")
}

func testJobStoreGetNewestJobByStatusAndType(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetNewestJobByStatusAndType(status1, jobType1)
	assert.NoError(t, err)
	assert.EqualValues(t, jobs[0].Id, received.Id)

	received, err = ss.Job().GetNewestJobByStatusAndType(model.NewId(), model.NewId())
	assert.Error(t, err)
	var nfErr *store.ErrNotFound
	assert.True(t, errors.As(err, &nfErr))
	assert.Nil(t, received)
}

func testJobStoreGetNewestJobByStatusesAndType(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	received, err := ss.Job().GetNewestJobByStatusesAndType([]string{status1, status2}, jobType1)
	assert.NoError(t, err)
	assert.EqualValues(t, jobs[3].Id, received.Id)

	received, err = ss.Job().GetNewestJobByStatusesAndType([]string{model.NewId(), model.NewId()}, model.NewId())
	assert.Error(t, err)
	var nfErr *store.ErrNotFound
	assert.True(t, errors.As(err, &nfErr))
	assert.Nil(t, received)

	received, err = ss.Job().GetNewestJobByStatusesAndType([]string{status2}, jobType2)
	assert.Error(t, err)
	assert.True(t, errors.As(err, &nfErr))
	assert.Nil(t, received)

	received, err = ss.Job().GetNewestJobByStatusesAndType([]string{status1}, jobType2)
	assert.NoError(t, err)
	assert.EqualValues(t, jobs[2].Id, received.Id)

	received, err = ss.Job().GetNewestJobByStatusesAndType([]string{}, jobType1)
	assert.Error(t, err)
	assert.True(t, errors.As(err, &nfErr))
	assert.Nil(t, received)
}

func testJobStoreGetCountByStatusAndType(t *testing.T, rctx request.CTX, ss store.Store) {
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
		_, err := ss.Job().Save(job)
		require.NoError(t, err)
		defer ss.Job().Delete(job.Id)
	}

	count, err := ss.Job().GetCountByStatusAndType(status1, jobType1)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, count)

	count, err = ss.Job().GetCountByStatusAndType(status2, jobType2)
	assert.NoError(t, err)
	assert.EqualValues(t, 0, count)

	count, err = ss.Job().GetCountByStatusAndType(status1, jobType2)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, count)

	count, err = ss.Job().GetCountByStatusAndType(status2, jobType1)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, count)
}

func testJobUpdateOptimistically(t *testing.T, rctx request.CTX, ss store.Store) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JobTypeDataRetention,
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
	}

	_, err := ss.Job().Save(job)
	require.NoError(t, err)
	defer ss.Job().Delete(job.Id)

	job.LastActivityAt = model.GetMillis()
	job.Status = model.JobStatusInProgress
	job.Progress = 50
	job.Data = map[string]string{
		"Foo": "Bar",
	}

	updated, err := ss.Job().UpdateOptimistically(job, model.JobStatusSuccess)
	require.False(t, err != nil && updated)

	time.Sleep(2 * time.Millisecond)

	updated, err = ss.Job().UpdateOptimistically(job, model.JobStatusPending)
	require.NoError(t, err)
	require.True(t, updated)

	updatedJob, err := ss.Job().Get(rctx, job.Id)
	require.NoError(t, err)

	require.Equal(t, updatedJob.Type, job.Type)
	require.Equal(t, updatedJob.CreateAt, job.CreateAt)
	require.Equal(t, updatedJob.Status, job.Status)
	require.Greater(t, updatedJob.LastActivityAt, job.LastActivityAt)
	require.Equal(t, updatedJob.Progress, job.Progress)
	require.Equal(t, updatedJob.Data["Foo"], job.Data["Foo"])
}

func testJobUpdateStatusUpdateStatusOptimistically(t *testing.T, rctx request.CTX, ss store.Store) {
	job := &model.Job{
		Id:       model.NewId(),
		Type:     model.JobTypeDataRetention,
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusSuccess,
	}

	var lastUpdateAt int64
	received, err := ss.Job().Save(job)
	require.NoError(t, err)
	lastUpdateAt = received.LastActivityAt

	defer ss.Job().Delete(job.Id)

	time.Sleep(2 * time.Millisecond)

	received, err = ss.Job().UpdateStatus(job.Id, model.JobStatusPending)
	require.NoError(t, err)

	require.Equal(t, model.JobStatusPending, received.Status)
	require.Greater(t, received.LastActivityAt, lastUpdateAt)
	lastUpdateAt = received.LastActivityAt

	time.Sleep(2 * time.Millisecond)

	updatedJob, err := ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusInProgress, model.JobStatusSuccess)
	require.NoError(t, err)
	require.Nil(t, updatedJob)

	received, err = ss.Job().Get(rctx, job.Id)
	require.NoError(t, err)

	require.Equal(t, model.JobStatusPending, received.Status)
	require.Equal(t, received.LastActivityAt, lastUpdateAt)

	time.Sleep(2 * time.Millisecond)

	updatedJob, err = ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusPending, model.JobStatusInProgress)
	require.NoError(t, err)
	require.NotNil(t, updatedJob, "should have succeeded")

	var startAtSet int64
	require.Equal(t, model.JobStatusInProgress, updatedJob.Status)
	require.NotEqual(t, 0, updatedJob.StartAt)
	require.Greater(t, updatedJob.LastActivityAt, lastUpdateAt)
	lastUpdateAt = updatedJob.LastActivityAt
	startAtSet = updatedJob.StartAt

	time.Sleep(2 * time.Millisecond)

	updatedJob, err = ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusInProgress, model.JobStatusSuccess)
	require.NoError(t, err)
	require.NotNil(t, updatedJob, "should have succeeded")

	require.Equal(t, model.JobStatusSuccess, updatedJob.Status)
	require.Equal(t, startAtSet, updatedJob.StartAt)
	require.Greater(t, updatedJob.LastActivityAt, lastUpdateAt)
}

func testJobDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	job, err := ss.Job().Save(&model.Job{Id: model.NewId()})
	require.NoError(t, err)

	_, err = ss.Job().Delete(job.Id)
	assert.NoError(t, err)
}

func testJobCleanup(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()
	ids := make([]string, 0, 10)
	for i := range 10 {
		job, err := ss.Job().Save(&model.Job{
			Id:       model.NewId(),
			CreateAt: now - int64(i),
			Status:   model.JobStatusPending,
		})
		require.NoError(t, err)
		ids = append(ids, job.Id)
		defer ss.Job().Delete(job.Id)
	}

	jobs, err := ss.Job().GetAllByStatus(rctx, model.JobStatusPending)
	require.NoError(t, err)
	assert.Len(t, jobs, 10)

	err = ss.Job().Cleanup(now+1, 5)
	require.NoError(t, err)

	// Should not clean up pending jobs
	jobs, err = ss.Job().GetAllByStatus(rctx, model.JobStatusPending)
	require.NoError(t, err)
	assert.Len(t, jobs, 10)

	for _, id := range ids {
		_, err = ss.Job().UpdateStatus(id, model.JobStatusSuccess)
		require.NoError(t, err)
	}

	err = ss.Job().Cleanup(now+1, 5)
	require.NoError(t, err)

	// Should clean up now
	jobs, err = ss.Job().GetAllByStatus(rctx, model.JobStatusSuccess)
	require.NoError(t, err)
	assert.Len(t, jobs, 0)
}

func testJobGetByTypeAndData(t *testing.T, rctx request.CTX, ss store.Store) {
	// Test setup - create test jobs with different types and data
	jobType := model.JobTypeAccessControlSync
	otherJobType := model.JobTypeDataRetention

	// Job 1: Access control sync job with policy_id = "channel1"
	job1 := &model.Job{
		Id:     model.NewId(),
		Type:   jobType,
		Status: model.JobStatusPending,
		Data: map[string]string{
			"policy_id": "channel1",
			"extra":     "data1",
		},
	}

	// Job 2: Access control sync job with policy_id = "channel2"
	job2 := &model.Job{
		Id:     model.NewId(),
		Type:   jobType,
		Status: model.JobStatusInProgress,
		Data: map[string]string{
			"policy_id": "channel2",
			"extra":     "data2",
		},
	}

	// Job 3: Access control sync job with policy_id = "channel1" (same as job1)
	job3 := &model.Job{
		Id:     model.NewId(),
		Type:   jobType,
		Status: model.JobStatusSuccess,
		Data: map[string]string{
			"policy_id": "channel1",
			"extra":     "data3",
		},
	}

	// Job 4: Different job type with same policy_id
	job4 := &model.Job{
		Id:     model.NewId(),
		Type:   otherJobType,
		Status: model.JobStatusPending,
		Data: map[string]string{
			"policy_id": "channel1",
		},
	}

	// Save all jobs
	_, err := ss.Job().Save(job1)
	require.NoError(t, err)
	defer func() { _, _ = ss.Job().Delete(job1.Id) }()

	_, err = ss.Job().Save(job2)
	require.NoError(t, err)
	defer func() { _, _ = ss.Job().Delete(job2.Id) }()

	_, err = ss.Job().Save(job3)
	require.NoError(t, err)
	defer func() { _, _ = ss.Job().Delete(job3.Id) }()

	_, err = ss.Job().Save(job4)
	require.NoError(t, err)
	defer func() { _, _ = ss.Job().Delete(job4.Id) }()

	t.Run("finds jobs by type and single data field", func(t *testing.T) {
		// Should find job1 and job3 (both have policy_id = "channel1" and correct type)
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
		}, false)
		require.NoError(t, err)
		require.Len(t, jobs, 2)

		// Should contain job1 and job3
		jobIds := []string{jobs[0].Id, jobs[1].Id}
		assert.Contains(t, jobIds, job1.Id)
		assert.Contains(t, jobIds, job3.Id)
	})

	t.Run("finds jobs by type and multiple data fields", func(t *testing.T) {
		// Should find only job1 (has both policy_id = "channel1" AND extra = "data1")
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
			"extra":     "data1",
		}, false)
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		assert.Equal(t, job1.Id, jobs[0].Id)
	})

	t.Run("returns empty slice when no matches", func(t *testing.T) {
		// Should find nothing (no jobs with policy_id = "nonexistent")
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "nonexistent",
		}, false)
		require.NoError(t, err)
		assert.Len(t, jobs, 0)
	})

	t.Run("filters by job type correctly", func(t *testing.T) {
		// Should find only job4 (different job type with same policy_id)
		jobs, err := ss.Job().GetByTypeAndData(rctx, otherJobType, map[string]string{
			"policy_id": "channel1",
		}, false)
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		assert.Equal(t, job4.Id, jobs[0].Id)
	})

	// Test status parameter filtering
	t.Run("filters by single status", func(t *testing.T) {
		// Filter by single status should return only matching jobs
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
		}, false, model.JobStatusPending)
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		assert.Equal(t, job1.Id, jobs[0].Id)
		assert.Equal(t, model.JobStatusPending, jobs[0].Status)
	})

	t.Run("filters by multiple statuses", func(t *testing.T) {
		// Filter by multiple statuses should return jobs matching any status
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
		}, false, model.JobStatusPending, model.JobStatusSuccess)
		require.NoError(t, err)
		require.Len(t, jobs, 2)

		// Verify both statuses are represented
		statuses := []string{jobs[0].Status, jobs[1].Status}
		assert.Contains(t, statuses, model.JobStatusPending)
		assert.Contains(t, statuses, model.JobStatusSuccess)
	})

	t.Run("no status filter returns all statuses", func(t *testing.T) {
		// No status filter should return all jobs regardless of status
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
		}, false) // No status parameters
		require.NoError(t, err)
		require.Len(t, jobs, 2) // job1 (pending), job3 (success) - both have policy_id=channel1

		// Verify both statuses are present
		statuses := []string{jobs[0].Status, jobs[1].Status}
		assert.Contains(t, statuses, model.JobStatusPending)
		assert.Contains(t, statuses, model.JobStatusSuccess)
	})

	t.Run("filters by non-existent status returns empty", func(t *testing.T) {
		// Invalid status filter should return empty result
		jobs, err := ss.Job().GetByTypeAndData(rctx, jobType, map[string]string{
			"policy_id": "channel1",
		}, false, model.JobStatusError)
		require.NoError(t, err)
		require.Len(t, jobs, 0)
	})
}
