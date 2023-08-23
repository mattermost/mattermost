// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
)

type SimpleWorker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *JobServer
	logger    mlog.LoggerIFace
	execute   func(job *model.Job) error
	isEnabled func(cfg *model.Config) bool
}

func NewSimpleWorker(name string, jobServer *JobServer, execute func(job *model.Job) error, isEnabled func(cfg *model.Config) bool) *SimpleWorker {
	worker := SimpleWorker{
		name:      name,
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("workername", name)),
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
			job.Logger = job.Logger.With(mlog.String("workername", worker.name))

			job.Logger.Debug("Worker received a new candidate job")
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
	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		job.Logger.Warn("SimpleWorker experienced an error while trying to claim job", mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	c := request.EmptyContext(worker.logger)

	var appErr *model.AppError
	// We get the job again because ClaimJob changes the job status.
	job, appErr = worker.jobServer.GetJob(c, job.Id)
	if appErr != nil {
		job.Logger.Error("SimpleWorker: job execution error", mlog.Err(appErr))
		worker.setJobError(job, appErr)
	}

	err := worker.execute(job)
	if err != nil {
		job.Logger.Error("SimpleWorker: job execution error", mlog.Err(err))
		worker.setJobError(job, model.NewAppError("DoJob", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	job.Logger.Info("SimpleWorker: Job is complete")
	worker.setJobSuccess(job)
}

func (worker *SimpleWorker) setJobSuccess(job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		job.Logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		job.Logger.Error("SimpleWorker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(job, err)
	}
}

func (worker *SimpleWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		job.Logger.Error("SimpleWorker: Failed to set job error", mlog.Err(err))
	}
}
