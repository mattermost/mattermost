// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"net/http"
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
	*BatchWorker
	app              BatchMigrationWorkerAppIFace
	migrationKey     string
	doMigrationBatch func(data model.StringMap, store store.Store) (model.StringMap, bool, error)
}

// MakeBatchMigrationWorker creates a worker to process the given migration batch function.
func MakeBatchMigrationWorker(
	jobServer *JobServer,
	store store.Store,
	app BatchMigrationWorkerAppIFace,
	migrationKey string,
	timeBetweenBatches time.Duration,
	doMigrationBatch func(data model.StringMap, store store.Store) (model.StringMap, bool, error),
) *BatchMigrationWorker {
	worker := &BatchMigrationWorker{
		app:              app,
		migrationKey:     migrationKey,
		doMigrationBatch: doMigrationBatch,
	}
	worker.BatchWorker = MakeBatchWorker(jobServer, store, timeBetweenBatches, worker.doBatch)
	return worker
}

func (worker *BatchMigrationWorker) doBatch(rctx *request.Context, job *model.Job) bool {
	// Ensure the cluster remains in sync, otherwise we restart the job to
	// ensure a complete migration. Technically, the cluster could go out of
	// sync briefly within a batch, but we accept that risk.
	if !worker.checkIsClusterInSync(rctx) {
		worker.logger.Warn("Worker: Resetting job")
		worker.resetJob(worker.logger, job)
		return true
	}

	nextData, done, err := worker.doMigrationBatch(job.Data, worker.store)
	if err != nil {
		worker.logger.Error("Worker: Failed to do migration batch. Exiting", mlog.Err(err))
		worker.setJobError(worker.logger, job, model.NewAppError("doMigrationBatch", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
		return true
	} else if done {
		worker.logger.Info("Worker: Job is complete")
		worker.setJobSuccess(worker.logger, job)
		worker.markAsComplete()
		return true
	}

	job.Data = nextData

	// Migrations currently don't support reporting meaningful progress.
	if err := worker.jobServer.SetJobProgress(job, 0); err != nil {
		worker.logger.Error("Worker: Failed to set job progress", mlog.Err(err))
		return false
	}
	return false
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
