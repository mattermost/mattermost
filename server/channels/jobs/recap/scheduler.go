// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	// SchedulerPeriod controls the recovery cadence.
	SchedulerPeriod = time.Minute
	// RecapJobWedgedTimeout is the maximum interval without job activity.
	RecapJobWedgedTimeout = 30 * time.Minute
	// OrphanedRecapCutoff gives job recovery priority over the orphan sweep.
	OrphanedRecapCutoff = 2 * RecapJobWedgedTimeout

	orphanSweepLimit = 100
)

// Scheduler recovers wedged recap jobs and processing recaps without live jobs.
type Scheduler struct {
	*jobs.PeriodicScheduler
	jobServer *jobs.JobServer
	store     store.Store
	app       AppIface
}

func MakeScheduler(jobServer *jobs.JobServer, storeInstance store.Store, appInstance AppIface) *Scheduler {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.AIRecapsEnabled()
	}
	return &Scheduler{
		PeriodicScheduler: jobs.NewPeriodicScheduler(jobServer, model.JobTypeRecap, SchedulerPeriod, isEnabled),
		jobServer:         jobServer,
		store:             storeInstance,
		app:               appInstance,
	}
}

// ScheduleJob runs the recovery passes and never creates a job.
func (s *Scheduler) ScheduleJob(rctx request.CTX, _ *model.Config, _ bool, _ *model.Job) (*model.Job, *model.AppError) {
	s.resetWedgedJobs(rctx)
	s.sweepOrphanedRecaps(rctx)
	return nil, nil
}

func (s *Scheduler) resetWedgedJobs(rctx request.CTX) {
	resetJobs, appErr := s.jobServer.ResetWedgedJobs(rctx, model.JobTypeRecap, RecapJobWedgedTimeout)
	if appErr != nil {
		rctx.Logger().Error("Failed to reset wedged recap jobs", mlog.Err(appErr))
		return
	}

	for _, job := range resetJobs {
		recapID := job.Data["recap_id"]
		if recapID == "" {
			rctx.Logger().Warn("Reset recap job has no recap ID", jobs.JobLoggerFields(job)...)
			continue
		}
		s.markRecapFailed(rctx, recapID, job.Data["user_id"])
	}
}

func (s *Scheduler) markRecapFailed(rctx request.CTX, recapID, userID string) {
	transitioned, err := s.store.Recap().MarkRecapFailedIfIncomplete(recapID)
	if err != nil {
		rctx.Logger().Error("Failed to mark recap as failed",
			mlog.String("recap_id", recapID),
			mlog.Err(err))
		return
	}
	if !transitioned {
		rctx.Logger().Debug("Recap is already terminal or deleted",
			mlog.String("recap_id", recapID))
		return
	}

	publishRecapUpdate(s.app, recapID, userID)
}

func (s *Scheduler) sweepOrphanedRecaps(rctx request.CTX) {
	cutoff := model.GetMillis() - OrphanedRecapCutoff.Milliseconds()
	recaps, err := s.store.Recap().GetRecapsByStatusOlderThan(model.RecapStatusProcessing, cutoff, orphanSweepLimit)
	if err != nil {
		rctx.Logger().Error("Failed to get orphaned processing recaps", mlog.Err(err))
		return
	}

	for _, recap := range recaps {
		jobsForRecap, err := s.store.Job().GetByTypeAndData(
			rctx,
			model.JobTypeRecap,
			map[string]string{"recap_id": recap.Id},
			true,
			model.JobStatusPending,
			model.JobStatusInProgress,
		)
		if err != nil {
			rctx.Logger().Warn("Could not verify live jobs for processing recap",
				mlog.String("recap_id", recap.Id),
				mlog.Err(err))
			continue
		}
		if len(jobsForRecap) > 0 {
			continue
		}

		rctx.Logger().Warn("Recap stuck in processing with no live job; marking failed",
			mlog.String("recap_id", recap.Id),
			mlog.String("user_id", recap.UserId),
			mlog.Millis("update_at", recap.UpdateAt))
		s.markRecapFailed(rctx, recap.Id, recap.UserId)
	}
}
