// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) SaveScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, *model.AppError) {
	scheduledPost.PreSave()
	if validationErr := scheduledPost.BaseIsValid(); validationErr != nil {
		return nil, validationErr
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

	savedScheduledPost, err := a.Srv().Store().ScheduledPost().CreateScheduledPost(scheduledPost)
	if err != nil {
		return nil, model.NewAppError("App.ScheduledPost", "app.save_scheduled_post.save.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	// TODO: add WebSocket event broadcast here

	return savedScheduledPost, nil
}

func (a *App) GetUserTeamScheduledPosts(rctx request.CTX, userId, teamId string) ([]*model.ScheduledPost, *model.AppError) {
	if teamId != "" {
		hasPermissionToTeam := a.HasPermissionToTeam(rctx, userId, teamId, model.PermissionViewTeam)
		if !hasPermissionToTeam {
			return nil, model.NewAppError("App.GetUserTeamScheduledPosts", "app.get_user_team_scheduled_posts.team_permission_error", map[string]any{"user_id": userId, "team_id": teamId}, "", http.StatusForbidden)
		}
	}

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
