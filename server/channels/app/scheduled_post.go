// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SaveScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost, connectionId string) (*model.ScheduledPost, *model.AppError) {
	maxMessageLength := a.Srv().Store().ScheduledPost().GetMaxMessageSize()
	scheduledPost.PreSave()
	if validationErr := scheduledPost.IsValid(maxMessageLength); validationErr != nil {
		return nil, validationErr
	}

	// validate the channel is not archived
	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("App.scheduledPostPreSaveChecks", "app.save_scheduled_post.channel_deleted.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	savedScheduledPost, err := a.Srv().Store().ScheduledPost().CreateScheduledPost(scheduledPost)
	if err != nil {
		return nil, model.NewAppError("App.ScheduledPost", "app.save_scheduled_post.save.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostCreated, savedScheduledPost, connectionId)

	return savedScheduledPost, nil
}

func (a *App) GetUserTeamScheduledPosts(rctx request.CTX, userId, teamId string) ([]*model.ScheduledPost, *model.AppError) {
	scheduledPosts, err := a.Srv().Store().ScheduledPost().GetScheduledPostsForUser(userId, teamId)
	if err != nil {
		return nil, model.NewAppError("App.GetUserTeamScheduledPosts", "app.get_user_team_scheduled_posts.error", map[string]any{"user_id": userId, "team_id": teamId}, "", http.StatusInternalServerError)
	}

	if scheduledPosts == nil {
		scheduledPosts = []*model.ScheduledPost{}
	}

	for _, scheduledPost := range scheduledPosts {
		a.prepareDraftWithFileInfos(rctx, userId, &scheduledPost.Draft)
	}

	return scheduledPosts, nil
}

func (a *App) UpdateScheduledPost(rctx request.CTX, userId string, scheduledPost *model.ScheduledPost, connectionId string) (*model.ScheduledPost, *model.AppError) {
	maxMessageLength := a.Srv().Store().ScheduledPost().GetMaxMessageSize()
	scheduledPost.PreUpdate()
	if validationErr := scheduledPost.IsValid(maxMessageLength); validationErr != nil {
		return nil, validationErr
	}

	// validate the scheduled post belongs to the said user
	existingScheduledPost, err := a.Srv().Store().ScheduledPost().Get(scheduledPost.Id)
	if err != nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.get_scheduled_post.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusInternalServerError)
	}

	if existingScheduledPost == nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.existing_scheduled_post.not_exist", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusNotFound)
	}

	if existingScheduledPost.UserId != userId {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.update_permission.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusForbidden)
	}

	// This step is not required for update but is useful as we want to return the
	// updated scheduled post. It's better to do this before calling update than after.
	scheduledPost.RestoreNonUpdatableFields(existingScheduledPost)

	if err := a.Srv().Store().ScheduledPost().UpdatedScheduledPost(scheduledPost); err != nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.update.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusInternalServerError)
	}

	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostUpdated, scheduledPost, connectionId)

	return scheduledPost, nil
}

func (a *App) DeleteScheduledPost(rctx request.CTX, userId, scheduledPostId, connectionId string) (*model.ScheduledPost, *model.AppError) {
	scheduledPost, err := a.Srv().Store().ScheduledPost().Get(scheduledPostId)
	if err != nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.get_scheduled_post.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusInternalServerError)
	}

	if scheduledPost == nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.existing_scheduled_post.not_exist", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusNotFound)
	}

	if scheduledPost.UserId != userId {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.delete_permission.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusForbidden)
	}

	if err := a.Srv().Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPostId}); err != nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.delete_error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusInternalServerError)
	}

	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostDeleted, scheduledPost, connectionId)

	return scheduledPost, nil
}

func (a *App) PublishScheduledPostEvent(rctx request.CTX, eventType model.WebsocketEventType, scheduledPost *model.ScheduledPost, connectionId string) {
	if scheduledPost == nil {
		rctx.Logger().Warn("publishScheduledPostEvent called with nil scheduledPost")
		return
	}
	message := model.NewWebSocketEvent(eventType, "", "", scheduledPost.UserId, nil, connectionId)
	scheduledPostJSON, jsonErr := json.Marshal(scheduledPost)
	if jsonErr != nil {
		rctx.Logger().Warn("publishScheduledPostEvent - Failed to Marshal", mlog.Err(jsonErr))
		return
	}
	message.Add("scheduledPost", string(scheduledPostJSON))
	a.Publish(message)
}
