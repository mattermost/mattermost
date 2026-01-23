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
	GetEffectiveLimits(userID string) (*model.EffectiveRecapLimits, *model.AppError)
	GetUser(userID string) (*model.User, *model.AppError)
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

		// ENF-03: Check daily limit before execution
		limits, limitsErr := app.GetEffectiveLimits(sr.UserId)
		if limitsErr != nil {
			logger.Error("Failed to get effective limits", mlog.Err(limitsErr))
			return fmt.Errorf("failed to get effective limits: %w", limitsErr)
		}

		if model.IsLimitEnabled(limits.MaxRecapsPerDay) {
			// Get user's timezone for midnight calculation
			user, userErr := app.GetUser(sr.UserId)
			if userErr != nil {
				logger.Error("Failed to get user for timezone", mlog.Err(userErr))
				return fmt.Errorf("failed to get user: %w", userErr)
			}

			// Calculate start of today in user's timezone
			loc := user.GetTimezoneLocation()
			now := time.Now().In(loc)
			dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

			// Count recaps created today
			count, countErr := storeInstance.Recap().CountForUserSince(sr.UserId, dayStart.UnixMilli())
			if countErr != nil {
				logger.Error("Failed to count daily recaps", mlog.Err(countErr))
				return fmt.Errorf("failed to count daily recaps: %w", countErr)
			}

			if count >= int64(limits.MaxRecapsPerDay) {
				// Create skipped recap record (per CONTEXT.md: visible in unreads tab)
				skippedRecap := &model.Recap{
					Id:               model.NewId(),
					UserId:           sr.UserId,
					Title:            sr.Title,
					Status:           model.RecapStatusSkipped,
					SkipReason:       model.SkipReasonDailyLimit,
					ScheduledRecapId: sr.Id,
					CreateAt:         model.GetMillis(),
					UpdateAt:         model.GetMillis(),
				}

				if _, saveErr := storeInstance.Recap().SaveRecap(skippedRecap); saveErr != nil {
					logger.Error("Failed to save skipped recap", mlog.Err(saveErr))
					// Continue anyway - don't fail the job entirely
				}

				logger.Info("Scheduled recap skipped due to daily limit",
					mlog.String("scheduled_recap_id", scheduledRecapID),
					mlog.String("user_id", sr.UserId),
					mlog.Int("daily_count", int(count)),
					mlog.Int("limit", limits.MaxRecapsPerDay))

				// Update next run time so scheduler moves on
				nextNow := time.Now()
				nextRunAt, computeErr := sr.ComputeNextRunAt(nextNow)
				if computeErr != nil {
					logger.Error("Failed to compute next run time for skipped recap",
						mlog.String("scheduled_recap_id", scheduledRecapID),
						mlog.Err(computeErr))
					_ = storeInstance.ScheduledRecap().SetEnabled(scheduledRecapID, false)
					return nil
				}
				lastRunAt := model.GetMillis()
				if markErr := storeInstance.ScheduledRecap().MarkExecuted(scheduledRecapID, lastRunAt, nextRunAt); markErr != nil {
					logger.Error("Failed to mark skipped as executed",
						mlog.String("scheduled_recap_id", scheduledRecapID),
						mlog.Err(markErr))
				}

				return nil // Skip execution, not an error
			}
		}

		// Create the actual recap
		rctx := request.EmptyContext(logger)
		_, appErr := app.CreateRecapFromSchedule(rctx, sr)
		if appErr != nil {
			return fmt.Errorf("failed to create recap from schedule: %w", appErr)
		}

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
