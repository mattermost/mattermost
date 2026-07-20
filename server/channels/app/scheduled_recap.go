// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// CreateScheduledRecap creates a new scheduled recap with validated inputs.
// It sets the user ID from the session, validates the recap configuration,
// computes the initial NextRunAt, and saves to the store.
func (a *App) CreateScheduledRecap(rctx request.CTX, recap *model.ScheduledRecap) (*model.ScheduledRecap, *model.AppError) {
	if appErr := a.requireAIRecapsEnabled("CreateScheduledRecap"); appErr != nil {
		return nil, appErr
	}

	// Set user ID from session
	recap.UserId = rctx.Session().UserId
	recap.Enabled = true

	// Prepare for save (generates ID, timestamps)
	recap.PreSave()

	// Validate configuration
	if err := recap.IsValid(); err != nil {
		return nil, err
	}

	// Limit enforcement: Check user's limits before allowing creation.
	// The channel count check runs first so it bounds the permission check below.
	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return nil, limitsErr
	}

	// Check max channels per recap limit
	if model.IsLimitEnabled(limits.MaxChannelsPerRecap) {
		if len(recap.ChannelIds) > limits.MaxChannelsPerRecap {
			return nil, model.NewAppError("CreateScheduledRecap",
				"app.scheduled_recap.max_channels_exceeded.app_error",
				map[string]any{
					"Limit":     limits.MaxChannelsPerRecap,
					"Requested": len(recap.ChannelIds),
				},
				"", http.StatusBadRequest)
		}
	}

	if appErr := a.validateRecapChannelPermissions(rctx, recap.ChannelIds, "CreateScheduledRecap"); appErr != nil {
		return nil, appErr
	}

	// Compute NextRunAt before saving
	nextRunAt, err := recap.ComputeNextRunAt(time.Now())
	if err != nil {
		return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.compute_next_run.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	recap.NextRunAt = nextRunAt

	// Save to store
	var (
		savedRecap *model.ScheduledRecap
		storeErr   error
	)
	if model.IsLimitEnabled(limits.MaxScheduledRecaps) {
		savedRecap, storeErr = a.Srv().Store().ScheduledRecap().SaveIfUnderLimit(recap, limits.MaxScheduledRecaps)
		if storeErr != nil {
			var limitErr *store.ErrLimitExceeded
			if errors.As(storeErr, &limitErr) {
				return nil, model.NewAppError("CreateScheduledRecap",
					"app.scheduled_recap.max_scheduled_reached.app_error",
					map[string]any{"Limit": limits.MaxScheduledRecaps},
					"", http.StatusBadRequest)
			}
			return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.create.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	} else {
		savedRecap, storeErr = a.Srv().Store().ScheduledRecap().Save(recap)
		if storeErr != nil {
			return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.create.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	return savedRecap, nil
}

// GetScheduledRecap retrieves a scheduled recap by ID.
func (a *App) GetScheduledRecap(rctx request.CTX, id string) (*model.ScheduledRecap, *model.AppError) {
	recap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("GetScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return recap, nil
}

// GetScheduledRecapsForUser retrieves all scheduled recaps for the current user.
func (a *App) GetScheduledRecapsForUser(rctx request.CTX, page, perPage int) ([]*model.ScheduledRecap, *model.AppError) {
	userId := rctx.Session().UserId

	recaps, err := a.Srv().Store().ScheduledRecap().GetForUser(userId, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetScheduledRecapsForUser", "app.scheduled_recap.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return recaps, nil
}

// UpdateScheduledRecap updates an existing scheduled recap.
// If the recap is enabled, it recomputes NextRunAt.
func (a *App) UpdateScheduledRecap(rctx request.CTX, recap *model.ScheduledRecap) (*model.ScheduledRecap, *model.AppError) {
	existingRecap, getErr := a.Srv().Store().ScheduledRecap().Get(recap.Id)
	if getErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(getErr, &nfErr) {
			return nil, model.NewAppError("UpdateScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(getErr)
		}
		return nil, model.NewAppError("UpdateScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(getErr)
	}

	sessionUserID := rctx.Session().UserId
	if existingRecap.UserId != sessionUserID {
		return nil, model.NewAppError("UpdateScheduledRecap", "app.recap.permission_denied", nil, "", http.StatusForbidden)
	}

	recap.UserId = existingRecap.UserId
	recap.CreateAt = existingRecap.CreateAt
	recap.LastRunAt = existingRecap.LastRunAt
	recap.RunCount = existingRecap.RunCount
	recap.Enabled = existingRecap.Enabled

	// Prepare for update (sets UpdateAt)
	recap.PreUpdate()

	// Validate configuration
	if err := recap.IsValid(); err != nil {
		return nil, err
	}

	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return nil, limitsErr
	}
	if model.IsLimitEnabled(limits.MaxChannelsPerRecap) && len(recap.ChannelIds) > limits.MaxChannelsPerRecap {
		return nil, model.NewAppError("UpdateScheduledRecap",
			"app.scheduled_recap.max_channels_exceeded.app_error",
			map[string]any{
				"Limit":     limits.MaxChannelsPerRecap,
				"Requested": len(recap.ChannelIds),
			},
			"", http.StatusBadRequest)
	}

	if appErr := a.validateRecapChannelPermissions(rctx, recap.ChannelIds, "UpdateScheduledRecap"); appErr != nil {
		return nil, appErr
	}

	// If enabled, recompute NextRunAt
	if recap.Enabled {
		nextRunAt, err := recap.ComputeNextRunAt(time.Now())
		if err != nil {
			return nil, model.NewAppError("UpdateScheduledRecap", "app.scheduled_recap.compute_next_run.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		recap.NextRunAt = nextRunAt
	}

	// Update in store
	updatedRecap, storeErr := a.Srv().Store().ScheduledRecap().Update(recap)
	if storeErr != nil {
		return nil, model.NewAppError("UpdateScheduledRecap", "app.scheduled_recap.update.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return updatedRecap, nil
}

// CreateRecapFromSchedule creates a Recap from a ScheduledRecap configuration.
// This is called by the scheduled recap worker when executing a scheduled recap.
// NOTE: This method does NOT use CreateRecap because that method relies on
// rctx.Session().UserId which is not available in a job worker context.
func (a *App) CreateRecapFromSchedule(rctx request.CTX, sr *model.ScheduledRecap) (*model.Recap, *model.AppError) {
	if appErr := a.requireAIRecapsEnabled("CreateRecapFromSchedule"); appErr != nil {
		return nil, appErr
	}

	channelIDs, resolveErr := a.resolveScheduledRecapChannelIDs(sr)
	if resolveErr != nil {
		return nil, resolveErr
	}
	if len(channelIDs) == 0 {
		return nil, model.NewAppError("CreateRecapFromSchedule", "app.scheduled_recap.no_channels.app_error", nil, "", http.StatusBadRequest)
	}

	timeNow := model.GetMillis()

	// Create recap record directly (not using CreateRecap which requires session)
	recap := &model.Recap{
		Id:                model.NewId(),
		UserId:            sr.UserId, // Use UserId from ScheduledRecap, not session
		Title:             sr.Title,
		CreateAt:          timeNow,
		UpdateAt:          timeNow,
		DeleteAt:          0,
		ReadAt:            0,
		TotalMessageCount: 0,
		Status:            model.RecapStatusPending,
		BotID:             sr.AgentId,
		ScheduledRecapId:  sr.Id,
	}

	limits, limitsErr := a.GetEffectiveLimits()
	if limitsErr != nil {
		return nil, limitsErr
	}
	if model.IsLimitEnabled(limits.MaxChannelsPerRecap) && len(channelIDs) > limits.MaxChannelsPerRecap {
		return nil, recapMaxChannelsExceededError("CreateRecapFromSchedule", limits.MaxChannelsPerRecap, len(channelIDs))
	}

	var (
		savedRecap *model.Recap
		err        error
	)
	if model.IsLimitEnabled(limits.MaxRecapsPerDay) {
		startOfDayMillis, dayErr := a.getStartOfUserDayMillis(sr.UserId)
		if dayErr != nil {
			return nil, dayErr
		}

		savedRecap, err = a.Srv().Store().Recap().SaveRecapIfUnderDailyLimit(recap, startOfDayMillis, limits.MaxRecapsPerDay)
		if err != nil {
			var limitErr *store.ErrLimitExceeded
			if errors.As(err, &limitErr) {
				return nil, recapMaxRecapsReachedError("CreateRecapFromSchedule", limits.MaxRecapsPerDay)
			}
			return nil, model.NewAppError("CreateRecapFromSchedule", "app.scheduled_recap.save_recap.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		savedRecap, err = a.Srv().Store().Recap().SaveRecap(recap)
		if err != nil {
			return nil, model.NewAppError("CreateRecapFromSchedule", "app.scheduled_recap.save_recap.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Create recap job to trigger processing
	jobData := map[string]string{
		"recap_id":            savedRecap.Id,
		"user_id":             sr.UserId,
		"channel_ids":         strings.Join(channelIDs, ","),
		"agent_id":            sr.AgentId,
		"time_period":         sr.TimePeriod,
		"custom_instructions": sr.CustomInstructions,
	}

	_, jobErr := a.CreateJob(rctx, &model.Job{
		Type: model.JobTypeRecap,
		Data: jobData,
	})
	if jobErr != nil {
		// The recap row is already committed but its job never enqueued, so flag it
		// skipped to free the daily-limit slot for a recap that will never run.
		if skipErr := a.Srv().Store().Recap().MarkRecapSkipped(savedRecap.Id, model.SkipReasonJobCreationFailed); skipErr != nil {
			rctx.Logger().Warn("Failed to mark orphaned recap as skipped after job creation failure",
				mlog.String("recap_id", savedRecap.Id),
				mlog.Err(skipErr),
			)
		}
		return nil, jobErr
	}

	return savedRecap, nil
}

func (a *App) resolveScheduledRecapChannelIDs(sr *model.ScheduledRecap) ([]string, *model.AppError) {
	if sr.ChannelMode == model.ChannelModeSpecific {
		return sr.ChannelIds, nil
	}

	unreads, err := a.Srv().Store().Team().GetChannelUnreadsForAllTeams("", sr.UserId)
	if err != nil {
		return nil, model.NewAppError("CreateRecapFromSchedule", "app.scheduled_recap.get_unreads.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	channelIDs := make([]string, 0, len(unreads))
	for _, unread := range unreads {
		if unread.MsgCount > 0 || unread.MsgCountRoot > 0 {
			channelIDs = append(channelIDs, unread.ChannelId)
		}
	}

	return channelIDs, nil
}

// DeleteScheduledRecap performs a soft delete of a scheduled recap.
func (a *App) DeleteScheduledRecap(rctx request.CTX, id string) *model.AppError {
	if err := a.Srv().Store().ScheduledRecap().Delete(id); err != nil {
		return model.NewAppError("DeleteScheduledRecap", "app.scheduled_recap.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// PauseScheduledRecap disables a scheduled recap without deleting it.
func (a *App) PauseScheduledRecap(rctx request.CTX, id string) (*model.ScheduledRecap, *model.AppError) {
	// Disable the recap
	if err := a.Srv().Store().ScheduledRecap().SetEnabled(id, false); err != nil {
		return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.pause.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Fetch and return updated recap
	updatedRecap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updatedRecap, nil
}

// ResumeScheduledRecap enables a paused scheduled recap.
// It recomputes NextRunAt before enabling to ensure the next run is in the future.
func (a *App) ResumeScheduledRecap(rctx request.CTX, id string) (*model.ScheduledRecap, *model.AppError) {
	// Get existing recap to compute next run
	recap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Compute new NextRunAt
	nextRunAt, computeErr := recap.ComputeNextRunAt(time.Now())
	if computeErr != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.compute_next_run.app_error", nil, "", http.StatusBadRequest).Wrap(computeErr)
	}

	// Update NextRunAt, enable, and return in one update
	recap.NextRunAt = nextRunAt
	recap.Enabled = true
	updatedRecap, updateErr := a.Srv().Store().ScheduledRecap().Update(recap)
	if updateErr != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.resume.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	return updatedRecap, nil
}

func (a *App) validateRecapChannelPermissions(rctx request.CTX, channelIDs []string, where string) *model.AppError {
	if !a.SessionHasPermissionToChannels(rctx, *rctx.Session(), channelIDs, model.PermissionReadChannel) {
		return model.NewAppError(where, "app.recap.permission_denied", nil, "", http.StatusForbidden)
	}

	return nil
}
