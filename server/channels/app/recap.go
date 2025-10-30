// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CreateRecap creates a new recap job for the specified channels
func (a *App) CreateRecap(rctx request.CTX, userID string, title string, channelIDs []string, agentID string) (*model.Recap, *model.AppError) {
	// Validate user is member of all channels
	for _, channelID := range channelIDs {
		if !a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionReadChannel) {
			return nil, model.NewAppError("CreateRecap", "app.recap.create.permission_denied", nil, "", http.StatusForbidden)
		}
	}

	// Create recap record
	recap := &model.Recap{
		Id:                model.NewId(),
		UserId:            userID,
		Title:             title,
		CreateAt:          model.GetMillis(),
		UpdateAt:          model.GetMillis(),
		DeleteAt:          0,
		ReadAt:            0,
		TotalMessageCount: 0,
		Status:            model.RecapStatusPending,
		BotID:             agentID,
	}

	savedRecap, err := a.Srv().Store().Recap().SaveRecap(recap)
	if err != nil {
		return nil, model.NewAppError("CreateRecap", "app.recap.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Create background job
	jobData := map[string]string{
		"recap_id":    recap.Id,
		"user_id":     userID,
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    agentID,
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

// GetRecap retrieves a recap by ID (with permission check)
func (a *App) GetRecap(rctx request.CTX, userID, recapID string) (*model.Recap, *model.AppError) {
	recap, err := a.Srv().Store().Recap().GetRecap(recapID)
	if err != nil {
		return nil, model.NewAppError("GetRecap", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Only owner can view
	if recap.UserId != userID {
		return nil, model.NewAppError("GetRecap", "app.recap.get.permission_denied", nil, "", http.StatusForbidden)
	}

	// Load channels
	channels, err := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	if err != nil {
		return nil, model.NewAppError("GetRecap", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	recap.Channels = channels

	return recap, nil
}

// GetRecapsForUser retrieves all recaps for a user
func (a *App) GetRecapsForUser(rctx request.CTX, userID string, page, perPage int) ([]*model.Recap, *model.AppError) {
	recaps, err := a.Srv().Store().Recap().GetRecapsForUser(userID, page, perPage)
	if err != nil {
		return nil, model.NewAppError("GetRecapsForUser", "app.recap.list.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return recaps, nil
}

// MarkRecapAsRead marks a recap as read
func (a *App) MarkRecapAsRead(rctx request.CTX, userID, recapID string) (*model.Recap, *model.AppError) {
	// Get the recap first to check ownership
	recap, err := a.Srv().Store().Recap().GetRecap(recapID)
	if err != nil {
		return nil, model.NewAppError("MarkRecapAsRead", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Only owner can mark as read
	if recap.UserId != userID {
		return nil, model.NewAppError("MarkRecapAsRead", "app.recap.mark_read.permission_denied", nil, "", http.StatusForbidden)
	}

	// Mark as read
	if markErr := a.Srv().Store().Recap().MarkRecapAsRead(recapID); markErr != nil {
		return nil, model.NewAppError("MarkRecapAsRead", "app.recap.mark_read.app_error", nil, "", http.StatusInternalServerError).Wrap(markErr)
	}

	// Return updated recap
	updatedRecap, getErr := a.Srv().Store().Recap().GetRecap(recapID)
	if getErr != nil {
		return nil, model.NewAppError("MarkRecapAsRead", "app.recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(getErr)
	}

	return updatedRecap, nil
}

// RegenerateRecap regenerates an existing recap
func (a *App) RegenerateRecap(rctx request.CTX, userID, recapID string) (*model.Recap, *model.AppError) {
	// Get the recap first to check ownership
	recap, err := a.Srv().Store().Recap().GetRecap(recapID)
	if err != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Only owner can regenerate
	if recap.UserId != userID {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.regenerate.permission_denied", nil, "", http.StatusForbidden)
	}

	// Get existing recap channels to extract channel IDs
	channels, err := a.Srv().Store().Recap().GetRecapChannelsByRecapId(recapID)
	if err != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.get_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Extract channel IDs
	channelIDs := make([]string, len(channels))
	for i, channel := range channels {
		channelIDs[i] = channel.ChannelId
	}

	// Delete existing recap channels
	if deleteErr := a.Srv().Store().Recap().DeleteRecapChannels(recapID); deleteErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.delete_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	// Update recap status to pending and reset read status
	recap.Status = model.RecapStatusPending
	recap.ReadAt = 0
	recap.UpdateAt = model.GetMillis()
	recap.TotalMessageCount = 0

	if _, updateErr := a.Srv().Store().Recap().UpdateRecap(recap); updateErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.update.app_error", nil, "", http.StatusInternalServerError).Wrap(updateErr)
	}

	// Create new job with same parameters
	jobData := map[string]string{
		"recap_id":    recapID,
		"user_id":     userID,
		"channel_ids": strings.Join(channelIDs, ","),
		"agent_id":    recap.BotID,
	}

	_, jobErr := a.CreateJob(rctx, &model.Job{
		Type: model.JobTypeRecap,
		Data: jobData,
	})

	if jobErr != nil {
		return nil, jobErr
	}

	// Return updated recap
	updatedRecap, getErr := a.Srv().Store().Recap().GetRecap(recapID)
	if getErr != nil {
		return nil, model.NewAppError("RegenerateRecap", "app.recap.get.app_error", nil, "", http.StatusInternalServerError).Wrap(getErr)
	}

	return updatedRecap, nil
}

// DeleteRecap deletes a recap (soft delete)
func (a *App) DeleteRecap(rctx request.CTX, userID, recapID string) *model.AppError {
	// Get the recap first to check ownership
	recap, err := a.Srv().Store().Recap().GetRecap(recapID)
	if err != nil {
		return model.NewAppError("DeleteRecap", "app.recap.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
	}

	// Only owner can delete
	if recap.UserId != userID {
		return model.NewAppError("DeleteRecap", "app.recap.delete.permission_denied", nil, "", http.StatusForbidden)
	}

	// Delete recap
	if deleteErr := a.Srv().Store().Recap().DeleteRecap(recapID); deleteErr != nil {
		return model.NewAppError("DeleteRecap", "app.recap.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(deleteErr)
	}

	return nil
}
