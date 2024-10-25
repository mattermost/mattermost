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
	"github.com/stretchr/testify/require"
)

// TestBatchWorkerRace tests race conditions during the start/stop
// cases of the batch worker. Use the -race flag while testing this.
func TestBatchWorkerRace(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	worker := jobs.MakeBatchWorker(th.Server.Jobs, th.Server.Store(), 1*time.Second, func(rctx *request.Context, job *model.Job) bool {
		return false
	})

	go worker.Run()
	worker.Stop()
}

func TestBatchWorker(t *testing.T) {
	createBatchWorker := func(t *testing.T, th *TestHelper, doBatch func(rctx *request.Context, job *model.Job) bool) (*jobs.BatchWorker, *model.Job) {
		t.Helper()

		worker := jobs.MakeBatchWorker(th.Server.Jobs, th.Server.Store(), 1*time.Second, doBatch)
		err := th.SetupBatchWorker(t, worker)
		require.NoError(t, err, "failed to setup batch worker")
		job := &model.Job{
			Data: model.StringMap{
				"batch_number": "1",
			},
		}
		return worker, job
	}

	getBatchNumberFromData := func(t *testing.T, data model.StringMap) int {
		t.Helper()

		batchNumber, err := strconv.Atoi(data["batch_number"])
		require.NoError(t, err, "failed to convert batch number to integer")

		return batchNumber
	}

	incrementBatchNumber := func(t *testing.T, th *TestHelper, job *model.Job) {
		t.Helper()

		batchNumber, err := strconv.Atoi(job.Data["batch_number"])
		require.NoError(t, err, "failed to convert batch number to integer")

		batchNumber++
		job.Data["batch_number"] = strconv.Itoa(batchNumber)
		err = th.Server.Jobs.SetJobProgress(job, 0)
		require.NoError(t, err, "failed to set job progress")
	}

	t.Run("stop after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var worker *jobs.BatchWorker
		worker, job := createBatchWorker(t, th, func(rctx *request.Context, job *model.Job) bool {
			batchNumber := getBatchNumberFromData(t, job.Data)

			require.Equal(t, 1, batchNumber, "only batch 1 should have run")

			// Shut down the worker after the first batch to prevent subsequent ones.
			if batchNumber >= 1 {
				go worker.Stop()
			} else {
				incrementBatchNumber(t, th, job)
			}

			return false
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		require.Eventually(t, func() bool {
			status, err := th.Server.Jobs.GetStatus(job)
			return err == nil && status == model.JobStatusPending
		}, 5*time.Second, 100*time.Millisecond, "job status should become pending")

		require.Eventually(t, func() bool {
			currentBatch := getBatchNumberFromData(t, job.Data)
			return currentBatch == 1
		}, 5*time.Second, 100*time.Millisecond, "batch number should reach 1")
	})

	t.Run("stop after second batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var worker *jobs.BatchWorker
		worker, job := createBatchWorker(t, th, func(rctx *request.Context, job *model.Job) bool {
			batchNumber := getBatchNumberFromData(t, job.Data)

			require.LessOrEqual(t, batchNumber, 2, "only batches 1 and 2 should have run")

			// Shut down the worker after the second batch to prevent subsequent ones.
			if batchNumber >= 2 {
				go worker.Stop()
			} else {
				incrementBatchNumber(t, th, job)
			}

			return false
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		require.Eventually(t, func() bool {
			status, err := th.Server.Jobs.GetStatus(job)
			return err == nil && status == model.JobStatusPending
		}, 5*time.Second, 100*time.Millisecond, "job status should become pending")

		require.Eventually(t, func() bool {
			currentBatch := getBatchNumberFromData(t, job.Data)
			return currentBatch == 2
		}, 5*time.Second, 100*time.Millisecond, "batch number should reach 2")
	})

	t.Run("done after first batch", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var worker *jobs.BatchWorker
		worker, job := createBatchWorker(t, th, func(rctx *request.Context, job *model.Job) bool {
			batchNumber := getBatchNumberFromData(t, job.Data)
			require.Equal(t, 1, batchNumber, "only batch 1 should have run")

			if batchNumber >= 1 {
				go worker.Stop() // Shut down the worker when the job is done
				return true
			}

			incrementBatchNumber(t, th, job)
			return false
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		require.Eventually(t, func() bool {
			currentBatch := getBatchNumberFromData(t, job.Data)
			return currentBatch == 1
		}, 5*time.Second, 100*time.Millisecond, "batch number should reach 1")
	})

	t.Run("done after three batches", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var worker *jobs.BatchWorker
		worker, job := createBatchWorker(t, th, func(rctx *request.Context, job *model.Job) bool {
			batchNumber := getBatchNumberFromData(t, job.Data)
			require.LessOrEqual(t, batchNumber, 3, "only 3 batches should have run")

			if batchNumber >= 3 {
				go worker.Stop() // Shut down the worker when the job is done
				return true
			}

			incrementBatchNumber(t, th, job)
			return false
		})

		// Queue the work to be done
		worker.JobChannel() <- *job

		require.Eventually(t, func() bool {
			currentBatch := getBatchNumberFromData(t, job.Data)
			return currentBatch == 3
		}, 5*time.Second, 100*time.Millisecond, "batch number should reach 3")
	})
}
