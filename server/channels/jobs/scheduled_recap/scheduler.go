// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduled_recap

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// SchedulerPollingInterval defines how often the scheduler polls for due scheduled recaps.
const SchedulerPollingInterval = 1 * time.Minute

// Scheduler polls for due scheduled recaps and creates jobs for them.
type Scheduler struct {
	*jobs.PeriodicScheduler
	store     store.Store
	jobServer *jobs.JobServer
}

// MakeScheduler creates a new scheduler for scheduled recaps.
func MakeScheduler(jobServer *jobs.JobServer, storeInstance store.Store) *Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.AIRecapsEnabled()
	}
	return &Scheduler{
		PeriodicScheduler: jobs.NewPeriodicScheduler(
			jobServer,
			model.JobTypeScheduledRecap,
			SchedulerPollingInterval,
			isEnabled,
		),
		store:     storeInstance,
		jobServer: jobServer,
	}
}

// NextScheduleTime overrides to use tight polling interval.
func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastJob *model.Job) *time.Time {
	next := now.Add(SchedulerPollingInterval)
	return &next
}

// ScheduleJob polls for due scheduled recaps and creates jobs for each.
func (s *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastJob *model.Job) (*model.Job, *model.AppError) {
	now := model.GetMillis()
	dueRecaps, err := s.store.ScheduledRecap().GetDueBefore(now, 100)
	if err != nil {
		mlog.Error("Failed to get due scheduled recaps", mlog.Err(err))
		return nil, nil
	}

	for _, sr := range dueRecaps {
		// The worker re-fetches the full row by ID, so the job only needs the ID.
		jobData := model.StringMap{
			"scheduled_recap_id": sr.Id,
		}

		job, jobErr := s.jobServer.CreateJobOnceByTypeAndData(
			rctx,
			model.JobTypeScheduledRecap,
			jobData,
			map[string]string{"scheduled_recap_id": sr.Id},
		)
		if jobErr != nil {
			mlog.Warn("Scheduled recap job creation failed",
				mlog.String("scheduled_recap_id", sr.Id),
				mlog.Err(jobErr))
			continue
		}
		if job == nil {
			mlog.Debug("Scheduled recap job already queued",
				mlog.String("scheduled_recap_id", sr.Id))
		}
	}

	return nil, nil
}
