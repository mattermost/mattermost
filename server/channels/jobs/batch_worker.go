// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type BatchWorker struct {
	jobServer *JobServer
	logger    mlog.LoggerIFace
	store     store.Store

	stop    chan struct{}
	stopped chan bool
	closed  atomic.Bool
	jobs    chan model.Job

	timeBetweenBatches time.Duration
	doBatch            func(rctx *request.Context, job *model.Job) bool
}

// MakeBatchWorker creates a worker to process the given batch function.
func MakeBatchWorker(
	jobServer *JobServer,
	store store.Store,
	timeBetweenBatches time.Duration,
	doBatch func(rctx *request.Context, job *model.Job) bool,
	onComplete func(),
) model.Worker {
	worker := &BatchWorker{
		jobServer:          jobServer,
		logger:             jobServer.Logger(),
		store:              store,
		stop:               make(chan struct{}),
		stopped:            make(chan bool, 1),
		jobs:               make(chan model.Job),
		timeBetweenBatches: timeBetweenBatches,
		doBatch:            doBatch,
	}
	return worker
}

// Run starts the worker dedicated to the unique migration batch job it will be given to process.
func (worker *BatchWorker) Run() {
	worker.logger.Debug("Worker started")
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	if worker.closed.CompareAndSwap(true, false) {
		worker.stop = make(chan struct{})
	}

	defer func() {
		worker.logger.Debug("Worker finished")
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			worker.logger.Debug("Worker received stop signal")
			return
		case job := <-worker.jobs:
			worker.DoJob(&job)
		}
	}
}

// Stop interrupts the worker even if the migration has not yet completed.
func (worker *BatchWorker) Stop() {
	// Set to close, and if already closed before, then return.
	if !worker.closed.CompareAndSwap(false, true) {
		return
	}

	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stopped
}

// JobChannel is the means by which the jobs infrastructure provides the worker the job to execute.
func (worker *BatchWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

// IsEnabled is always true for batches.
func (worker *BatchWorker) IsEnabled(_ *model.Config) bool {
	return true
}

// DoJob executes the job picked up through the job channel.
//
// Note that this is a lot of distracting machinery here to claim the job, then double check the
// status, and keep the status up to date in line with job infrastrcuture semantics. Unless an
// error occurs, this worker should hold onto the job until its completed.
func (worker *BatchWorker) DoJob(job *model.Job) {
	logger := worker.logger.With(mlog.Any("job", job))
	logger.Debug("Worker received a new candidate job.")
	defer worker.jobServer.HandleJobPanic(logger, job)

	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		logger.Warn("Worker experienced an error while trying to claim job", mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	c := request.EmptyContext(logger)
	var appErr *model.AppError

	// We get the job again because ClaimJob changes the job status.
	job, appErr = worker.jobServer.GetJob(c, job.Id)
	if appErr != nil {
		worker.logger.Error("Worker: job execution error", mlog.Err(appErr))
		worker.setJobError(logger, job, appErr)
		return
	}

	if job.Data == nil {
		job.Data = make(model.StringMap)
	}

	for {
		select {
		case <-worker.stop:
			logger.Info("Worker: Batch has been canceled via Worker Stop. Setting the job back to pending.")
			if err := worker.jobServer.SetJobPending(job); err != nil {
				worker.logger.Error("Worker: Failed to mark job as pending", mlog.Err(err))
			}
			return
		case <-time.After(worker.timeBetweenBatches):
			if stop := worker.doBatch(c, job); stop {
				return
			}
		}
	}
}

// resetJob erases the data tracking the next batch to execute and returns the job status to
// pending to allow the job infrastructure to requeue it.
func (worker *BatchWorker) resetJob(logger mlog.LoggerIFace, job *model.Job) {
	job.Data = nil
	job.Progress = 0
	job.Status = model.JobStatusPending

	if _, err := worker.store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		worker.logger.Error("Worker: Failed to reset job data. May resume instead of restarting.", mlog.Err(err))
	}
}

// setJobSuccess records the job as successful.
func (worker *BatchWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

// setJobError puts the job into an error state, preventing the job from running again.
func (worker *BatchWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}
