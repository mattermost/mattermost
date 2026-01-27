// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduled_recap

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// AppIface defines the app methods required by the scheduled recap worker.
// This interface will be implemented by the App layer in 03-02.
type AppIface interface {
	CreateRecapFromSchedule(rctx request.CTX, scheduledRecap *model.ScheduledRecap) (*model.Recap, *model.AppError)
}

// MakeWorker creates a new worker for processing scheduled recap jobs.
func MakeWorker(jobServer *jobs.JobServer, storeInstance store.Store, app AppIface) *jobs.SimpleWorker {
	const workerName = "ScheduledRecap"

	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags.EnableAIRecaps
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)

		scheduledRecapID := job.Data["scheduled_recap_id"]

		// Get the scheduled recap
		sr, err := storeInstance.ScheduledRecap().Get(scheduledRecapID)
		if err != nil {
			return fmt.Errorf("scheduled recap not found: %w", err)
		}

		// Verify still enabled
		if !sr.Enabled {
			logger.Info("Scheduled recap is disabled, skipping",
				mlog.String("scheduled_recap_id", scheduledRecapID))
			return nil
		}

		// Create the actual recap
		rctx := request.EmptyContext(logger)
		_, appErr := app.CreateRecapFromSchedule(rctx, sr)
		if appErr != nil {
			logger.Info("Scheduled recap execution failed",
				mlog.String("event", model.AuditEventExecuteScheduledRecap),
				mlog.String("scheduled_recap_id", scheduledRecapID),
				mlog.String("user_id", sr.UserId),
				mlog.Int("channel_count", len(sr.ChannelIds)),
				mlog.String("status", "failed"),
				mlog.Err(appErr))
			return fmt.Errorf("failed to create recap from schedule: %w", appErr)
		}

		// Audit log: successful scheduled recap execution
		logger.Info("Scheduled recap executed",
			mlog.String("event", model.AuditEventExecuteScheduledRecap),
			mlog.String("scheduled_recap_id", scheduledRecapID),
			mlog.String("user_id", sr.UserId),
			mlog.Int("channel_count", len(sr.ChannelIds)),
			mlog.String("status", "success"))

		// Compute next run time
		now := time.Now()
		nextRunAt, computeErr := sr.ComputeNextRunAt(now)
		if computeErr != nil {
			logger.Error("Failed to compute next run time",
				mlog.String("scheduled_recap_id", scheduledRecapID),
				mlog.Err(computeErr))
			// Disable if can't compute next run
			_ = storeInstance.ScheduledRecap().SetEnabled(scheduledRecapID, false)
			return nil
		}

		// Update scheduled recap state atomically
		lastRunAt := model.GetMillis()
		if markErr := storeInstance.ScheduledRecap().MarkExecuted(scheduledRecapID, lastRunAt, nextRunAt); markErr != nil {
			return fmt.Errorf("failed to mark executed: %w", markErr)
		}

		// Handle non-recurring schedules
		if !sr.IsRecurring {
			logger.Info("Disabling non-recurring scheduled recap",
				mlog.String("scheduled_recap_id", scheduledRecapID))
			_ = storeInstance.ScheduledRecap().SetEnabled(scheduledRecapID, false)
		}

		logger.Info("Scheduled recap executed successfully",
			mlog.String("scheduled_recap_id", scheduledRecapID),
			mlog.Int("next_run_at", int(nextRunAt)))

		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
