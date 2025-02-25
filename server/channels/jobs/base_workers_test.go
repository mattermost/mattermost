// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestSimpleWorkerPanic(t *testing.T) {
	jobServer, mockStore, mockMetrics := makeJobServer(t)

	job := &model.Job{
		Id:   "job_id",
		Type: "job_type",
	}

	exec := func(_ mlog.LoggerIFace, _ *model.Job) error {
		return nil
	}

	isEnabled := func(_ *model.Config) bool {
		return true
	}

	mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil)
	mockStore.JobStore.On("Get", mock.AnythingOfType("*request.Context"), "job_id").Return(nil, errors.New("test"))
	mockMetrics.On("IncrementJobActive", "job_type")
	mockMetrics.On("DecrementJobActive", "job_type")
	sWorker := NewSimpleWorker("test", jobServer, exec, isEnabled)

	require.NotPanics(t, func() {
		sWorker.DoJob(job)
	})
}

func TestSimpleWorkerClaimOnce(t *testing.T) {
	jobServer, mockStore, mockMetrics := makeJobServer(t)

	job := &model.Job{
		Id:   "job_id",
		Type: "job_type",
	}

	// Track how many times the execute function is called
	executeCount := 0
	exec := func(_ mlog.LoggerIFace, _ *model.Job) error {
		executeCount++
		return nil
	}

	isEnabled := func(_ *model.Config) bool {
		return true
	}

	// First claim should succeed
	mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
		Return(true, nil).Once()

	// Second claim should fail
	mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
		Return(false, nil).Once()

	// After successful claim, GetJob should be called once
	mockStore.JobStore.On("Get", mock.AnythingOfType("*request.Context"), "job_id").
		Return(job, nil).Once()

	// For job completion - should only happen once
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).
		Return(true, nil).Once()
	mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(job, nil)

	// Metrics should only be updated once
	mockMetrics.On("IncrementJobActive", "job_type").Once()
	mockMetrics.On("DecrementJobActive", "job_type").Once()

	sWorker := NewSimpleWorker("test", jobServer, exec, isEnabled)

	// First call should claim the job and execute it
	sWorker.DoJob(job)

	// Second call should fail to claim and return early
	sWorker.DoJob(job)

	// Verify all mock expectations
	mockStore.JobStore.AssertExpectations(t)
	mockMetrics.AssertExpectations(t)

	// Verify the execute function was only called once
	require.Equal(t, 1, executeCount, "Execute function should be called exactly once")
}
