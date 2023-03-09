// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
	"github.com/mattermost/mattermost-server/v6/server/channels/store/storetest"
	"github.com/mattermost/mattermost-server/v6/server/channels/utils/testutils"
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

	jobServer := NewJobServer(configService, mockStore, nil)

	return jobServer, mockStore
}

func TestClaimJob(t *testing.T) {
	t.Run("error claiming job", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(false, &model.AppError{Message: "message"})

		updated, err := jobServer.ClaimJob(job)
		expectErrorId(t, "app.job.update.app_error", err)
		require.False(t, updated)
	})

	t.Run("no existing job to update", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(false, nil)

		updated, err := jobServer.ClaimJob(job)
		require.Nil(t, err)
		require.False(t, updated)
	})

	t.Run("pending job updated", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)
		mockMetrics.On("IncrementJobActive", "job_type")

		updated, err := jobServer.ClaimJob(job)
		require.Nil(t, err)
		require.True(t, updated)
	})

	t.Run("pending job updated, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)

		updated, err := jobServer.ClaimJob(job)
		require.Nil(t, err)
		require.True(t, updated)
	})
}

func TestSetJobProgress(t *testing.T) {
	t.Run("error setting progress", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		progress := int64(50)
		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		job.Status = model.JobStatusInProgress
		job.Progress = progress

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, &model.AppError{Message: "message"})

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

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)

		err := jobServer.SetJobProgress(job, progress)
		require.Nil(t, err)
	})
}

func TestSetJobWarning(t *testing.T) {
	t.Run("error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusWarning).Return(job, &model.AppError{Message: "message"})

		err := jobServer.SetJobWarning(job)
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("status updated", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusWarning).Return(job, nil)

		err := jobServer.SetJobWarning(job)
		require.Nil(t, err)
	})
}

func TestSetJobSuccess(t *testing.T) {
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
	t.Run("nil provided job error", func(t *testing.T) {
		t.Run("error setting status", func(t *testing.T) {
			jobServer, mockStore, _ := makeJobServer(t)

			job := &model.Job{
				Id:   "job_id",
				Type: "job_type",
			}

			mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusError).Return(job, &model.AppError{Message: "message"})

			err := jobServer.SetJobError(job, nil)
			expectErrorId(t, "app.job.update.app_error", err)
		})

		t.Run("status updated", func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)

			job := &model.Job{
				Id:   "job_id",
				Type: "job_type",
			}

			mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusError).Return(job, nil)
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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, &model.AppError{Message: "message"})

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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)
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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)

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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(false, &model.AppError{Message: "message"})

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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(false, nil)

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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(true, nil)

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

			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, nil)
			mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusCancelRequested).Return(true, nil)

			err := jobServer.SetJobError(job, jobError)
			require.Nil(t, err)
			require.Equal(t, "not.a.valid.id — details — wrapped", job.Data["error"])
		})
	})
}

func TestSetJobCanceled(t *testing.T) {
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
	t.Run("error updating", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		job.Status = model.JobStatusInProgress

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(false, &model.AppError{Message: "message"})

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

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)

		err := jobServer.UpdateInProgressJobData(job)
		require.Nil(t, err)
	})
}

func TestHandleJobPanic(t *testing.T) {
	t.Run("no panic", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(job)
			fmt.Println("OK")
		}

		require.NotPanics(t, f)
		require.Equal(t, model.JobStatusInProgress, job.Status)
	})

	t.Run("with panic string", func(t *testing.T) {
		jobServer, mockStore, metrics := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(job)
			panic("not OK")
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)
		metrics.On("DecrementJobActive", model.JobTypeImportProcess)

		require.Panics(t, f)
		require.Equal(t, model.JobStatusError, job.Status)
	})

	t.Run("with panic error", func(t *testing.T) {
		jobServer, mockStore, metrics := makeJobServer(t)

		job := &model.Job{
			Type:   model.JobTypeImportProcess,
			Status: model.JobStatusInProgress,
		}

		f := func() {
			defer jobServer.HandleJobPanic(job)
			panic(fmt.Errorf("not OK"))
		}

		mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)
		metrics.On("DecrementJobActive", model.JobTypeImportProcess)

		require.Panics(t, f)
		require.Equal(t, model.JobStatusError, job.Status)
	})
}

func TestRequestCancellation(t *testing.T) {
	t.Run("error cancelling", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(false, &model.AppError{Message: "message"})

		err := jobServer.RequestCancellation("job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("cancelled, job not found", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(true, nil)
		mockStore.JobStore.On("Get", "job_id").Return(nil, &store.ErrNotFound{})

		err := jobServer.RequestCancellation("job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("cancelled, success", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)

		job := &model.Job{
			Id:   "job_id",
			Type: "job_type",
		}

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(true, nil)
		mockStore.JobStore.On("Get", "job_id").Return(job, nil)
		mockMetrics.On("DecrementJobActive", "job_type")

		err := jobServer.RequestCancellation("job_id")
		require.Nil(t, err)
	})

	t.Run("cancelled, success, nil metrics service", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(true, nil)

		err := jobServer.RequestCancellation("job_id")
		require.Nil(t, err)
	})

	t.Run("unable to cancel, requesting cancellation instead, error setting status", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(false, nil)
		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).Return(false, &model.AppError{Message: "message"})

		err := jobServer.RequestCancellation("job_id")
		expectErrorId(t, "app.job.update.app_error", err)
	})

	t.Run("unable to cancel, requesting cancellation instead, success", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(false, nil)
		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).Return(true, nil)

		err := jobServer.RequestCancellation("job_id")
		require.Nil(t, err)
	})

	t.Run("unable to cancel, requesting cancellation instead, unexpected state", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusCanceled).Return(false, nil)
		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusInProgress, model.JobStatusCancelRequested).Return(false, nil)

		err := jobServer.RequestCancellation("job_id")
		expectErrorId(t, "jobs.request_cancellation.status.error", err)
	})
}
