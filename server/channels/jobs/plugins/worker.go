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

func MakeWorker(jobServer *jobs.JobServer, app AppIface) model.Worker {
	const workerName = "Plugins"
	worker := Worker{
		name:      "Plugins",
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("workername", workerName)),
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
			job.Logger = job.Logger.With(mlog.String("workername", worker.name))

			job.Logger.Debug("Worker received a new candidate job")
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
	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		job.Logger.Info("Worker experienced an error while trying to claim job", mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	if err := worker.app.DeleteAllExpiredPluginKeys(); err != nil {
		job.Logger.Error("Worker: Failed to delete expired keys", mlog.Err(err))
		worker.setJobError(job, err)
		return
	}

	job.Logger.Info("Worker: Job is complete")
	worker.setJobSuccess(job)
}

func (worker *Worker) setJobSuccess(job *model.Job) {
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		job.Logger.Error("Worker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(job, err)
	}
}

func (worker *Worker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		job.Logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}
