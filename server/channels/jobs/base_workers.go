// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
	logger := worker.logger.With(JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		logger.Warn("SimpleWorker experienced an error while trying to claim job", mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	c := request.EmptyContext(worker.logger)

	// We get the job again because ClaimJob changes the job status.
	newJob, appErr := worker.jobServer.GetJob(c, job.Id)
	if appErr != nil {
		logger.Error("SimpleWorker: job execution error", mlog.Err(appErr))
		worker.setJobError(logger, job, appErr)
		return
	}
	job = newJob

	err := worker.execute(logger, job)
	if err != nil {
		logger.Error("SimpleWorker: job execution error", mlog.Err(err))
		worker.setJobError(logger, job, model.NewAppError("DoJob", "app.job.error", nil, "", http.StatusInternalServerError).Wrap(err))
		return
	}

	logger.Info("SimpleWorker: Job is complete")
	worker.setJobSuccess(logger, job)
}

func (worker *SimpleWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		logger.Error("Worker: Failed to update progress for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		logger.Error("SimpleWorker: Failed to set success for job", mlog.Err(err))
		worker.setJobError(logger, job, err)
	}
}

func (worker *SimpleWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("SimpleWorker: Failed to set job error", mlog.Err(err))
	}
}
