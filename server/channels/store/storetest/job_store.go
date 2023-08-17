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
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJobStore(t *testing.T, ss store.Store) {
	t.Run("JobSaveGet", func(t *testing.T) { testJobSaveGet(t, ss) })
	t.Run("JobSaveOnce", func(t *testing.T) { testJobSaveOnce(t, ss) })
	t.Run("JobGetAllByType", func(t *testing.T) { testJobGetAllByType(t, ss) })
	t.Run("JobGetAllByTypeAndStatus", func(t *testing.T) { testJobGetAllByTypeAndStatus(t, ss) })
	t.Run("JobGetAllByTypePage", func(t *testing.T) { testJobGetAllByTypePage(t, ss) })
	t.Run("JobGetAllByTypesPage", func(t *testing.T) { testJobGetAllByTypesPage(t, ss) })
	t.Run("JobGetAllByStatus", func(t *testing.T) { testJobGetAllByStatus(t, ss) })
	t.Run("GetNewestJobByStatusAndType", func(t *testing.T) { testJobStoreGetNewestJobByStatusAndType(t, ss) })
	t.Run("GetNewestJobByStatusesAndType", func(t *testing.T) { testJobStoreGetNewestJobByStatusesAndType(t, ss) })
	t.Run("GetCountByStatusAndType", func(t *testing.T) { testJobStoreGetCountByStatusAndType(t, ss) })
	t.Run("JobUpdateOptimistically", func(t *testing.T) { testJobUpdateOptimistically(t, ss) })
	t.Run("JobUpdateStatusUpdateStatusOptimistically", func(t *testing.T) { testJobUpdateStatusUpdateStatusOptimistically(t, ss) })
	t.Run("JobDelete", func(t *testing.T) { testJobDelete(t, ss) })
	t.Run("JobCleanup", func(t *testing.T) { testJobCleanup(t, ss) })
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

	_, err := ss.Job().Save(job)
	require.NoError(t, err)

	defer ss.Job().Delete(job.Id)

	received, err := ss.Job().Get(job.Id)
	require.NoError(t, err)
	require.Equal(t, job.Id, received.Id, "received incorrect job after save")
	require.Equal(t, "12345", received.Data["Total"])
}

func testJobSaveOnce(t *testing.T, ss store.Store) {
	var wg sync.WaitGroup

	ids := make([]string, 2)
	for i := 0; i < 2; i++ {
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

func testJobGetAllByType(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, false))

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

	received, err := ss.Job().GetAllByType(ctx, jobType)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id}, []string{received[0].Id, received[1].Id})
}

func testJobGetAllByTypeAndStatus(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))
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

	received, err := ss.Job().GetAllByTypeAndStatus(ctx, jobType, model.JobStatusPending)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.ElementsMatch(t, []string{jobs[0].Id, jobs[1].Id}, []string{received[0].Id, received[1].Id})
}

func testJobGetAllByTypePage(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))

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

	received, err := ss.Job().GetAllByTypePage(ctx, jobType, 0, 2)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	received, err = ss.Job().GetAllByTypePage(ctx, jobType, 2, 2)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[1].Id, "should've received oldest job last")
}

func testJobGetAllByTypesPage(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))

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
	received, err := ss.Job().GetAllByTypesPage(ctx, jobTypes, 0, 4)
	require.NoError(t, err)
	require.Len(t, received, 3)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	// test paging
	jobTypes = []string{jobType, jobType2}
	received, err = ss.Job().GetAllByTypesPage(ctx, jobTypes, 0, 2)
	require.NoError(t, err)
	require.Len(t, received, 2)
	require.Equal(t, received[0].Id, jobs[2].Id, "should've received newest job first")
	require.Equal(t, received[1].Id, jobs[0].Id, "should've received second newest job second")

	received, err = ss.Job().GetAllByTypesPage(ctx, jobTypes, 2, 2)
	require.NoError(t, err)
	require.Len(t, received, 1)
	require.Equal(t, received[0].Id, jobs[1].Id, "should've received oldest job last")
}

