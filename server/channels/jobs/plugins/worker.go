// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugins

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

type AppIface interface {
	DeleteAllExpiredPluginKeys() *model.AppError
}

type Worker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	logger    mlog.LoggerIFace
	app       AppIface
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *Worker {
	const workerName = "Plugins"
	worker := Worker{
		name:      workerName,
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", workerName)),
		app:       app,
	}

	return &worker
}

func (worker *Worker) Run() {
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

func (worker *Worker) Stop() {
	worker.logger.Debug("Worker stopping")
	worker.stop <- true
	<-worker.stopped
}

func (worker *Worker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *Worker) IsEnabled(cfg *model.Config) bool {
	return true
}

func (worker *Worker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker experienced an error while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	if err := worker.app.DeleteAllExpiredPluginKeys(); err != nil {
		logger.Error("Worker: Failed to delete expired keys", mlog.Err(err))
		worker.setJobError(logger, job, err)
		return
	}

	logger.Info("Worker: Job is complete")
	worker.setJobSuccess(logger, job)
}

func (worker *Worker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *Worker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}
