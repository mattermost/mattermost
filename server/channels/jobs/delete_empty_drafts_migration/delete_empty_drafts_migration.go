// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package delete_empty_drafts_migration

import (
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	JobName = "DeleteEmptyDraftsMigration"

	timeBetweenBatches = 1 * time.Second
)

type AppIFace interface {
	GetClusterStatus() []*model.ClusterInfo
}

type DeleteEmptyDraftsMigrationWorker struct {
	name      string
	jobServer *jobs.JobServer
	store     store.Store
	app       AppIFace

	stop    chan bool
	stopped chan bool
	jobs    chan model.Job
}

func MakeWorker(jobServer *jobs.JobServer, store store.Store, app AppIFace) model.Worker {
	worker := &DeleteEmptyDraftsMigrationWorker{
		jobServer: jobServer,
		store:     store,
		app:       app,
		name:      JobName,
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
	}
	return worker
}

func (worker *DeleteEmptyDraftsMigrationWorker) Run() {
	mlog.Debug("Worker started", mlog.String("worker", worker.name))
	// We have to re-assign the stop channel again, because
	// it might happen that the job was restarted due to a config change.
	worker.stop = make(chan bool, 1)

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

func (worker *DeleteEmptyDraftsMigrationWorker) Stop() {
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
	close(worker.stop)
	<-worker.stopped
}

func (worker *DeleteEmptyDraftsMigrationWorker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *DeleteEmptyDraftsMigrationWorker) IsEnabled(_ *model.Config) bool {
	return true
}

func (worker *DeleteEmptyDraftsMigrationWorker) getJobMetadata(job *model.Job, key string) (int64, *model.AppError) {
	countStr := job.Data[key]
	count := int64(0)
	var err error
	if countStr != "" {
		count, err = strconv.ParseInt(countStr, 10, 64)
		if err != nil {
			return 0, model.NewAppError("getJobMetadata", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return count, nil
}

func (worker *DeleteEmptyDraftsMigrationWorker) DoJob(job *model.Job) {
	defer worker.jobServer.HandleJobPanic(job)

	if claimed, err := worker.jobServer.ClaimJob(job); err != nil {
		mlog.Warn("DeleteEmptyDraftsMigrationWorker experienced an error while trying to claim job",
			mlog.String("worker", worker.name),
			mlog.String("job_id", job.Id),
			mlog.Err(err))
		return
	} else if !claimed {
		return
	}

	var appErr *model.AppError
	// We get the job again because ClaimJob changes the job status.
	job, appErr = worker.jobServer.GetJob(job.Id)
	if appErr != nil {
		mlog.Error("DeleteEmptyDraftsMigrationWorker: job execution error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}

	// Wait for all clusters to finish DB migration
	clusterStatus := worker.app.GetClusterStatus()
	if len(clusterStatus) > 1 {
		for i := 1; i < len(clusterStatus); i++ {
			if clusterStatus[i].SchemaVersion != clusterStatus[0].SchemaVersion {
				// Just wait for the next loop
				worker.jobServer.SetJobPending(job)
				return
			}
		}
	}

	// Check if there is metadata for that job.
	// If there isn't, it will be empty by default, which is the right value.
	userID := job.Data["user_id"]
	createAt, appErr := worker.getJobMetadata(job, "create_at")
	if appErr != nil {
		mlog.Error("DeleteEmptyDraftsMigrationWorker: failed to get create at", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(appErr))
		worker.setJobError(job, appErr)
		return
	}

	for {
		select {
		case <-worker.stop:
			mlog.Info("Worker: Delete Empty Drafts has been canceled via Worker Stop. Setting the job back to pending.",
				mlog.String("workername", worker.name),
				mlog.String("job_id", job.Id))
			if err := worker.jobServer.SetJobPending(job); err != nil {
				mlog.Error("Worker: Failed to mark job as pending",
					mlog.String("workername", worker.name),
					mlog.String("job_id", job.Id),
					mlog.Err(err))
			}
			return
		case <-time.After(timeBetweenBatches):
			nextCreateAt, nextUserID, err := worker.store.Draft().GetLastCreateAtAndUserIdValuesForEmptyDraftsMigration(createAt, userID)
			if err != nil {
				mlog.Error("DeleteEmptyDraftsMigrationWorker: Failed to get the working page for the migration. Exiting", mlog.Err(err))
				worker.setJobError(job, model.NewAppError("DoJob", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
				return
			}

			err = worker.store.Draft().DeleteEmptyDraftsByCreateAtAndUserId(createAt, userID)
			if err != nil {
				mlog.Error("DeleteEmptyDraftsMigrationWorker: Failed to delete the empty drafts for the page. Exiting", mlog.Err(err))
				worker.setJobError(job, model.NewAppError("DoJob", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err))
				return
			}

			if nextCreateAt == 0 && nextUserID == "" {
				mlog.Info("DeleteEmptyDraftsMigrationWorker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
				worker.setJobSuccess(job)
				worker.markAsComplete()
				return
			}

			// Work on each batch and save the batch starting ID in metadata
			if job.Data == nil {
				job.Data = make(model.StringMap)
			}
			job.Data["user_id"] = nextUserID
			job.Data["create_at"] = strconv.FormatInt(nextCreateAt, 10)
			worker.jobServer.SetJobProgress(job, 0)
			userID = nextUserID
			createAt = nextCreateAt
		}
	}
}

func (worker *DeleteEmptyDraftsMigrationWorker) markAsComplete() {
	system := model.System{
		Name:  model.MigrationKeyDeleteEmptyDrafts,
		Value: "true",
	}

	// Note that if this fails, then the job would have still succeeded.
	// So it will try to run the same job again next time, but then
	// it will just fall through everything because all files would have
	// converted. The actual job is idempotent, so there won't be a problem.
	if err := worker.jobServer.Store.System().Save(&system); err != nil {
		mlog.Error("Worker: Failed to mark empty draft deletion as completed in the systems table.", mlog.String("workername", worker.name), mlog.Err(err))
	}
}

func (worker *DeleteEmptyDraftsMigrationWorker) setJobSuccess(job *model.Job) {
	if err := worker.jobServer.SetJobProgress(job, 100); err != nil {
		mlog.Error("Worker: Failed to update progress for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		worker.setJobError(job, err)
	}

	if err := worker.jobServer.SetJobSuccess(job); err != nil {
		mlog.Error("DeleteEmptyDraftsMigrationWorker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
		worker.setJobError(job, err)
	}
}

func (worker *DeleteEmptyDraftsMigrationWorker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.jobServer.SetJobError(job, appError); err != nil {
		mlog.Error("DeleteEmptyDraftsMigrationWorker Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.Err(err))
	}
}
