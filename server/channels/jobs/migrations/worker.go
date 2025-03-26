// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	TimeBetweenBatches = 100
)

type Worker struct {
	name      string
	stop      chan struct{}
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	logger    mlog.LoggerIFace
	store     store.Store
	closed    int32
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store) *Worker {
	const workerName = "Migrations"
	worker := Worker{
		name:      workerName,
		stop:      make(chan struct{}),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		logger:    jobServer.Logger().With(mlog.String("worker_name", workerName)),
		store:     store,
	}

	return &worker
}

func (worker *Worker) Run() {
	// Set to open if closed before. We are not bothered about multiple opens.
	if atomic.CompareAndSwapInt32(&worker.closed, 1, 0) {
		worker.stop = make(chan struct{})
	}
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
	// Set to close, and if already closed before, then return.
	if !atomic.CompareAndSwapInt32(&worker.closed, 0, 1) {
		return
	}
	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stopped
}

func (worker *Worker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *Worker) IsEnabled(_ *model.Config) bool {
	return true
}

func (worker *Worker) DoJob(job *model.Job) {
	logger := worker.logger.With(jobs.JobLoggerFields(job)...)
	logger.Debug("Worker: Received a new candidate job.")

	defer worker.jobServer.HandleJobPanic(logger, job)

	var appErr *model.AppError
	job, appErr = worker.jobServer.ClaimJob(job)
	if appErr != nil {
		logger.Warn("Worker experienced an error while trying to claim job", mlog.Err(appErr))
		return
	} else if job == nil {
		return
	}

	var cancelContext request.CTX = request.EmptyContext(worker.logger)
	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	cancelContext = cancelContext.WithContext(cancelCtx)
	go worker.jobServer.CancellationWatcher(cancelContext, job.Id, cancelWatcherChan)
	defer cancelCancelWatcher()

	for {
		select {
		case <-cancelWatcherChan:
			logger.Debug("Worker: Job has been canceled via CancellationWatcher")
			worker.setJobCanceled(logger, job)
			return

		case <-worker.stop:
			logger.Debug("Worker: Job has been canceled via Worker Stop")
			worker.setJobCanceled(logger, job)
			return

		case <-time.After(TimeBetweenBatches * time.Millisecond):
			done, progress, err := worker.runMigration(job.Data[JobDataKeyMigration], job.Data[JobDataKeyMigrationLastDone])
			if err != nil {
				logger.Error("Worker: Failed to run migration", mlog.Err(err))
				worker.setJobError(logger, job, err)
				return
			} else if done {
				logger.Info("Worker: Job is complete")
				worker.setJobSuccess(logger, job)
				return
			} else {
				job.Data[JobDataKeyMigrationLastDone] = progress
				if err := worker.jobServer.UpdateInProgressJobData(job); err != nil {
					logger.Error("Worker: Failed to update migration status data for job", mlog.Err(err))
					worker.setJobError(logger, job, err)
					return
				}
			}
		}
	}
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

func (worker *Worker) setJobCanceled(logger mlog.LoggerIFace, job *model.Job) {
	if err := worker.jobServer.SetJobCanceled(job); err != nil {
		logger.Error("Worker: Failed to mark job as canceled", mlog.Err(err))
	}
}

// Return parameters:
// - whether the migration is completed on this run (true) or still incomplete (false).
// - the updated lastDone string for the migration.
// - any error which may have occurred while running the migration.
func (worker *Worker) runMigration(key string, lastDone string) (bool, string, *model.AppError) {
	var done bool
	var progress string
	var err *model.AppError

	switch key {
	case model.MigrationKeyAdvancedPermissionsPhase2:
		done, progress, err = worker.runAdvancedPermissionsPhase2Migration(lastDone)
	default:
		return false, "", model.NewAppError("MigrationsWorker.runMigration", "migrations.worker.run_migration.unknown_key", map[string]any{"key": key}, "", http.StatusInternalServerError)
	}

	if done {
		if nErr := worker.store.System().Save(&model.System{Name: key, Value: "true"}); nErr != nil {
			return false, "", model.NewAppError("runMigration", "migrations.system.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return done, progress, err
}