func testJobGetAllByStatus(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))

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

	received, err := ss.Job().GetAllByStatus(ctx, status)
	require.NoError(t, err)
	require.Len(t, received, 3)
	require.Equal(t, received[0].Id, jobs[1].Id)
	require.Equal(t, received[1].Id, jobs[0].Id)
	require.Equal(t, received[2].Id, jobs[2].Id)
	require.Equal(t, "data", received[1].Data["test"], "should've received job data field back as saved")
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

func testJobStoreGetNewestJobByStatusesAndType(t *testing.T, ss store.Store) {
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

func testJobUpdateOptimistically(t *testing.T, ss store.Store) {
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

	updatedJob, err := ss.Job().Get(job.Id)
	require.NoError(t, err)

	require.Equal(t, updatedJob.Type, job.Type)
	require.Equal(t, updatedJob.CreateAt, job.CreateAt)
	require.Equal(t, updatedJob.Status, job.Status)
	require.Greater(t, updatedJob.LastActivityAt, job.LastActivityAt)
	require.Equal(t, updatedJob.Progress, job.Progress)
	require.Equal(t, updatedJob.Data["Foo"], job.Data["Foo"])
}

func testJobUpdateStatusUpdateStatusOptimistically(t *testing.T, ss store.Store) {
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

	updated, err := ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusInProgress, model.JobStatusSuccess)
	require.NoError(t, err)
	require.False(t, updated)

	received, err = ss.Job().Get(job.Id)
	require.NoError(t, err)

	require.Equal(t, model.JobStatusPending, received.Status)
	require.Equal(t, received.LastActivityAt, lastUpdateAt)

	time.Sleep(2 * time.Millisecond)

	updated, err = ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusPending, model.JobStatusInProgress)
	require.NoError(t, err)
	require.True(t, updated, "should have succeeded")

	var startAtSet int64
	received, err = ss.Job().Get(job.Id)
	require.NoError(t, err)
	require.Equal(t, model.JobStatusInProgress, received.Status)
	require.NotEqual(t, 0, received.StartAt)
	require.Greater(t, received.LastActivityAt, lastUpdateAt)
	lastUpdateAt = received.LastActivityAt
	startAtSet = received.StartAt

	time.Sleep(2 * time.Millisecond)

	updated, err = ss.Job().UpdateStatusOptimistically(job.Id, model.JobStatusInProgress, model.JobStatusSuccess)
	require.NoError(t, err)
	require.True(t, updated, "should have succeeded")

	received, err = ss.Job().Get(job.Id)
	require.NoError(t, err)
	require.Equal(t, model.JobStatusSuccess, received.Status)
	require.Equal(t, startAtSet, received.StartAt)
	require.Greater(t, received.LastActivityAt, lastUpdateAt)
}

func testJobDelete(t *testing.T, ss store.Store) {
	job, err := ss.Job().Save(&model.Job{Id: model.NewId()})
	require.NoError(t, err)

	_, err = ss.Job().Delete(job.Id)
	assert.NoError(t, err)
}

func testJobCleanup(t *testing.T, ss store.Store) {
	ctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t, true))

	now := model.GetMillis()
	ids := make([]string, 0, 10)
	for i := 0; i < 10; i++ {
		job, err := ss.Job().Save(&model.Job{
			Id:       model.NewId(),
			CreateAt: now - int64(i),
			Status:   model.JobStatusPending,
		})
		require.NoError(t, err)
		ids = append(ids, job.Id)
		defer ss.Job().Delete(job.Id)
	}

	jobs, err := ss.Job().GetAllByStatus(ctx, model.JobStatusPending)
	require.NoError(t, err)
	assert.Len(t, jobs, 10)

	err = ss.Job().Cleanup(now+1, 5)
	require.NoError(t, err)

	// Should not clean up pending jobs
	jobs, err = ss.Job().GetAllByStatus(ctx, model.JobStatusPending)
	require.NoError(t, err)
	assert.Len(t, jobs, 10)

	for _, id := range ids {
		_, err = ss.Job().UpdateStatus(id, model.JobStatusSuccess)
		require.NoError(t, err)
	}

	err = ss.Job().Cleanup(now+1, 5)
	require.NoError(t, err)

	// Should clean up now
	jobs, err = ss.Job().GetAllByStatus(ctx, model.JobStatusSuccess)
	require.NoError(t, err)
	assert.Len(t, jobs, 0)
}
