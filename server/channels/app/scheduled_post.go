// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"net/http"
)

func (a *App) SaveScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, *model.AppError) {
	scheduledPost.Id = model.NewId()

	if scheduledPost.ScheduledAt < model.GetMillis() {
		return nil, model.NewAppError("App.SaveScheduledPost", "app.save_scheduled_post.save.time_in_past.app_error", nil, "", http.StatusBadRequest)
	}

	// verify user belongs to the channel
	_, appErr := a.GetChannelMember(rctx, scheduledPost.ChannelId, scheduledPost.UserId)
	if appErr != nil {
		return nil, appErr
	}

	// validate the channel is not archived
	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("App.SaveScheduledPost", "app.save_scheduled_post.channel_deleted.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	savedScheduledPost, err := a.Srv().Store().ScheduledPost().Save(scheduledPost)
	if err != nil {
		return nil, model.NewAppError("App.ScheduledPost", "app.save_scheduled_post.save.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	// TODO: add WebSocket event broadcast here

	return savedScheduledPost, nil
}
