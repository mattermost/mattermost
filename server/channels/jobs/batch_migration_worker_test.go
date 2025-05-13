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

func (ma MockApp) GetClusterStatus(rctx request.CTX) ([]*model.ClusterInfo, error) {
	return ma.clusterInfo, nil
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
	setupBatchWorker := func(t *testing.T, th *TestHelper, mockApp *MockApp, doMigrationBatch func(model.StringMap, store.Store) (model.StringMap, bool, error)) (model.Worker, *model.Job) {
		t.Helper()

		worker := jobs.MakeBatchMigrationWorker(
			th.Server.Jobs,
			th.Server.Store(),
			mockApp,
			model.NewId(),
			1*time.Second,
			doMigrationBatch,
		)
		job := th.SetupBatchWorker(t, worker.BatchWorker)

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

	t.Run("done after three batches", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		mockApp := &MockApp{}

		var worker model.Worker
		var job *model.Job
		worker, job = setupBatchWorker(t, th, mockApp, func(data model.StringMap, s store.Store) (model.StringMap, bool, error) {
			batchNumber := getBatchNumberFromData(t, data)
			require.LessOrEqual(t, batchNumber, 3, "only 3 batches should have run")

			if batchNumber >= 3 {
				go worker.Stop() // Shut down the worker when the job is done
				return getDataFromBatchNumber(batchNumber), true, nil
			}

			batchNumber++
			return getDataFromBatchNumber(batchNumber), false, nil
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		th.WaitForJobStatus(t, job, model.JobStatusSuccess)
		th.WaitForBatchNumber(t, job, 3)
	})

	t.Run("clusters not in sync before first batch", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

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

		th.WaitForJobStatus(t, job, model.JobStatusPending)
		assertJobReset(t, th, job)

		stopWorker(t, worker)
	})

	t.Run("clusters not in sync after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

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

		th.WaitForJobStatus(t, job, model.JobStatusPending)
		assertJobReset(t, th, job)

		stopWorker(t, worker)
	})
}
