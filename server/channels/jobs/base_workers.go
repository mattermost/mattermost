// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type SimpleWorker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *JobServer
	logger    mlog.LoggerIFace
	execute   func(logger mlog.LoggerIFace, job *model.Job) error
	isEnabled func(cfg *model.Config) bool
}

func NewSimpleWorker(name string, jobServer *JobServer, execute func(logger mlog.LoggerIFace, job *model.Job) error, isEnabled func(cfg *model.Config) bool) *SimpleWorker {
	worker := SimpleWorker{
		name:      name,
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", name)),
		execute:   execute,
		isEnabled: isEnabled,
	}
	return &worker
}

func (worker *SimpleWorker) Run() {
	worker.logger.Debug("Worker started")

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

func (worker *SimpleWorker) Stop() {
	worker.logger.Debug("Worker stopping")
	worker.stop <- true
	<-worker.stopped
}

func (worker *SimpleWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *SimpleWorker) IsEnabled(cfg *model.Config) bool {
	return worker.isEnabled(cfg)
}

func (worker *SimpleWorker) DoJob(job *model.Job) {
	claimAndExecuteJob(worker.jobServer, worker.logger, "SimpleWorker", job, worker.execute)
}

// claimAndExecuteJob claims the given candidate job and, when the claim wins,
// runs execute and records success or failure. It is shared by SimpleWorker
// and PoolWorker; workerKind only customizes log messages so each worker
// type's log output is unchanged.
func claimAndExecuteJob(jobServer *JobServer, logger mlog.LoggerIFace, workerKind string, job *model.Job, execute func(logger mlog.LoggerIFace, job *model.Job) error) {
	logger = logger.With(JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	var appErr *model.AppError
	job, appErr = jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn(workerKind+" experienced an error while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	err := execute(logger, job)
	if err != nil {
		logger.Error(workerKind+": job execution error", mlog.Err(err))
		setWorkerJobError(jobServer, logger, workerKind, job, model.NewAppError("DoJob", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	logger.Debug(workerKind + ": Job is complete")
	setWorkerJobSuccess(jobServer, logger, workerKind, job)
}

func setWorkerJobSuccess(jobServer *JobServer, logger mlog.LoggerIFace, workerKind string, job *model.Job) {
	if err := jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		setWorkerJobError(jobServer, logger, workerKind, job, err)
		return
	}

	if err := jobServer.SetJobSuccess(job); err != nil {
		logger.Error(workerKind+": Failed to set success for job", mlog.Err(err))
		setWorkerJobError(jobServer, logger, workerKind, job, err)
	}
}

func setWorkerJobError(jobServer *JobServer, logger mlog.LoggerIFace, workerKind string, job *model.Job, appError *model.AppError) {
	if err := jobServer.SetJobError(job, appError); err != nil {
		logger.Error(workerKind+": Failed to set job error", mlog.Err(err))
	}
}
