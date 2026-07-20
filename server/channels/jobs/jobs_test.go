// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func makeJobServer(t *testing.T) (*JobServer, *storetest.Store, *mocks.MetricsInterface) {
	configService := &testutils.StaticConfigService{}

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	mockMetrics := &mocks.MetricsInterface{}
	t.Cleanup(func() {
		mockMetrics.AssertExpectations(t)
	})

	jobServer := &JobServer{
		ConfigService: configService,
		Store:         mockStore,
		metrics:       mockMetrics,
		logger:        mlog.CreateConsoleTestLogger(t),
	}

	return jobServer, mockStore, mockMetrics
}

func expectErrorId(t *testing.T, errId string, appErr *model.AppError) {
	t.Helper()
	require.NotNil(t, appErr)
	require.Equal(t, errId, appErr.Id)
}

func makeTeamEditionJobServer(t *testing.T) (*JobServer, *storetest.Store) {
	configService := &testutils.StaticConfigService{}

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	jobServer := NewJobServer(configService, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)

	return jobServer, mockStore
}

func TestClaimJob(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error claiming job", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}
		retJob := *job
		retJob.Status = model.JobStatusInProgress

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
			Return(&retJob, &model.AppError{Message: "message"})

		newJob, appErr := jobServer.ClaimJob(job)
		expectErrorId(t, "app.job.update.app_error", appErr)
		require.Nil(t, newJob)
	})

	t.Run("no existing job to update", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
			Return(nil, nil)

		newJob, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		require.Nil(t, newJob)
	})

	t.Run("pending job updated", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}
		retJob := *job
		retJob.Status = model.JobStatusInProgress

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
			Return(&retJob, nil)
		mockMetrics.On("IncrementJobActive", "job_type")

		newJob, err := jobServer.ClaimJob(job)
		require.Nil(t, err)
		require.NotNil(t, newJob)
	})

	t.Run("pending job updated, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}
		retJob := *job
		retJob.Status = model.JobStatusInProgress

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
			Return(&retJob, nil)

		newJob, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		require.NotNil(t, newJob)
	})
}

func TestSetJobProgress(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error setting progress", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		progress := int64(50)
		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateOptimistically", job, model.JobStatusInProgress).
			Return(nil, &model.AppError{Message: "message"})

		err := jobServer.SetJobProgress(job, progress)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("progress updated", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		progress := int64(50)
		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		job.Status = model.JobStatusInProgress
		job.Progress = progress

		mockStore.JobStore.
			On("UpdateOptimistically", job, model.JobStatusInProgress).
			Return(job, nil)

		err := jobServer.SetJobProgress(job, progress)
		require.Nil(t, err)
	})
}

func TestSetJobWarning(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateStatus", "job_id", model.JobStatusWarning).
			Return(nil, &model.AppError{Message: "message"})

		err := jobServer.SetJobWarning(job)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("status updated", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}
		retJob := *job
		retJob.Status = model.JobStatusWarning

		mockStore.JobStore.
			On("UpdateStatus", "job_id", model.JobStatusWarning).
			Return(&retJob, nil)
		mockMetrics.On("DecrementJobActive", "job_type").Once()

		err := jobServer.SetJobWarning(job)
		require.Nil(t, err)
	})

	t.Run("status updated, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}
		retJob := *job
		retJob.Status = model.JobStatusWarning

		mockStore.JobStore.
			On("UpdateStatus", "job_id", model.JobStatusWarning).
			Return(&retJob, nil)

		err := jobServer.SetJobWarning(job)
		require.Nil(t, err)
	})
}

func TestSetJobSuccess(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(job, &model.AppError{Message: "message"})

		err := jobServer.SetJobSuccess(job)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("status updated", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		err := jobServer.SetJobSuccess(job)
		require.Nil(t, err)
	})

	t.Run("status updated, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(job, nil)

		err := jobServer.SetJobSuccess(job)
		require.Nil(t, err)
	})
}

