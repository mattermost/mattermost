// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

const (
	TIME_BETWEEN_BATCHES = 100
)

type Worker struct {
	name      string
	stop      chan bool
	stopped   chan bool
	jobs      chan model.Job
	jobServer *jobs.JobServer
	app       *app.App
}

func (m *MigrationsJobInterfaceImpl) MakeWorker() model.Worker {
	worker := Worker{
		name:      "Migrations",
		stop:      make(chan bool, 1),
		stopped:   make(chan bool, 1),
		jobs:      make(chan model.Job),
		jobServer: m.App.Jobs,
		app:       m.App,
	}

	return &worker
}

func (worker *Worker) Run() {
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
	mlog.Debug("Worker stopping", mlog.String("worker", worker.name))
	worker.stop <- true
	<-worker.stopped
}

func (worker *Worker) JobChannel() chan<- model.Job {
	return worker.jobs
}

func (worker *Worker) DoJob(job *model.Job) {
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
	cancelWatcherChan := make(chan interface{}, 1)
	go worker.app.Jobs.CancellationWatcher(cancelCtx, job.Id, cancelWatcherChan)

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

		case <-time.After(TIME_BETWEEN_BATCHES * time.Millisecond):
			done, progress, err := worker.runMigration(job.Data[JOB_DATA_KEY_MIGRATION], job.Data[JOB_DATA_KEY_MIGRATION_LAST_DONE])
			if err != nil {
				mlog.Error("Worker: Failed to run migration", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
				worker.setJobError(job, err)
				return
			} else if done {
				mlog.Info("Worker: Job is complete", mlog.String("worker", worker.name), mlog.String("job_id", job.Id))
				worker.setJobSuccess(job)
				return
			} else {
				job.Data[JOB_DATA_KEY_MIGRATION_LAST_DONE] = progress
				if err := worker.app.Jobs.UpdateInProgressJobData(job); err != nil {
					mlog.Error("Worker: Failed to update migration status data for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
					worker.setJobError(job, err)
					return
				}
			}
		}
	}
}

func (worker *Worker) setJobSuccess(job *model.Job) {
	if err := worker.app.Jobs.SetJobSuccess(job); err != nil {
		mlog.Error("Worker: Failed to set success for job", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
		worker.setJobError(job, err)
	}
}

func (worker *Worker) setJobError(job *model.Job, appError *model.AppError) {
	if err := worker.app.Jobs.SetJobError(job, appError); err != nil {
		mlog.Error("Worker: Failed to set job error", mlog.String("worker", worker.name), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
	}
}

func (worker *Worker) setJobCanceled(job *model.Job) {
	if err := worker.app.Jobs.SetJobCanceled(job); err != nil {
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
	case MIGRATION_KEY_ADVANCED_PERMISSIONS_PHASE_2:
		done, progress, err = worker.runAdvancedPermissionsPhase2Migration(lastDone)
	default:
		return false, "", model.NewAppError("MigrationsWorker.runMigration", "migrations.worker.run_migration.unknown_key", map[string]interface{}{"key": key}, "", http.StatusInternalServerError)
	}

	if done {
		if result := <-worker.app.Srv.Store.System().Save(&model.System{Name: key, Value: "true"}); result.Err != nil {
			return false, "", result.Err
		}
	}

	return done, progress, err
}

func (worker *Worker) runAdvancedPermissionsPhase2Migration(lastDone string) (bool, string, *model.AppError) {
	var progress *AdvancedPermissionsPhase2Progress
	if len(lastDone) == 0 {
		// Haven't started the migration yet.
		progress = new(AdvancedPermissionsPhase2Progress)
		progress.CurrentTable = "TeamMembers"
		progress.LastChannelId = strings.Repeat("0", 26)
		progress.LastTeamId = strings.Repeat("0", 26)
		progress.LastUserId = strings.Repeat("0", 26)
	} else {
		progress = AdvancedPermissionsPhase2ProgressFromJson(strings.NewReader(lastDone))
		if !progress.IsValid() {
			return false, "", model.NewAppError("MigrationsWorker.runAdvancedPermissionsPhase2Migration", "migrations.worker.run_advanced_permissions_phase_2_migration.invalid_progress", map[string]interface{}{"progress": progress.ToJson()}, "", http.StatusInternalServerError)
		}
	}

	if progress.CurrentTable == "TeamMembers" {
		// Run a TeamMembers migration batch.
		if result := <-worker.app.Srv.Store.Team().MigrateTeamMembers(progress.LastTeamId, progress.LastUserId); result.Err != nil {
			return false, progress.ToJson(), result.Err
		} else {
			if result.Data == nil {
				// We haven't progressed. That means that we've reached the end of this stage of the migration, and should now advance to the next stage.
				progress.LastUserId = strings.Repeat("0", 26)
				progress.CurrentTable = "ChannelMembers"
				return false, progress.ToJson(), nil
			}

			data := result.Data.(map[string]string)
			progress.LastTeamId = data["TeamId"]
			progress.LastUserId = data["UserId"]
		}
	} else if progress.CurrentTable == "ChannelMembers" {
		// Run a ChannelMembers migration batch.
		if result := <-worker.app.Srv.Store.Channel().MigrateChannelMembers(progress.LastChannelId, progress.LastUserId); result.Err != nil {
			return false, progress.ToJson(), result.Err
		} else {
			if result.Data == nil {
				// We haven't progressed. That means we've reached the end of this final stage of the migration.

				return true, progress.ToJson(), nil
			}

			data := result.Data.(map[string]string)
			progress.LastChannelId = data["ChannelId"]
			progress.LastUserId = data["UserId"]
		}
	}

	return false, progress.ToJson(), nil
}
