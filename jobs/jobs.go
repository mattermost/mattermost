// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jobs

import (
	"context"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
)

const (
	CANCEL_WATCHER_POLLING_INTERVAL = 5000
)

func CreateJob(jobType string, jobData map[string]interface{}) (*model.Job, *model.AppError) {
	job := model.Job{
		Id:       model.NewId(),
		Type:     jobType,
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_PENDING,
		Data:     jobData,
	}

	if result := <-Srv.Store.Job().Save(&job); result.Err != nil {
		return nil, result.Err
	}

	return &job, nil
}

func ClaimJob(job *model.Job) (bool, *model.AppError) {
	if result := <-Srv.Store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		return false, result.Err
	} else {
		success := result.Data.(bool)
		return success, nil
	}
}

func SetJobProgress(jobId string, progress int64) (bool, *model.AppError) {
	var job *model.Job

	if result := <-Srv.Store.Job().Get(jobId); result.Err != nil {
		return false, result.Err
	} else {
		job = result.Data.(*model.Job)
	}

	job.Status = model.JOB_STATUS_IN_PROGRESS
	job.Progress = progress

	if result := <-Srv.Store.Job().UpdateOptimistically(job, model.JOB_STATUS_IN_PROGRESS); result.Err != nil {
		return false, result.Err
	} else {
		if !result.Data.(bool) {
			return false, nil
		}
	}

	return true, nil
}

func SetJobSuccess(job *model.Job) *model.AppError {
	result := <-Srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_SUCCESS)
	return result.Err
}

func SetJobError(job *model.Job) *model.AppError {
	result := <-Srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_ERROR)
	return result.Err
}

func SetJobCanceled(job *model.Job) *model.AppError {
	result := <-Srv.Store.Job().UpdateStatus(job.Id, model.JOB_STATUS_CANCELED)
	return result.Err
}

func RequestCancellation(job *model.Job) *model.AppError {
	if result := <-Srv.Store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_PENDING, model.JOB_STATUS_CANCELED); result.Err != nil {
		return result.Err
	} else if result.Data.(bool) {
		return nil
	}

	if result := <-Srv.Store.Job().UpdateStatusOptimistically(job.Id, model.JOB_STATUS_IN_PROGRESS, model.JOB_STATUS_CANCEL_REQUESTED); result.Err != nil {
		return result.Err
	} else if result.Data.(bool) {
		return nil
	}

	return model.NewLocAppError("Jobs.RequestCancellation", "jobs.request_cancellation.status.error", nil, "id=" + job.Id)
}

func CancellationWatcher(ctx context.Context, jobId string, cancelChan chan interface{}) {
	for {
		select {
		case <-ctx.Done():
			l4g.Debug("CancellationWatcher for Job: %v Aborting as job has finished.", jobId)
			return
		case <-time.After(CANCEL_WATCHER_POLLING_INTERVAL * time.Millisecond):
			l4g.Debug("CancellationWatcher for Job: %v polling.", jobId)
			if result := <-Srv.Store.Job().Get(jobId); result.Err == nil {
				jobStatus := result.Data.(*model.Job)
				if jobStatus.Status == model.JOB_STATUS_CANCEL_REQUESTED {
					close(cancelChan)
					return
				}
			}
		}
	}
}
