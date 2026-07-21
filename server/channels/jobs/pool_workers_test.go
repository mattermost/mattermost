// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var noopEnabled = func(_ *model.Config) bool { return true }

func fixedPoolSize(n int) func(*model.Config) int {
	return func(*model.Config) int { return n }
}

func expectJobLifecycle(mockStore *storetest.Store, mockMetrics *mocks.MetricsInterface, jobID string) {
	mockStore.JobStore.
		On("UpdateStatusOptimistically", jobID, model.JobStatusPending, model.JobStatusInProgress).
		Return(&model.Job{Id: jobID, Type: "job_type"}, nil).
		Once()
	mockStore.JobStore.
		On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).
		Return(&model.Job{Id: jobID, Type: "job_type"}, nil).
		Once()
	mockStore.JobStore.
		On("UpdateStatus", jobID, model.JobStatusSuccess).
		Return(&model.Job{Id: jobID, Type: "job_type"}, nil).
		Once()
	mockMetrics.On("IncrementJobActive", "job_type").Once()
	mockMetrics.On("DecrementJobActive", "job_type").Once()
}

func receiveStarted(t *testing.T, started <-chan string) string {
	t.Helper()
	var jobID string
	received := false
	select {
	case jobID = <-started:
		received = true
	case <-time.After(5 * time.Second):
	}
	assert.True(t, received, "timed out waiting for job execution")
	return jobID
}

func TestPoolWorkerConcurrentExecution(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	jobServer, mockStore, mockMetrics := makeJobServer(t)
	started := make(chan string, 3)
	release := make(chan struct{})
	execute := func(_ mlog.LoggerIFace, job *model.Job) error {
		started <- job.Id
		<-release
		return nil
	}
	worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(3))

	for _, jobID := range []string{"job1", "job2", "job3"} {
		expectJobLifecycle(mockStore, mockMetrics, jobID)
	}

	go worker.Run()
	for _, jobID := range []string{"job1", "job2", "job3"} {
		worker.JobChannel() <- model.Job{Id: jobID, Type: "job_type"}
	}

	got := map[string]bool{}
	for range 3 {
		got[receiveStarted(t, started)] = true
	}
	require.Equal(t, map[string]bool{"job1": true, "job2": true, "job3": true}, got)

	accepted := false
	select {
	case worker.JobChannel() <- model.Job{Id: "job4", Type: "job_type"}:
		accepted = true
	case <-time.After(100 * time.Millisecond):
	}
	assert.False(t, accepted, "fourth job accepted while pool exhausted")

	close(release)
	worker.Stop()
}

func TestPoolWorkerStopDrainsInFlight(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	jobServer, mockStore, mockMetrics := makeJobServer(t)
	started := make(chan string, 2)
	release := make(chan struct{})
	execute := func(_ mlog.LoggerIFace, job *model.Job) error {
		started <- job.Id
		<-release
		return nil
	}
	worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(2))

	expectJobLifecycle(mockStore, mockMetrics, "job1")
	expectJobLifecycle(mockStore, mockMetrics, "job2")

	go worker.Run()
	worker.JobChannel() <- model.Job{Id: "job1", Type: "job_type"}
	worker.JobChannel() <- model.Job{Id: "job2", Type: "job_type"}
	receiveStarted(t, started)
	receiveStarted(t, started)

	stopReturned := make(chan struct{})
	go func() {
		worker.Stop()
		close(stopReturned)
	}()

	returnedEarly := false
	select {
	case <-stopReturned:
		returnedEarly = true
	case <-time.After(200 * time.Millisecond):
	}
	assert.False(t, returnedEarly, "Stop returned before in-flight jobs finished")

	close(release)
	stopped := false
	select {
	case <-stopReturned:
		stopped = true
	case <-time.After(5 * time.Second):
	}
	assert.True(t, stopped, "timed out waiting for Stop")
}

func TestPoolWorkerDoJob(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	tests := []struct {
		name         string
		setupMocks   func(*storetest.Store, *mocks.MetricsInterface, *model.Job)
		executeError error
		wantExecuted bool
	}{
		{
			name: "lost claim race",
			setupMocks: func(mockStore *storetest.Store, _ *mocks.MetricsInterface, job *model.Job) {
				mockStore.JobStore.
					On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
					Return(nil, nil)
			},
		},
		{
			name: "claim error",
			setupMocks: func(mockStore *storetest.Store, _ *mocks.MetricsInterface, job *model.Job) {
				mockStore.JobStore.
					On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
					Return(nil, &model.AppError{Message: "boom"})
			},
		},
		{
			name: "execute error sets job error",
			setupMocks: func(mockStore *storetest.Store, mockMetrics *mocks.MetricsInterface, job *model.Job) {
				mockStore.JobStore.
					On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
					Return(&model.Job{Id: job.Id, Type: job.Type}, nil)
				mockStore.JobStore.
					On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).
					Return(&model.Job{Id: job.Id, Type: job.Type}, nil)
				mockMetrics.On("IncrementJobActive", job.Type)
				mockMetrics.On("DecrementJobActive", job.Type)
			},
			executeError: errors.New("fail"),
			wantExecuted: true,
		},
		{
			name: "success",
			setupMocks: func(mockStore *storetest.Store, mockMetrics *mocks.MetricsInterface, job *model.Job) {
				expectJobLifecycle(mockStore, mockMetrics, job.Id)
			},
			wantExecuted: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)
			job := &model.Job{Id: "job_id", Type: "job_type"}
			tt.setupMocks(mockStore, mockMetrics, job)

			executed := false
			execute := func(_ mlog.LoggerIFace, _ *model.Job) error {
				executed = true
				return tt.executeError
			}
			worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(1))

			worker.DoJob(job)
			require.Equal(t, tt.wantExecuted, executed)
		})
	}
}

