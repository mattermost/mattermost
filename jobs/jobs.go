// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"context"
	"fmt"
	"time"

	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

const (
	CANCEL_WATCHER_POLLING_INTERVAL = 5000
)

func (srv *JobServer) CreateJob(jobType string, jobData map[string]string) (*model.Job, *model.AppError) {
	job := model.Job{
		Id:       model.NewId(),
		Type:     jobType,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_PENDING,
		Data:     jobData,
	}

	if err := job.IsValid(); err != nil {
		return nil, err
	}

	if result := <-srv.Store.Job().Save(&job); result.Err != nil {
		return nil, result.Err
	}

	return &job, nil
}

func (srv *JobServer) GetJob(id string) (*model.Job, *model.AppError) {
	if result := <-srv.Store.Job().Get(id); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Job), nil
	}
}

func (srv *JobServer) ClaimJob(job *model.Job) (bool, *model.AppError) {
	if result := <-srv.Store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		return false, result.Err
	} else {
		success := result.Data.(bool)
		return success, nil
	}
}

func (srv *JobServer) SetJobProgress(job *model.Job, progress int64) *model.AppError {
	job.Status = model.JOB_STATUS_IN_PROGRESS
	job.Progress = progress

	if result := <-srv.Store.Job().UpdateOptimistically(job, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		return result.Err
	} else {
		return nil
	}
}

func (srv *JobServer) SetJobSuccess(job *model.Job) *model.AppError {
	result := <-srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_SUCCESS)
	return result.Err
}

func (srv *JobServer) SetJobError(job *model.Job, jobError *model.AppError) *model.AppError {
	if jobError == nil {
		result := <-srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_ERROR)
		return result.Err
	}

	job.Status = model.JOB_STATUS_ERROR
	job.Progress = -1
	if job.Data == nil {
		job.Data = make(map[string]string)
	}
	job.Data["error"] = jobError.Message + " — " + jobError.DetailedError

	if result := <-srv.Store.Job().UpdateOptimistically(job, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		return result.Err
	} else {
		if !result.Data.(bool) {
			if result := <-srv.Store.Job().UpdateOptimistically(job, model.JOB_STATUS_CANCEL_REQUESTED); result.Err != nil {
				return result.Err
			} else {
				if !result.Data.(bool) {
					return model.NewAppError("Jobs.SetJobError", "jobs.set_job_error.update.error", nil, "id="+job.Id, http.StatusInternalServerError)
				}
			}
		}
	}

	return nil
}

func (srv *JobServer) SetJobCanceled(job *model.Job) *model.AppError {
	result := <-srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_CANCELED)
	return result.Err
}

func (srv *JobServer) UpdateInProgressJobData(job *model.Job) *model.AppError {
	job.Status = model.JOB_STATUS_IN_PROGRESS
	job.LastActivityAt = model.GetMillis()
	result := <-srv.Store.Job().UpdateOptimistically(job, model.JOB_STATUS_IN_PROGRESS)
	return result.Err
}

func (srv *JobServer) RequestCancellation(jobId string) *model.AppError {
	if result := <-srv.Store.Job().UpdateStatusOptimistically(jobId, model.JOB_STATUS_PENDING, model.JOB_STATUS_CANCELED); result.Err != nil {
		return result.Err
	} else if result.Data.(bool) {
		return nil
	}

	if result := <-srv.Store.Job().UpdateStatusOptimistically(jobId, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_CANCEL_REQUESTED); result.Err != nil {
		return result.Err
	} else if result.Data.(bool) {
		return nil
	}

	return model.NewAppError("Jobs.RequestCancellation", "jobs.request_cancellation.status.error", nil, "id="+jobId, http.StatusInternalServerError)
}

func (srv *JobServer) CancellationWatcher(ctx context.Context, jobId string, cancelChan chan interface{}) {
	for {
		select {
		case <-ctx.Done():
			mlog.Debug(fmt.Sprintf("CancellationWatcher for Job: %v Aborting as job has finished.", jobId))
			return
		case <-time.After(CANCEL_WATCHER_POLLING_INTERVAL * time.Millisecond):
			mlog.Debug(fmt.Sprintf("CancellationWatcher for Job: %v polling.", jobId))
			if result := <-srv.Store.Job().Get(jobId); result.Err == nil {
				jobStatus := result.Data.(*model.Job)
				if jobStatus.Status == model.JOB_STATUS_CANCEL_REQUESTED {
					close(cancelChan)
					return
				}
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
	if result := <-srv.Store.Job().GetCountByStatusAndType(model.JOB_STATUS_PENDING, jobType); result.Err != nil {
		return false, result.Err
	} else {
		return result.Data.(int64) > 0, nil
	}
}

func (srv *JobServer) GetLastSuccessfulJobByType(jobType string) (*model.Job, *model.AppError) {
	if result := <-srv.Store.Job().GetNewestJobByStatusAndType(model.JOB_STATUS_SUCCESS, jobType); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Job), nil
	}
}