func TestSetJobError(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("nil provided job error", func(t *testing.T) {
		t.Run("error setting status", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			job := &model.Job{
				Id:   "job_id",
				Type: "job_type",
			}

			mockStore.JobStore.
				On("UpdateStatus", "job_id", model.JobStatusError).
				Return(nil, &model.AppError{Message: "message"})

			err := jobServer.SetJobError(job, nil)
			expectErrorId(t, "app.job.update.app_error", err)
		})

		t.Run("status updated", func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)

			job := &model.Job{
				Id:   "job_id",
				Type: "job_type",
			}

			mockStore.JobStore.
				On("UpdateStatus", "job_id", model.JobStatusError).
				Return(job, nil)
			mockMetrics.On("DecrementJobActive", "job_type")

			err := jobServer.SetJobError(job, nil)
			require.Nil(t, err)
		})

		t.Run("status updated, nil metrics service", func(t *testing.T) {
			jobServer, mockStore := makeTeamEditionJobServer(t)

			job := &model.Job{
				Id:   "job_id",
				Type: "job_type",
			}

			mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusError).Return(job, nil)

			err := jobServer.SetJobError(job, nil)
			require.Nil(t, err)
		})
	})

	t.Run("provided job error", func(t *testing.T) {
		t.Run("error setting status", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.
				On("UpdateOptimistically", job, model.JobStatusInProgress).
				Return(nil, &model.AppError{Message: "message"})

			err := jobServer.SetJobError(job, jobError)
			expectErrorId(t, "app.job.update.app_error", err)
		})

		t.Run("status updated", func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)
			mockMetrics.On("DecrementJobActive", "job_type")

			err := jobServer.SetJobError(job, jobError)
			require.Nil(t, err)
		})

		t.Run("status updated, nil metrics service", func(t *testing.T) {
			jobServer, mockStore := makeTeamEditionJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)

			err := jobServer.SetJobError(job, jobError)
			require.Nil(t, err)
		})

		t.Run("status not updated, request cancellation, error setting status", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(nil, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(nil, &model.AppError{Message: "message"})

			err := jobServer.SetJobError(job, jobError)
			expectErrorId(t, "app.job.update.app_error", err)
		})

		t.Run("status not updated, request cancellation, status not updated", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(nil, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(nil, nil)

			err := jobServer.SetJobError(job, jobError)
			expectErrorId(t, "jobs.set_job_error.update.error", err)
		})

		t.Run("status not updated, request cancellation, status updated", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			jobError := &model.AppError{Message: "message"}

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{"error": jobError.Message},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(nil, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(job, nil)

			err := jobServer.SetJobError(job, jobError)
			require.Nil(t, err)
		})

		t.Run("error message set correctly", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			jobError := model.NewAppError("anywhere", "not.a.valid.id", nil, "details", http.StatusTeapot).Wrap(errors.New("wrapped"))

			job := &model.Job{
				Id:       "job_id",
				Type:     "job_type",
				Progress: -1,
				Data:     map[string]string{},
			}

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(nil, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(job, nil)

			err := jobServer.SetJobError(job, jobError)
			require.Nil(t, err)
			require.Equal(t, "not.a.valid.id — details — wrapped", job.Data["error"])
		})
	})
}

func TestSetJobCanceled(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusCanceled).Return(job, &model.AppError{Message: "message"})

		err := jobServer.SetJobCanceled(job)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("status updated", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusCanceled).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		err := jobServer.SetJobCanceled(job)
		require.Nil(t, err)
	})

	t.Run("status updated, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusCanceled).Return(job, nil)

		err := jobServer.SetJobCanceled(job)
		require.Nil(t, err)
	})
}

func TestUpdateInProgressJobData(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("error updating", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		job.Status = model.JobStatusInProgress

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(nil, &model.AppError{Message: "message"})

		err := jobServer.UpdateInProgressJobData(job)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("progress updated", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		job.Status = model.JobStatusInProgress

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)

		err := jobServer.UpdateInProgressJobData(job)
		require.Nil(t, err)
	})
}

func TestHandleJobPanic(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("no panic", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		jobServer, _, _ := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(logger, job)
			fmt.Println("OK")
		}

		require.NotPanics(t, f)
		require.Equal(t, model.JobStatusInProgress, job.Status)
	})

	t.Run("with panic string", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		jobServer, mockStore, metrics := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(logger, job)
			panic("not OK")
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)
		metrics.On("DecrementJobActive", model.JobTypeImportProcess)

		require.Panics(t, f)
		require.Equal(t, model.JobStatusError, job.Status)
	})

	t.Run("with panic error", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		jobServer, mockStore, metrics := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(logger, job)
			panic(fmt.Errorf("not OK"))
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)
		metrics.On("DecrementJobActive", model.JobTypeImportProcess)

		require.Panics(t, f)
		require.Equal(t, model.JobStatusError, job.Status)
	})
}

func TestRequestCancellation(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	ctx := request.TestContext(t)
	t.Run("error cancelling", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, &model.AppError{Message: "message"})

		err := jobServer.RequestCancellation(ctx, "job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("cancelled, job not found", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, errors.New("failed to update Job with id=job_id"))

		err := jobServer.RequestCancellation(ctx, "job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("cancelled, success", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		err := jobServer.RequestCancellation(ctx, "job_id")
		require.Nil(t, err)
	})

	t.Run("cancelled, success, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(job, nil)

		err := jobServer.RequestCancellation(ctx, "job_id")
		require.Nil(t, err)
	})

	t.Run("unable to cancel, requesting cancellation instead, error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, nil)
		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).
			Return(nil, &model.AppError{Message: "message"})

		err := jobServer.RequestCancellation(ctx, "job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("unable to cancel, requesting cancellation instead, success", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, nil)
		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).
			Return(job, nil)

		err := jobServer.RequestCancellation(ctx, "job_id")
		require.Nil(t, err)
	})

	t.Run("unable to cancel, requesting cancellation instead, unexpected state", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, nil)
		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).
			Return(nil, nil)

		err := jobServer.RequestCancellation(ctx, "job_id")
		expectErrorId(t, "jobs.request_cancellation.status.error", err)
	})
}

