// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type BatchMigrationWorkerAppIFace interface {
	GetClusterStatus(rctx request.CTX) []*model.ClusterInfo
}

// BatchMigrationWorker processes database migration jobs in batches to help avoid table locks.
//
// It uses the jobs infrastructure to ensure only one node in the cluster runs the migration at
// any given time, avoids running the migration until the cluster is uniform, and automatically
// resets the migration if the cluster version diverges after starting.
//
// In principle, the job infrastructure is overkill for this kind of work, as there's a worker
// created per migration. There's also complication with edge cases, like having to restart the
// server in order to retry a failed migration job. Refactoring the job infrastructure is left as
// a future exercise.
type BatchMigrationWorker struct {
	jobServer *JobServer
	logger    mlog.LoggerIFace
	store     store.Store
	app       BatchMigrationWorkerAppIFace

	stop    chan struct{}
	stopped chan bool
	closed  atomic.Bool
	jobs    chan model.Job

	migrationKey       string
	timeBetweenBatches time.Duration
	doMigrationBatch   func(data model.StringMap, store store.Store) (model.StringMap, bool, error)
}

// MakeBatchMigrationWorker creates a worker to process the given migration batch function.
func MakeBatchMigrationWorker(jobServer *JobServer, store store.Store, app BatchMigrationWorkerAppIFace, migrationKey string, timeBetweenBatches time.Duration, doMigrationBatch func(data model.StringMap, store store.Store) (model.StringMap, bool, error)) model.Worker {
	worker := &BatchMigrationWorker{
		jobServer:          jobServer,
		logger:             jobServer.Logger().With(mlog.String("worker_name", migrationKey)),
		store:              store,
		app:                app,
		stop:               make(chan struct{}),
		stopped:            make(chan bool, 1),
		jobs:               make(chan model.Job),
		migrationKey:       migrationKey,
		timeBetweenBatches: timeBetweenBatches,
		doMigrationBatch:   doMigrationBatch,
	}
	return worker
}

// Run starts the worker dedicated to the unique migration batch job it will be given to process.
func (worker *BatchMigrationWorker) Run() {
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
func (worker *BatchMigrationWorker) Stop() {
	// Set to close, and if already closed before, then return.
	if !worker.closed.CompareAndSwap(false, true) {
		return
	}

	worker.logger.Debug("Worker stopping")
	close(worker.stop)
	<-worker.stopped
}

// JobChannel is the means by which the jobs infrastructure provides the worker the job to execute.
func (worker *BatchMigrationWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

// IsEnabled is always true for batch migrations.
func (worker *BatchMigrationWorker) IsEnabled(_ *model.Config) bool {
	return true
}

// checkIsClusterInSync returns true if all nodes in the cluster are running the same version,
// logging a warning on the first mismatch found.
func (worker *BatchMigrationWorker) checkIsClusterInSync(rctx request.CTX) bool {
	clusterStatus := worker.app.GetClusterStatus(rctx)
	for i := 1; i < len(clusterStatus); i++ {
		if clusterStatus[i].SchemaVersion != clusterStatus[0].SchemaVersion {
			rctx.Logger().Warn(
				"Worker: cluster not in sync",
				mlog.String("schema_version_a", clusterStatus[0].SchemaVersion),
				mlog.String("schema_version_b", clusterStatus[1].SchemaVersion),
				mlog.String("server_ip_a", clusterStatus[0].IPAddress),
				mlog.String("server_ip_b", clusterStatus[1].IPAddress),
			)
			return false
		}
	}

	return true
}

// DoJob executes the job picked up through the job channel.
//
// Note that this is a lot of distracting machinery here to claim the job, then double check the
// status, and keep the status up to date in line with job infrastrcuture semantics. Unless an
// error occurs, this worker should hold onto the job until its completed.
func (worker *BatchMigrationWorker) DoJob(job *model.Job) {
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
			logger.Info("Worker: Migration has been canceled via Worker Stop. Setting the job back to pending.")
			if err := worker.jobServer.SetJobPending(job); err != nil {
				worker.logger.Error("Worker: Failed to mark job as pending", mlog.Err(err))
			}
			return
		case <-time.After(worker.timeBetweenBatches):
			// Ensure the cluster remains in sync, otherwise we restart the job to
			// ensure a complete migration. Technically, the cluster could go out of
			// sync briefly within a batch, but we accept that risk.
			if !worker.checkIsClusterInSync(c) {
				worker.logger.Warn("Worker: Resetting job")
				worker.resetJob(logger, job)
				return
			}

			nextData, done, err := worker.doMigrationBatch(job.Data, worker.store)
			if err != nil {
				worker.logger.Error("Worker: Failed to do migration batch. Exiting", mlog.Err(err))
				worker.setJobError(logger, job, model.NewAppError("doMigrationBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
				return
			} else if done {
				logger.Info("Worker: Job is complete")
				worker.setJobSuccess(logger, job)
				worker.markAsComplete()
				return
			}

			job.Data = nextData

			// Migrations currently don't support reporting meaningful progress.
			worker.jobServer.SetJobProgress(job, 0)
		}
	}
}

// resetJob erases the data tracking the next batch to execute and returns the job status to
// pending to allow the job infrastructure to requeue it.
func (worker *BatchMigrationWorker) resetJob(logger mlog.LoggerIFace, job *model.Job) {
	job.Data = nil
	job.Progress = 0
	job.Status = model.JobStatusPending

	if _, err := worker.store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err != nil {
		worker.logger.Error("Worker: Failed to reset job data. May resume instead of restarting.", mlog.Err(err))
	}
}

// setJobSuccess records the job as successful.
func (worker *BatchMigrationWorker) setJobSuccess(logger mlog.LoggerIFace, job *model.Job) {
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
func (worker *BatchMigrationWorker) setJobError(logger mlog.LoggerIFace, job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		logger.Error("Worker: Failed to set job error", mlog.Err(err))
	}
}

// markAsComplete records a discrete migration key to prevent this job from ever running again.
func (worker *BatchMigrationWorker) markAsComplete() {
	system := model.System{
		Name:  worker.migrationKey,
		Value: "true",
	}

	// Note that if this fails, then the job would have still succeeded. We will spuriously
	// run the job again in the future, but as migrations are idempotent it won't be an issue.
	if err := worker.jobServer.Store.System().Save(&system); err != nil {
		worker.logger.Error("Worker: Failed to mark migration as completed in the systems table.", mlog.String("migration_key", worker.migrationKey), mlog.Err(err))
	}
}
