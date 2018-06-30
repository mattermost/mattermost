// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package migrations

import (
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

const (
	MIGRATION_JOB_WEDGED_TIMEOUT_MILLISECONDS = 3600000 // 1 hour
)

type Scheduler struct {
	App                    *app.App
	allMigrationsCompleted bool
}

func (m *MigrationsJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{m.App, false}
}

func (scheduler *Scheduler) Name() string {
	return "MigrationsScheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_MIGRATIONS
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	if scheduler.allMigrationsCompleted {
		return nil
	}

	nextTime := time.Now().Add(60 * time.Second)
	return &nextTime
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	mlog.Debug("Scheduling Job", mlog.String("scheduler", scheduler.Name()))

	// Work through the list of migrations in order. Schedule the first one that isn't done (assuming it isn't in progress already).
	for _, key := range MakeMigrationsList() {
		state, job, err := GetMigrationState(key, scheduler.App.Srv.Store)
		if err != nil {
			mlog.Error("Failed to determine status of migration: ", mlog.String("scheduler", scheduler.Name()), mlog.String("migration_key", key), mlog.String("error", err.Error()))
			return nil, nil
		}

		if state == MIGRATION_STATE_IN_PROGRESS {
			// Check the migration job isn't wedged.
			if job != nil && job.LastActivityAt < model.GetMillis()-MIGRATION_JOB_WEDGED_TIMEOUT_MILLISECONDS && job.CreateAt < model.GetMillis()-MIGRATION_JOB_WEDGED_TIMEOUT_MILLISECONDS {
				mlog.Warn("Job appears to be wedged. Rescheduling another instance.", mlog.String("scheduler", scheduler.Name()), mlog.String("wedged_job_id", job.Id), mlog.String("migration_key", key))
				if err := scheduler.App.Jobs.SetJobError(job, nil); err != nil {
					mlog.Error("Worker: Failed to set job error", mlog.String("scheduler", scheduler.Name()), mlog.String("job_id", job.Id), mlog.String("error", err.Error()))
				}
				return scheduler.createJob(key, job, scheduler.App.Srv.Store)
			}

			return nil, nil
		}

		if state == MIGRATION_STATE_COMPLETED {
			// This migration is done. Continue to check the next.
			continue
		}

		if state == MIGRATION_STATE_UNSCHEDULED {
			mlog.Debug("Scheduling a new job for migration.", mlog.String("scheduler", scheduler.Name()), mlog.String("migration_key", key))
			return scheduler.createJob(key, job, scheduler.App.Srv.Store)
		}

		mlog.Error("Unknown migration state. Not doing anything.", mlog.String("migration_state", state))
		return nil, nil
	}

	// If we reached here, then there aren't any migrations left to run.
	scheduler.allMigrationsCompleted = true
	mlog.Debug("All migrations are complete.", mlog.String("scheduler", scheduler.Name()))

	return nil, nil
}

func (scheduler *Scheduler) createJob(migrationKey string, lastJob *model.Job, store store.Store) (*model.Job, *model.AppError) {
	var lastDone string
	if lastJob != nil {
		lastDone = lastJob.Data[JOB_DATA_KEY_MIGRATION_LAST_DONE]
	}

	data := map[string]string{
		JOB_DATA_KEY_MIGRATION:           migrationKey,
		JOB_DATA_KEY_MIGRATION_LAST_DONE: lastDone,
	}

	if job, err := scheduler.App.Jobs.CreateJob(model.JOB_TYPE_MIGRATIONS, data); err != nil {
		return nil, err
	} else {
		return job, nil
	}
}
