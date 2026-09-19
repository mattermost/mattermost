// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestSimpleWorkerPanic(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

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

	mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
	mockStore.JobStore.On("UpdateStatus", "job_id", "success").Return(nil, errors.New("test"))
	mockMetrics.On("IncrementJobActive", "job_type")
	mockMetrics.On("DecrementJobActive", "job_type")
	sWorker := NewSimpleWorker("test", jobServer, exec, isEnabled)

	require.NotPanics(t, func() {
		sWorker.DoJob(job)
	})
}

func TestSetWorkerJobSuccessProgressFailure(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	jobServer, mockStore, mockMetrics := makeJobServer(t)
	job := &model.Job{
		Id:     "job_id",
		Type:   "job_type",
		Status: model.JobStatusInProgress,
	}

	mockStore.JobStore.
		On("UpdateOptimistically", mock.MatchedBy(func(updatedJob *model.Job) bool {
			return updatedJob.Id == job.Id &&
				updatedJob.Status == model.JobStatusInProgress &&
				updatedJob.Progress == 100
		}), model.JobStatusInProgress).
		Return(nil, &model.AppError{Message: "progress failed"}).
		Once()
	mockStore.JobStore.
		On("UpdateOptimistically", mock.MatchedBy(func(updatedJob *model.Job) bool {
			return updatedJob.Id == job.Id &&
				updatedJob.Status == model.JobStatusError &&
				updatedJob.Progress == -1
		}), model.JobStatusInProgress).
		Return(job, nil).
		Once()
	mockMetrics.On("DecrementJobActive", job.Type).Once()

	setWorkerJobSuccess(jobServer, mlog.CreateConsoleTestLogger(t), "TestWorker", job)

	require.Equal(t, model.JobStatusError, job.Status)
	mockStore.JobStore.AssertNotCalled(t, "UpdateStatus", job.Id, model.JobStatusSuccess)
	mockMetrics.AssertNumberOfCalls(t, "DecrementJobActive", 1)
}
