// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestResumableSimpleWorker(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("should set job to pending when worker stops", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "test-resumable-job-1",
			Type: "test_resumable",
			Data: map[string]string{},
		}

		var wg sync.WaitGroup
		wg.Add(1)

		// Create a long-running job that checks for context cancellation
		execute := func(rctx request.CTX, job *model.Job) error {
			defer wg.Done()
			logger := rctx.Logger()
			logger.Info("Test job started")

			// Simulate work that checks for cancellation
			for i := 0; i < 10; i++ {
				select {
				case <-rctx.Context().Done():
					logger.Info("Test job cancelled")
					return rctx.Context().Err()
				case <-time.After(100 * time.Millisecond):
					logger.Info("Test job working", mlog.Int("iteration", i))
				}
			}

			logger.Info("Test job completed")
			return nil
		}

		isEnabled := func(_ *model.Config) bool {
			return true
		}

		// Mock expectations
		mockStore.JobStore.On("UpdateStatusOptimistically", "test-resumable-job-1", model.JobStatusPending, model.JobStatusInProgress).Return(job, nil)
		mockStore.JobStore.On("UpdateStatus", "test-resumable-job-1", model.JobStatusPending).Return(nil, nil)
		mockMetrics.On("IncrementJobActive", "test_resumable")
		mockMetrics.On("DecrementJobActive", "test_resumable")

		// Create a resumable worker
		worker := NewResumableSimpleWorker("test_resumable", jobServer, execute, isEnabled)

		// Start the worker
		go worker.Run()

		// Give the worker time to start
		time.Sleep(50 * time.Millisecond)

		// Send the job
		select {
		case worker.JobChannel() <- *job:
			t.Log("Job sent to worker")
		case <-time.After(time.Second):
			require.Fail(t, "Failed to send job to worker")
		}

		// Let the job run for a bit
		time.Sleep(200 * time.Millisecond)

		// Stop the worker (should trigger setPendingOnStop)
		t.Log("Stopping worker...")
		go worker.Stop()

		// Wait for the job to be cancelled
		wg.Wait()

		// Give some time for the pending status to be set
		time.Sleep(100 * time.Millisecond)

		// Verify all mocks were called
		mockStore.JobStore.AssertExpectations(t)
		mockMetrics.AssertExpectations(t)
	})

	t.Run("should not set job to pending for non-resumable worker", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "test-non-resumable-job-1",
			Type: "test_non_resumable",
			Data: map[string]string{},
		}

		var wg sync.WaitGroup
		wg.Add(1)

		execute := func(rctx request.CTX, job *model.Job) error {
			defer wg.Done()
			logger := rctx.Logger()
			logger.Info("Non-resumable job started")

			// Check for cancellation
			select {
			case <-rctx.Context().Done():
				logger.Info("Non-resumable job cancelled")
				return rctx.Context().Err()
			case <-time.After(500 * time.Millisecond):
				logger.Info("Non-resumable job completed")
			}

			return nil
		}

		isEnabled := func(_ *model.Config) bool {
			return true
		}

		// Mock expectations - note we don't expect SetJobPending to be called
		mockStore.JobStore.On("UpdateStatusOptimistically", "test-non-resumable-job-1", model.JobStatusPending, model.JobStatusInProgress).Return(job, nil)
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil).Maybe()
		mockStore.JobStore.On("Update", mock.AnythingOfType("*model.Job")).Return(nil, errors.New("test error")).Maybe()
		mockMetrics.On("IncrementJobActive", "test_non_resumable")
		mockMetrics.On("DecrementJobActive", "test_non_resumable")

		// Create a regular (non-resumable) worker
		worker := NewSimpleWorker("test_non_resumable", jobServer, execute, isEnabled)

		// Start the worker
		go worker.Run()

		// Give the worker time to start
		time.Sleep(50 * time.Millisecond)

		// Send the job
		select {
		case worker.JobChannel() <- *job:
			t.Log("Job sent to worker")
		case <-time.After(time.Second):
			require.Fail(t, "Failed to send job to worker")
		}

		// Let the job run for a bit
		time.Sleep(200 * time.Millisecond)

		// Stop the worker
		t.Log("Stopping worker...")
		go worker.Stop()

		// Wait for the job to finish
		wg.Wait()

		// Give some time to ensure no pending status is set
		time.Sleep(100 * time.Millisecond)

		// Verify SetJobPending was NOT called
		mockStore.JobStore.AssertNotCalled(t, "UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusPending)
	})

	t.Run("should complete successfully if not cancelled", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "test-complete-job-1",
			Type: "test_complete",
			Data: map[string]string{},
		}

		var jobCompleted bool
		var mu sync.Mutex

		execute := func(rctx request.CTX, job *model.Job) error {
			logger := rctx.Logger()
			logger.Info("Job executing")

			// Quick job that completes
			time.Sleep(50 * time.Millisecond)

			mu.Lock()
			jobCompleted = true
			mu.Unlock()

			logger.Info("Job completed successfully")
			return nil
		}

		isEnabled := func(_ *model.Config) bool {
			return true
		}

		// Mock expectations for successful completion
		mockStore.JobStore.On("UpdateStatusOptimistically", "test-complete-job-1", model.JobStatusPending, model.JobStatusInProgress).Return(job, nil)
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil)
		mockStore.JobStore.On("UpdateStatus", "test-complete-job-1", model.JobStatusSuccess).Return(nil, nil)
		mockMetrics.On("IncrementJobActive", "test_complete")
		mockMetrics.On("DecrementJobActive", "test_complete")

		// Create a resumable worker
		worker := NewResumableSimpleWorker("test_complete", jobServer, execute, isEnabled)

		// Start the worker
		go worker.Run()

		// Give the worker time to start
		time.Sleep(50 * time.Millisecond)

		// Send the job
		select {
		case worker.JobChannel() <- *job:
			t.Log("Job sent to worker")
		case <-time.After(time.Second):
			require.Fail(t, "Failed to send job to worker")
		}

		// Wait for job to complete
		time.Sleep(200 * time.Millisecond)

		// Check that job completed
		mu.Lock()
		assert.True(t, jobCompleted, "Job should have completed")
		mu.Unlock()

		// Stop the worker
		worker.Stop()

		// Verify all mocks were called
		mockStore.JobStore.AssertExpectations(t)
		mockMetrics.AssertExpectations(t)
	})
}
