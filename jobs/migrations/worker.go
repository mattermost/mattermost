// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrations

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/v6/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
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
	store     store.Store
	closed    int32
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store) model.Worker {
	worker := Worker{
		name:      "Migrations",
		stop:      make(chan struct{}),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: jobServer,
		store:     store,
	}

	return &worker
}

func (worker *Worker) Run() {
	// Set to open if closed before. We are not bothered about multiple opens.
	if atomic.CompareAndSwapInt32(&worker.closed, 1, 0) {
		worker.stop = make(chan struct{})
	}
	mlog.Debug("Worker started", mlog.String("worker", worker.name))

	defer func() {
		mlog.Debug("Worker finished", mlog.String("worker", worker.name))
		worker.stopped <- true
	}()

	for {
		select {
		case <-worker.stop:
			mlog.Debug("Worker received stop signal", mlog.String("worker", worker.name))
			return
		case job := <-worker.jobs:
			mlog.Debug("Worker received a new candidate job.", mlog.String("worker", worker.name))
			worker.DoJob(&job)
		}
	}
}

func (worker *Worker) Stop() {
	// Set to close, and if already closed before, then return.
	if !atomic.CompareAndSwapInt32(&worker.closed, 0, 1) {
		return
	}
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
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
	defer worker.jobServer.HandleJobPanic(job)

	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		mlog.Info("Worker experienced an error while trying to claim job",
			mlog.String("worker", worker.name),
			mlog.String("job_id", job.Id),
			mlog.String("error", err.Error()))
		return
	} else if !claimed {
		return
	}

	cancelCtx, cancelCancelWatcher := context.WithCancel(context.Background())
	cancelWatcherChan := make(chan struct{}, 1)
	go worker.jobServer.CancellationWatcher(cancelCtx, job.Id, cancelWatcherChan)

	defer cancelCancelWatcher()

	for {
		select {
		case <-cancelWatcherChan:
			mlog.Debug("Worker: Job has been canceled via CancellationWatcher", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
			worker.setJobCanceled(job)
			return

		case <-worker.stop:
			mlog.Debug("Worker: Job has been canceled via Worker Stop", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
			worker.setJobCanceled(job)
			return

		case <-time.After(TimeBetweenBatches * time.Millisecond):
			done, progress, err := worker.runMigration(job.Data[JobDataKeyMigration], job.Data[JobDataKeyMigrationLastDone])
			if err != nil {
				mlog.Error("Worker: Failed to run migration", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
				worker.setJobError(job, err)
				return
			} else if done {
				mlog.Info("Worker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
				worker.setJobSuccess(job)
				return
			} else {
				job.Data[JobDataKeyMigrationLastDone] = progress
				if err := worker.jobServer.UpdateInProgressJobData(job); err != nil {
					mlog.Error("Worker: Failed to update migration status data for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
					worker.setJobError(job, err)
					return
				}
			}
		}
	}
}

func (worker *Worker) setJobSuccess(job *model.Job) {
	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		worker.setJobError(job, err)
	}
}

func (worker *Worker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (worker *Worker) setJobCanceled(job *model.Job) {
	if err := worker.jobServer.SetJobCanceled(job); err != nil {
		mlog.Error("Worker: Failed to mark job as canceled", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
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
