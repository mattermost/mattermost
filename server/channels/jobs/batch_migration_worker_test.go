// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs_test

import (
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type MockApp struct {
	clusterInfo []*model.ClusterInfo
}

func (ma MockApp) GetClusterStatus(rctx request.CTX) []*model.ClusterInfo {
	return ma.clusterInfo
}

func (ma *MockApp) SetInSync() {
	ma.clusterInfo = nil
	ma.clusterInfo = append(ma.clusterInfo, &model.ClusterInfo{
		SchemaVersion: "a",
	})
	ma.clusterInfo = append(ma.clusterInfo, &model.ClusterInfo{
		SchemaVersion: "a",
	})
}

func (ma *MockApp) SetOutOfSync() {
	ma.clusterInfo = nil
	ma.clusterInfo = append(ma.clusterInfo, &model.ClusterInfo{
		SchemaVersion: "a",
	})
	ma.clusterInfo = append(ma.clusterInfo, &model.ClusterInfo{
		SchemaVersion: "b",
	})
}

func TestBatchMigrationWorker(t *testing.T) {
	waitDone := func(t *testing.T, done chan bool, msg string) {
		t.Helper()

		require.Eventually(t, func() bool {
			select {
			case <-done:
				return true
			default:
				return false
			}
		}, 5*time.Second, 100*time.Millisecond, msg)
	}

	setupBatchWorker := func(t *testing.T, th *TestHelper, mockApp *MockApp, doMigrationBatch func(model.StringMap, store.Store) (model.StringMap, bool, error)) (model.Worker, *model.Job) {
		t.Helper()

		migrationKey := model.NewId()
		timeBetweenBatches := 1 * time.Second

		worker := jobs.MakeBatchMigrationWorker(
			th.Server.Jobs,
			th.Server.Store(),
			mockApp,
			migrationKey,
			timeBetweenBatches,
			doMigrationBatch,
		)
		th.Server.Jobs.RegisterJobType(migrationKey, worker, nil)

		job, appErr := th.Server.Jobs.CreateJob(th.Context, migrationKey, nil)
		require.Nil(t, appErr)

		done := make(chan bool)
		go func() {
			defer close(done)
			worker.Run()
		}()

		// When ending the test, ensure we wait for the worker to finish.
		t.Cleanup(func() {
			waitDone(t, done, "worker did not stop running")
		})

		// Give the worker time to start running
		time.Sleep(500 * time.Millisecond)

		return worker, job
	}

	stopWorker := func(t *testing.T, worker model.Worker) {
		t.Helper()

		stopped := make(chan bool, 1)
		go func() {
			worker.Stop()
			close(stopped)
		}()

		waitDone(t, stopped, "worker did not stop")
	}

	waitForJobStatus := func(t *testing.T, th *TestHelper, job *model.Job, status string) {
		t.Helper()

		require.Eventuallyf(t, func() bool {
			actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
			require.Nil(t, appErr)
			require.Equal(t, job.Id, actualJob.Id)

			return actualJob.Status == status
		}, 5*time.Second, 250*time.Millisecond, "job never transitioned to %s", status)
	}

	assertJobReset := func(t *testing.T, th *TestHelper, job *model.Job) {
		actualJob, appErr := th.Server.Jobs.GetJob(th.Context, job.Id)
		require.Nil(t, appErr)
		assert.Empty(t, actualJob.Progress)
		assert.Empty(t, actualJob.Data)
	}

	getBatchNumberFromData := func(t *testing.T, data model.StringMap) int {
		t.Helper()

		if data["batch_number"] == "" {
			data["batch_number"] = "1"
		}
		batchNumber, err := strconv.Atoi(data["batch_number"])
		require.NoError(t, err)

		return batchNumber
	}

	getDataFromBatchNumber := func(batchNumber int) model.StringMap {
		data := make(model.StringMap)
		data["batch_number"] = strconv.Itoa(batchNumber)

		return data
	}

	t.Run("clusters not in sync before first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}
		mockApp.SetOutOfSync()

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(model.StringMap, store.Store) (model.StringMap, bool, error) {
			require.Fail(t, "migration batch should never run while clusters not in sync")

			return nil, false, nil
		})

		// Give the worker time to start running
		time.Sleep(500 * time.Millisecond)

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusPending)
		assertJobReset(t, th, job)

		stopWorker(t, worker)
	})

	t.Run("stop after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)

			require.Equal(t, 1, batchNumber, "only batch 1 should have run")

			// Shut down the worker after the first batch to prevent subsequent ones.
			go worker.Stop()

			batchNumber++

			return getDataFromBatchNumber(batchNumber), false, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusPending)
	})

	t.Run("stop after second batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)

			require.LessOrEqual(t, batchNumber, 2, "only batches 1 and 2 should have run")

			// Shut down the worker after the first batch to prevent subsequent ones.
			go worker.Stop()
			batchNumber++

			return getDataFromBatchNumber(batchNumber), false, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusPending)
	})

	t.Run("clusters not in sync after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)
			require.Equal(t, 1, batchNumber, "only batch 1 should have run")

			mockApp.SetOutOfSync()
			batchNumber++

			return getDataFromBatchNumber(batchNumber), false, nil
		})

		// Give the worker time to start running
		time.Sleep(500 * time.Millisecond)

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusPending)
		assertJobReset(t, th, job)

		stopWorker(t, worker)
	})

	t.Run("done after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)
			require.Equal(t, 1, batchNumber, "only batch 1 should have run")

			// Shut down the worker after the first batch to prevent subsequent ones.
			go worker.Stop()
			batchNumber++

			return getDataFromBatchNumber(batchNumber), true, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusSuccess)
	})

	t.Run("done after three batches", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)
			require.LessOrEqual(t, batchNumber, 3, "only 3 batches should have run")

			// Shut down the worker after the first batch to prevent subsequent ones.
			go worker.Stop()
			batchNumber++

			return getDataFromBatchNumber(batchNumber), true, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		waitForJobStatus(t, th, job, model.JobStatusSuccess)
	})
}