func TestPoolWorkerRunStopRun(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	jobServer, mockStore, mockMetrics := makeJobServer(t)
	executed := make(chan string, 2)
	execute := func(_ mlog.LoggerIFace, job *model.Job) error {
		executed <- job.Id
		return nil
	}
	worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(1))
	expectJobLifecycle(mockStore, mockMetrics, "job1")
	expectJobLifecycle(mockStore, mockMetrics, "job2")

	go worker.Run()
	worker.JobChannel() <- model.Job{Id: "job1", Type: "job_type"}
	require.Equal(t, "job1", receiveStarted(t, executed))
	worker.Stop()

	go worker.Run()
	worker.JobChannel() <- model.Job{Id: "job2", Type: "job_type"}
	require.Equal(t, "job2", receiveStarted(t, executed))
	worker.Stop()
}

func TestPoolWorkerStopStates(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("stop before run returns immediately", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		worker := NewPoolWorker("test", jobServer, func(mlog.LoggerIFace, *model.Job) error {
			return nil
		}, noopEnabled, fixedPoolSize(1))

		require.NotPanics(t, worker.Stop)
	})

	t.Run("double stop is a no-op", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		runStarted := make(chan struct{})
		poolSize := func(*model.Config) int {
			close(runStarted)
			return 1
		}
		worker := NewPoolWorker("test", jobServer, func(mlog.LoggerIFace, *model.Job) error {
			return nil
		}, noopEnabled, poolSize)

		go worker.Run()
		runDidStart := false
		select {
		case <-runStarted:
			runDidStart = true
		case <-time.After(5 * time.Second):
		}
		assert.True(t, runDidStart, "timed out waiting for Run")
		worker.Stop()
		require.NotPanics(t, worker.Stop)
	})

	t.Run("second run is a no-op", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		started := make(chan string, 1)
		release := make(chan struct{})
		execute := func(_ mlog.LoggerIFace, job *model.Job) error {
			started <- job.Id
			<-release
			return nil
		}
		worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(1))
		expectJobLifecycle(mockStore, mockMetrics, "job1")

		go worker.Run()
		go worker.Run()
		time.Sleep(50 * time.Millisecond)
		worker.JobChannel() <- model.Job{Id: "job1", Type: "job_type"}
		receiveStarted(t, started)

		accepted := false
		select {
		case worker.JobChannel() <- model.Job{Id: "job2", Type: "job_type"}:
			accepted = true
		case <-time.After(100 * time.Millisecond):
		}
		assert.False(t, accepted, "second job accepted by duplicate pool")

		close(release)
		worker.Stop()
	})
}

func TestPoolWorkerPoolSizeClamp(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	tests := []struct {
		name string
		size int
	}{
		{name: "zero", size: 0},
		{name: "negative", size: -5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)
			started := make(chan string, 1)
			release := make(chan struct{})
			execute := func(_ mlog.LoggerIFace, job *model.Job) error {
				started <- job.Id
				<-release
				return nil
			}
			worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(tt.size))
			expectJobLifecycle(mockStore, mockMetrics, "job1")

			go worker.Run()
			worker.JobChannel() <- model.Job{Id: "job1", Type: "job_type"}
			receiveStarted(t, started)

			accepted := false
			select {
			case worker.JobChannel() <- model.Job{Id: "job2", Type: "job_type"}:
				accepted = true
			case <-time.After(100 * time.Millisecond):
			}
			assert.False(t, accepted, "second job accepted by clamped pool")

			close(release)
			worker.Stop()
		})
	}
}

func TestPoolWorkerPanicParity(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	jobServer, mockStore, mockMetrics := makeJobServer(t)
	job := &model.Job{Id: "job_id", Type: "job_type"}
	execute := func(_ mlog.LoggerIFace, _ *model.Job) error {
		return nil
	}

	mockStore.JobStore.
		On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
		Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
	mockStore.JobStore.
		On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).
		Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
	mockStore.JobStore.
		On("UpdateStatus", "job_id", model.JobStatusSuccess).
		Return(nil, errors.New("test"))
	mockMetrics.On("IncrementJobActive", "job_type")
	mockMetrics.On("DecrementJobActive", "job_type")

	worker := NewPoolWorker("test", jobServer, execute, noopEnabled, fixedPoolSize(1))
	require.NotPanics(t, func() {
		worker.DoJob(job)
	})
}
