// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateScheduledRecap creates a new scheduled recap with validated inputs.
// It sets the user ID from the session, validates the recap configuration,
// computes the initial NextRunAt, and saves to the store.
func (a *App) CreateScheduledRecap(rctx request.CTX, recap *model.ScheduledRecap) (*model.ScheduledRecap, *model.AppError) {
	// Set user ID from session
	recap.UserId = rctx.Session().UserId

	// Prepare for save (generates ID, timestamps)
	recap.PreSave()

	// Validate configuration
	if err := recap.IsValid(); err != nil {
		return nil, err
	}

	// Validate channel access when using specific channel mode
	if recap.ChannelMode == model.ChannelModeSpecific {
		for _, channelID := range recap.ChannelIds {
			if hasPermission, _ := a.HasPermissionToChannel(rctx, recap.UserId, channelID, model.PermissionReadChannel); !hasPermission {
				return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.channel_access_denied.app_error", nil, "channel_id="+channelID, http.StatusForbidden)
			}
		}
	}

	// Compute NextRunAt before saving
	nextRunAt, err := recap.ComputeNextRunAt(time.Now())
	if err != nil {
		return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.compute_next_run.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	recap.NextRunAt = nextRunAt

	// Save to store
	savedRecap, storeErr := a.Srv().Store().ScheduledRecap().Save(recap)
	if storeErr != nil {
		return nil, model.NewAppError("CreateScheduledRecap", "app.scheduled_recap.create.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return savedRecap, nil
}

// GetScheduledRecap retrieves a scheduled recap by ID.
func (a *App) GetScheduledRecap(rctx request.CTX, id string) (*model.ScheduledRecap, *model.AppError) {
	recap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		return nil, model.NewAppError("GetScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
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
	// Prepare for update (sets UpdateAt)
	recap.PreUpdate()

	// Validate configuration
	if err := recap.IsValid(); err != nil {
		return nil, err
	}

	// Validate channel access when using specific channel mode
	if recap.ChannelMode == model.ChannelModeSpecific {
		for _, channelID := range recap.ChannelIds {
			if hasPermission, _ := a.HasPermissionToChannel(rctx, recap.UserId, channelID, model.PermissionReadChannel); !hasPermission {
				return nil, model.NewAppError("UpdateScheduledRecap", "app.scheduled_recap.channel_access_denied.app_error", nil, "channel_id="+channelID, http.StatusForbidden)
			}
		}
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
	var channelIDs []string

	if sr.ChannelMode == model.ChannelModeSpecific {
		channelIDs = sr.ChannelIds
	} else {
		// all_unreads mode: get user's channels with unread messages
		// For now, use the specified channel IDs as fallback
		// TODO: Implement GetChannelsWithUnreadForUser when all_unreads mode is needed
		channelIDs = sr.ChannelIds
	}

	// Filter channels to only those the user currently has access to.
	// This handles the case where the user lost access between scheduling and execution.
	accessibleChannelIDs := make([]string, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if hasPermission, _ := a.HasPermissionToChannel(rctx, sr.UserId, channelID, model.PermissionReadChannel); hasPermission {
			accessibleChannelIDs = append(accessibleChannelIDs, channelID)
		}
	}
	channelIDs = accessibleChannelIDs

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
	}

	savedRecap, err := a.Srv().Store().Recap().SaveRecap(recap)
	if err != nil {
		return nil, model.NewAppError("CreateRecapFromSchedule", "app.scheduled_recap.save_recap.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Create recap job to trigger processing
	jobData := map[string]string{
		"recap_id":    savedRecap.Id,
		"user_id":     sr.UserId,
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    sr.AgentId,
	}

	_, jobErr := a.CreateJob(rctx, &model.Job{
		Type: model.JobTypeRecap,
		Data: jobData,
	})
	if jobErr != nil {
		return nil, jobErr
	}

	return savedRecap, nil
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
	// Verify recap exists
	_, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Disable the recap
	if err := a.Srv().Store().ScheduledRecap().SetEnabled(id, false); err != nil {
		return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.pause.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Fetch and return updated recap
	updatedRecap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		return nil, model.NewAppError("PauseScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updatedRecap, nil
}

// ResumeScheduledRecap enables a paused scheduled recap.
// It recomputes NextRunAt before enabling to ensure the next run is in the future.
func (a *App) ResumeScheduledRecap(rctx request.CTX, id string) (*model.ScheduledRecap, *model.AppError) {
	// Get existing recap
	recap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Compute new NextRunAt
	nextRunAt, computeErr := recap.ComputeNextRunAt(time.Now())
	if computeErr != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.compute_next_run.app_error", nil, "", http.StatusBadRequest).Wrap(computeErr)
	}

	// Update NextRunAt
	if err := a.Srv().Store().ScheduledRecap().UpdateNextRunAt(id, nextRunAt); err != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.update_next_run.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Enable the recap
	if err := a.Srv().Store().ScheduledRecap().SetEnabled(id, true); err != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.resume.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Fetch and return updated recap
	updatedRecap, err := a.Srv().Store().ScheduledRecap().Get(id)
	if err != nil {
		return nil, model.NewAppError("ResumeScheduledRecap", "app.scheduled_recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updatedRecap, nil
}