func assertPublishedJob(t *testing.T, captured *model.WebSocketEvent, expectedStatus string) {
	t.Helper()
	require.NotNil(t, captured, "expected publish to be called but it was not")
	require.Equal(t, model.WebsocketEventJobUpdated, captured.EventType())
	jobJSON, ok := captured.GetData()["job"].(string)
	require.True(t, ok, "expected 'job' data field to be a string")
	var published model.Job
	require.NoError(t, json.Unmarshal([]byte(jobJSON), &published))
	require.Equal(t, expectedStatus, published.Status)
}

func TestPublishJobStatus(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	t.Run("nil publish func does not panic", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		// publish is nil by default; must not panic
		job := &model.Job{Id: "job_id", Type: "job_type"}
		require.NotPanics(t, func() {
			jobServer.publishJobStatus(job, model.JobStatusSuccess)
		})
	})

	t.Run("broadcasts correct status", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{
			Id:     "job_id",
			Type:   "job_type",
			Status: model.JobStatusInProgress,
			Data:   map[string]string{"requesting_user_id": "user1", "policy_id": "pol1"},
		}
		jobServer.publishJobStatus(job, model.JobStatusSuccess)

		assertPublishedJob(t, captured, model.JobStatusSuccess)
	})

	t.Run("ClaimJob publishes in_progress", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}
		retJob := *job
		retJob.Status = model.JobStatusInProgress

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).
			Return(&retJob, nil)
		mockMetrics.On("IncrementJobActive", "job_type")

		_, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		assertPublishedJob(t, captured, model.JobStatusInProgress)
	})

	t.Run("SetJobWarning publishes warning", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}
		retJob := *job
		retJob.Status = model.JobStatusWarning

		mockStore.JobStore.
			On("UpdateStatus", "job_id", model.JobStatusWarning).
			Return(&retJob, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobWarning(job))
		assertPublishedJob(t, captured, model.JobStatusWarning)
	})

	t.Run("SetJobSuccess publishes success with DB timestamps", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		// in-memory job has no timestamps (simulates worker's working copy)
		job := &model.Job{Id: "job_id", Type: "job_type"}

		// DB returns full job with start_at and last_activity_at populated
		dbJob := &model.Job{
			Id:             "job_id",
			Type:           "job_type",
			Status:         model.JobStatusSuccess,
			StartAt:        1000,
			LastActivityAt: 2000,
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(dbJob, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobSuccess(job))

		assertPublishedJob(t, captured, model.JobStatusSuccess)
		jobJSON, _ := captured.GetData()["job"].(string)
		var published model.Job
		require.NoError(t, json.Unmarshal([]byte(jobJSON), &published))
		require.Equal(t, int64(1000), published.StartAt, "published job must use start_at from DB")
		require.Equal(t, int64(2000), published.LastActivityAt, "published job must use last_activity_at from DB")
	})

	t.Run("SetJobError nil jobError publishes error", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusError).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobError(job, nil))
		assertPublishedJob(t, captured, model.JobStatusError)
	})

	t.Run("SetJobError non-nil jobError publishes error", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		jobError := &model.AppError{Message: "something failed"}
		job := &model.Job{
			Id:       "job_id",
			Type:     "job_type",
			Progress: -1,
			Data:     map[string]string{"error": jobError.Message},
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobError(job, jobError))
		assertPublishedJob(t, captured, model.JobStatusError)
	})

	t.Run("SetJobCanceled publishes canceled", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusCanceled).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobCanceled(job))
		assertPublishedJob(t, captured, model.JobStatusCanceled)
	})

	t.Run("SetJobPending publishes pending", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusPending).Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.SetJobPending(job))
		assertPublishedJob(t, captured, model.JobStatusPending)
	})

	t.Run("SetJobProgress publishes in_progress", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{
			Id:       "job_id",
			Type:     "job_type",
			Status:   model.JobStatusInProgress,
			Progress: 50,
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(job, nil)

		require.Nil(t, jobServer.SetJobProgress(job, 50))
		assertPublishedJob(t, captured, model.JobStatusInProgress)
	})

	t.Run("RequestCancellation pending->canceled publishes canceled", func(t *testing.T) {
		ctx := request.TestContext(t)
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		require.Nil(t, jobServer.RequestCancellation(ctx, "job_id"))
		assertPublishedJob(t, captured, model.JobStatusCanceled)
	})

	t.Run("RequestCancellation in_progress->cancel_requested publishes cancel_requested", func(t *testing.T) {
		ctx := request.TestContext(t)
		jobServer, mockStore, _ := makeJobServer(t)
		var captured *model.WebSocketEvent
		jobServer.publish = func(ev *model.WebSocketEvent) { captured = ev }

		job := &model.Job{Id: "job_id", Type: "job_type"}

		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).
			Return(nil, nil)
		mockStore.JobStore.
			On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).
			Return(job, nil)

		require.Nil(t, jobServer.RequestCancellation(ctx, "job_id"))
		assertPublishedJob(t, captured, model.JobStatusCancelRequested)
	})
}
