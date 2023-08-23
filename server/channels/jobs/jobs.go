// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"fmt"
	"net/http"
	"runtime/pprof"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	CancelWatcherPollingInterval = 5000
)

func (srv *JobServer) CreateJob(c *request.Context, jobType string, jobData map[string]string) (*model.Job, *model.AppError) {
	job, appErr := srv._createJob(c, jobType, jobData)
	if appErr != nil {
		return nil, appErr
	}

	if _, err := srv.Store.Job().Save(job); err != nil {
		return nil, model.NewAppError("CreateJob", "app.job.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return job, nil
}

func (srv *JobServer) CreateJobOnce(c *request.Context, jobType string, jobData map[string]string) (*model.Job, *model.AppError) {
	job, appErr := srv._createJob(c, jobType, jobData)
	if appErr != nil {
		return nil, appErr
	}

	if _, err := srv.Store.Job().SaveOnce(job); err != nil {
		return nil, model.NewAppError("CreateJob", "app.job.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return job, nil
}

func (srv *JobServer) _createJob(c *request.Context, jobType string, jobData map[string]string) (*model.Job, *model.AppError) {
	job := model.Job{
		Id:       model.NewId(),
		Type:     jobType,
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Data:     jobData,
	}

	job.InitLogger(c.Logger())

	if err := job.IsValid(); err != nil {
		return nil, err
	}

	if srv.workers.Get(job.Type) == nil {
		return nil, model.NewAppError("Job.IsValid", "model.job.is_valid.type.app_error", nil, "id="+job.Id, http.StatusBadRequest)
	}

	return &job, nil
}

func (srv *JobServer) GetJob(c *request.Context, id string) (*model.Job, *model.AppError) {
	job, err := srv.Store.Job().Get(c, id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetJob", "app.job.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return job, nil
}

func (srv *JobServer) ClaimJob(job *model.Job) (bool, *model.AppError) {
	updated, err := srv.Store.Job().UpdateStatusOptimistically(job.Id, model.JobStatusPending, model.JobStatusInProgress)
	if err != nil {
		return false, model.NewAppError("ClaimJob", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if updated && srv.metrics != nil {
		srv.metrics.IncrementJobActive(job.Type)
	}

	return updated, nil
}

func (srv *JobServer) SetJobProgress(job *model.Job, progress int64) *model.AppError {
	job.Status = model.JobStatusInProgress
	job.Progress = progress

	if _, err := srv.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		return model.NewAppError("SetJobProgress", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (srv *JobServer) SetJobWarning(job *model.Job) *model.AppError {
	if _, err := srv.Store.Job().UpdateStatus(job.Id, model.JobStatusWarning); err != nil {
		return model.NewAppError("SetJobWarning", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (srv *JobServer) SetJobSuccess(job *model.Job) *model.AppError {
	if _, err := srv.Store.Job().UpdateStatus(job.Id, model.JobStatusSuccess); err != nil {
		return model.NewAppError("SetJobSuccess", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if srv.metrics != nil {
		srv.metrics.DecrementJobActive(job.Type)
	}

	return nil
}

func (srv *JobServer) SetJobError(job *model.Job, jobError *model.AppError) *model.AppError {
	if jobError == nil {
		_, err := srv.Store.Job().UpdateStatus(job.Id, model.JobStatusError)
		if err != nil {
			return model.NewAppError("SetJobError", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if srv.metrics != nil {
			srv.metrics.DecrementJobActive(job.Type)
		}

		return nil
	}

	job.Status = model.JobStatusError
	job.Progress = -1
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	job.Data["error"] = jobError.Message
	if jobError.DetailedError != "" {
		job.Data["error"] += " — " + jobError.DetailedError
	}
	if wrapped := jobError.Unwrap(); wrapped != nil {
		job.Data["error"] += " — " + wrapped.Error()
	}
	updated, err := srv.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress)
	if err != nil {
		return model.NewAppError("SetJobError", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if updated && srv.metrics != nil {
		srv.metrics.DecrementJobActive(job.Type)
	}

	if !updated {
		updated, err = srv.Store.Job().UpdateOptimistically(job, model.JobStatusCancelRequested)
		if err != nil {
			return model.NewAppError("SetJobError", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if !updated {
			return model.NewAppError("SetJobError", "jobs.set_job_error.update.error", nil, "id="+job.Id, http.StatusInternalServerError)
		}
	}

	return nil
}

func (srv *JobServer) SetJobCanceled(job *model.Job) *model.AppError {
	if _, err := srv.Store.Job().UpdateStatus(job.Id, model.JobStatusCanceled); err != nil {
		return model.NewAppError("SetJobCanceled", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if srv.metrics != nil {
		srv.metrics.DecrementJobActive(job.Type)
	}

	return nil
}

func (srv *JobServer) SetJobPending(job *model.Job) *model.AppError {
	if _, err := srv.Store.Job().UpdateStatus(job.Id, model.JobStatusPending); err != nil {
		return model.NewAppError("SetJobPending", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if srv.metrics != nil {
		srv.metrics.DecrementJobActive(job.Type)
	}

	return nil
}

func (srv *JobServer) UpdateInProgressJobData(job *model.Job) *model.AppError {
	job.Status = model.JobStatusInProgress
	job.LastActivityAt = model.GetMillis()
	if _, err := srv.Store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		return model.NewAppError("UpdateInProgressJobData", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// HandleJobPanic is used to handle panics during the execution of a job. It logs the panic and sets the status for the job.
// After handling, the method repanics! This method is supposed to be `defer`'d at the start of the job.
func (srv *JobServer) HandleJobPanic(job *model.Job) {
	r := recover()
	if r == nil {
		return
	}

	sb := &strings.Builder{}
	pprof.Lookup("goroutine").WriteTo(sb, 2)
	job.Logger.Error("Unhandled panic in job", mlog.Any("panic", r), mlog.Any("job", job), mlog.String("stack", sb.String()))

	rerr, ok := r.(error)
	if !ok {
		rerr = fmt.Errorf("job panic: %v", r)
	}

	appErr := srv.SetJobError(job, model.NewAppError("HandleJobPanic", "app.job.update.app_error", nil, "", http.StatusInternalServerError)).Wrap(rerr)
	if appErr != nil {
		job.Logger.Error("Failed to set the job status to 'failed'", mlog.Err(appErr), mlog.Any("job", job))
	}

	panic(r)
}

func (srv *JobServer) RequestCancellation(c *request.Context, jobId string) *model.AppError {
	updated, err := srv.Store.Job().UpdateStatusOptimistically(jobId, model.JobStatusPending, model.JobStatusCanceled)
	if err != nil {
		return model.NewAppError("RequestCancellation", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if updated {
		if srv.metrics != nil {
			job, err := srv.GetJob(c, jobId)
			if err != nil {
				return model.NewAppError("RequestCancellation", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			srv.metrics.DecrementJobActive(job.Type)
		}

		return nil
	}

	updated, err = srv.Store.Job().UpdateStatusOptimistically(jobId, model.JobStatusInProgress, model.JobStatusCancelRequested)
	if err != nil {
		return model.NewAppError("RequestCancellation", "app.job.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if updated {
		return nil
	}

	return model.NewAppError("RequestCancellation", "jobs.request_cancellation.status.error", nil, "id="+jobId, http.StatusInternalServerError)
}

func (srv *JobServer) CancellationWatcher(c *request.Context, jobId string, cancelChan chan struct{}) {
	for {
		select {
		case <-c.Context().Done():
			c.Logger().Debug("CancellationWatcher for Job Aborting as job has finished.", mlog.String("job_id", jobId))
			return
		case <-time.After(CancelWatcherPollingInterval * time.Millisecond):
			c.Logger().Debug("CancellationWatcher for Job started polling.", mlog.String("job_id", jobId))
			jobStatus, err := srv.Store.Job().Get(c, jobId)
			if err != nil {
				c.Logger().Warn("Error getting job", mlog.String("job_id", jobId), mlog.Err(err))
				continue
			}
			if jobStatus.Status == model.JobStatusCancelRequested {
				close(cancelChan)
				return
			}
		}
	}
}

func GenerateNextStartDateTime(now time.Time, nextStartTime time.Time) *time.Time {
	nextTime := time.Date(now.Year(), now.Month(), now.Day(), nextStartTime.Hour(), nextStartTime.Minute(), 0, 0, time.Local)

	if !now.Before(nextTime) {
		nextTime = nextTime.AddDate(0, 0, 1)
	}

	return &nextTime
}

func (srv *JobServer) CheckForPendingJobsByType(jobType string) (bool, *model.AppError) {
	count, err := srv.Store.Job().GetCountByStatusAndType(model.JobStatusPending, jobType)
	if err != nil {
		return false, model.NewAppError("CheckForPendingJobsByType", "app.job.get_count_by_status_and_type.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return count > 0, nil
}

func (srv *JobServer) GetJobsByTypeAndStatus(c *request.Context, jobType string, status string) ([]*model.Job, *model.AppError) {
	jobs, err := srv.Store.Job().GetAllByTypeAndStatus(c, jobType, status)
	if err != nil {
		return nil, model.NewAppError("GetJobsByTypeAndStatus", "app.job.get_all_jobs_by_type_and_status.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return jobs, nil
}

func (srv *JobServer) GetLastSuccessfulJobByType(jobType string) (*model.Job, *model.AppError) {
	statuses := []string{model.JobStatusSuccess}
	if jobType == model.JobTypeMessageExport {
		statuses = []string{model.JobStatusWarning, model.JobStatusSuccess}
	}
	job, err := srv.Store.Job().GetNewestJobByStatusesAndType(statuses, jobType)
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return nil, model.NewAppError("GetLastSuccessfulJobByType", "app.job.get_newest_job_by_status_and_type.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return job, nil
}
