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
		return cfg.AIRecapsEnabled()
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		defer jobServer.HandleJobPanic(logger, job)
		return processScheduledRecapJob(logger, job, storeInstance, app)
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

func processScheduledRecapJob(logger mlog.LoggerIFace, job *model.Job, storeInstance store.Store, app AppIface) error {
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

	// CreateRecapFromSchedule performs the atomic daily-limit check; an over-limit
	// run surfaces as the max_recaps_reached error, which we treat as a skip.
	rctx := request.EmptyContext(logger)
	_, appErr := app.CreateRecapFromSchedule(rctx, sr)
	if appErr != nil {
		if appErr.Id == "app.recap.max_recaps_reached.app_error" {
			if saveErr := saveSkippedRecap(storeInstance, sr); saveErr != nil {
				logger.Error("Failed to save skipped recap", mlog.Err(saveErr))
				return fmt.Errorf("failed to save skipped recap: %w", saveErr)
			}
			logger.Info("Scheduled recap skipped due to daily limit",
				mlog.String("scheduled_recap_id", scheduledRecapID),
				mlog.String("user_id", sr.UserId))
			return finalizeSchedule(logger, storeInstance, sr)
		}
		return fmt.Errorf("failed to create recap from schedule: %w", appErr)
	}

	logger.Info("Scheduled recap executed successfully",
		mlog.String("scheduled_recap_id", scheduledRecapID))

	return finalizeSchedule(logger, storeInstance, sr)
}

// finalizeSchedule advances the schedule to its next run and, for non-recurring
// recaps, disables it last so a one-shot recap is never left enabled.
func finalizeSchedule(logger mlog.LoggerIFace, storeInstance store.Store, sr *model.ScheduledRecap) error {
	if err := advanceSchedule(logger, storeInstance, sr); err != nil {
		return err
	}

	if !sr.IsRecurring {
		logger.Info("Disabling non-recurring scheduled recap",
			mlog.String("scheduled_recap_id", sr.Id))
		if setErr := storeInstance.ScheduledRecap().SetEnabled(sr.Id, false); setErr != nil {
			return fmt.Errorf("failed to disable non-recurring scheduled recap: %w", setErr)
		}
	}

	return nil
}

// advanceSchedule computes the next run time and marks the scheduled recap as executed.
// If the next run time can't be computed, the recap is disabled.
func advanceSchedule(logger mlog.LoggerIFace, storeInstance store.Store, sr *model.ScheduledRecap) error {
	nextRunAt, computeErr := sr.ComputeNextRunAt(time.Now())
	if computeErr != nil {
		logger.Error("Failed to compute next run time",
			mlog.String("scheduled_recap_id", sr.Id),
			mlog.Err(computeErr))
		if setErr := storeInstance.ScheduledRecap().SetEnabled(sr.Id, false); setErr != nil {
			return fmt.Errorf("failed to disable scheduled recap after next-run computation failure: %w", setErr)
		}
		return fmt.Errorf("failed to compute next run time: %w", computeErr)
	}

	if markErr := storeInstance.ScheduledRecap().MarkExecuted(sr.Id, model.GetMillis(), nextRunAt); markErr != nil {
		logger.Error("Failed to mark as executed",
			mlog.String("scheduled_recap_id", sr.Id),
			mlog.Err(markErr))
		return fmt.Errorf("failed to mark scheduled recap as executed: %w", markErr)
	}

	return nil
}

func saveSkippedRecap(storeInstance store.Store, sr *model.ScheduledRecap) error {
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
		return saveErr
	}

	return nil
}
