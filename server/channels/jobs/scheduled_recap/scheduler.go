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
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// SchedulerPollingInterval defines how often the scheduler polls for due scheduled recaps.
const SchedulerPollingInterval = 1 * time.Minute

// ScheduledRecapJobWedgedTimeout is the maximum time a scheduled recap job may remain in progress.
const ScheduledRecapJobWedgedTimeout = 15 * time.Minute

// dueScheduleBatchSize is how many due schedules each keyset-paginated store query
// returns. The per-tick total is bounded separately by MaxDueSchedulesPerTick.
const dueScheduleBatchSize = 100

// Scheduler polls for due scheduled recaps and creates jobs for them.
type Scheduler struct {
	*jobs.PeriodicScheduler
	store      store.Store
	jobServer  *jobs.JobServer
	getMetrics func() einterfaces.MetricsInterface
}

// MakeScheduler creates a new scheduler for scheduled recaps.
func MakeScheduler(jobServer *jobs.JobServer, storeInstance store.Store, getMetrics func() einterfaces.MetricsInterface) *Scheduler {
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
		store:      storeInstance,
		jobServer:  jobServer,
		getMetrics: getMetrics,
	}
}

// NextScheduleTime overrides to use tight polling interval.
func (s *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastJob *model.Job) *time.Time {
	next := now.Add(SchedulerPollingInterval)
	return &next
}

// ScheduleJob polls for due scheduled recaps and creates jobs for each, draining the
// due backlog in keyset-paginated batches up to MaxDueSchedulesPerTick per tick.
func (s *Scheduler) ScheduleJob(rctx request.CTX, cfg *model.Config, pendingJobs bool, lastJob *model.Job) (*model.Job, *model.AppError) {
	if _, appErr := s.jobServer.ResetWedgedJobs(rctx, model.JobTypeScheduledRecap, ScheduledRecapJobWedgedTimeout); appErr != nil {
		mlog.Error("Failed to reset wedged scheduled recap jobs", mlog.Err(appErr))
		// Continue: enqueueing due schedules that are not blocked is still useful.
	}
	// Known accepted risk: if the dead worker crashed between committing the Recap row and
	// MarkExecuted (a milliseconds-wide window inside CreateRecapFromSchedule), the retry
	// creates a duplicate recap for that run. Deliberately not mitigated: it would need a
	// recap-by-schedule store query and reconciliation semantics disproportionate to the
	// window, and SaveRecapIfUnderDailyLimit caps the damage.

	// Snapshot the due cutoff once so schedules becoming due mid-drain wait for the next tick.
	now := model.GetMillis()
	var processing *model.RecapProcessingSettings
	if cfg != nil {
		processing = cfg.AIRecapSettings.Processing
	}
	maxPerTick := processing.MaxDueSchedulesPerTickOrDefault()

	var cursorNextRunAt int64
	var cursorID string
	totalDue := 0
	enqueuedCount := 0
	var maxEnqueueLagMs int64

	for {
		remaining := maxPerTick - totalDue
		if remaining <= 0 {
			mlog.Warn("Reached the per-tick cap while enqueueing due scheduled recaps; remaining due schedules will be enqueued on the next tick",
				mlog.Int("max_due_schedules_per_tick", maxPerTick))
			break
		}

		batchLimit := min(dueScheduleBatchSize, remaining)
		dueRecaps, err := s.store.ScheduledRecap().GetDueBefore(now, cursorNextRunAt, cursorID, batchLimit)
		if err != nil {
			// Already-enqueued jobs stand; the next tick restarts from the zero cursor.
			mlog.Error("Failed to get due scheduled recaps",
				mlog.Int("enqueued_so_far", totalDue),
				mlog.Err(err))
			return nil, nil
		}

		for _, sr := range dueRecaps {
			maxEnqueueLagMs = max(maxEnqueueLagMs, now-sr.NextRunAt)

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
				continue
			}
			enqueuedCount++
			mlog.Debug("Enqueued scheduled recap job",
				mlog.String("scheduled_recap_id", sr.Id),
				mlog.Int("enqueue_lag_ms", now-sr.NextRunAt))
		}

		totalDue += len(dueRecaps)

		if len(dueRecaps) < batchLimit {
			break
		}

		last := dueRecaps[len(dueRecaps)-1]
		cursorNextRunAt, cursorID = last.NextRunAt, last.Id
	}

	if metrics := s.getMetrics(); metrics != nil {
		metrics.ObserveRecapScheduledBacklog(int64(totalDue))
	}
	if totalDue > 0 {
		mlog.Info("Scheduled recap scheduler tick completed",
			mlog.Int("due_count", totalDue),
			mlog.Int("enqueued_count", enqueuedCount),
			mlog.Int("max_enqueue_lag_ms", maxEnqueueLagMs))
	}

	return nil, nil
}
