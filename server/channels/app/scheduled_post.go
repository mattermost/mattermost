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

// recurringScheduledPostsEnabled gates turning recurrence on. The api4 routes already enforce
// the ScheduledPosts setting and license for every scheduled post request, and the job keeps
// sending existing recurring series regardless of the flag.
func (a *App) recurringScheduledPostsEnabled() bool {
	return a.Config().FeatureFlags.RecurringScheduledPosts
}

func recurringScheduledPostsDisabledError(where string) *model.AppError {
	return model.NewAppError(where, "app.scheduled_post.recurring_disabled.app_error", nil, "", http.StatusBadRequest)
}

func (a *App) SaveScheduledPost(rctx request.CTX, scheduledPost *model.ScheduledPost, connectionId string) (*model.ScheduledPost, *model.AppError) {
	maxMessageLength := a.Srv().Store().ScheduledPost().GetMaxMessageSize()
	scheduledPost.PreSave()
	if validationErr := scheduledPost.IsValid(maxMessageLength); validationErr != nil {
		return nil, validationErr
	}

	if scheduledPost.RepeatType != model.ScheduledPostRepeatTypeNone && !a.recurringScheduledPostsEnabled() {
		return nil, recurringScheduledPostsDisabledError("App.SaveScheduledPost")
	}

	// validate the channel is not archived
	channel, appErr := a.GetChannel(rctx, scheduledPost.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	restrictDM, appErr := a.CheckIfChannelIsRestrictedDM(rctx, channel)
	if appErr != nil {
		return nil, appErr
	}

	if restrictDM {
		err := model.NewAppError("App.scheduledPostPreSaveChecks", "app.save_scheduled_post.restricted_dm.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("App.scheduledPostPreSaveChecks", "app.save_scheduled_post.channel_deleted.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest)
	}

	scheduledPost, appErr = a.runGuardedScheduledPostWillBeCreated(rctx, scheduledPost, "SaveScheduledPost", func(reason string) *model.AppError {
		return model.NewAppError("SaveScheduledPost", "app.scheduled_post.save.rejected_by_plugin", map[string]any{"Reason": reason}, "", http.StatusBadRequest)
	})
	if appErr != nil {
		return nil, appErr
	}

	savedScheduledPost, err := a.Srv().Store().ScheduledPost().CreateScheduledPost(rctx, scheduledPost)
	if err != nil {
		return nil, model.NewAppError("App.ScheduledPost", "app.save_scheduled_post.save.app_error", map[string]any{"user_id": scheduledPost.UserId, "channel_id": scheduledPost.ChannelId}, "", http.StatusBadRequest).Wrap(err)
	}

	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostCreated, savedScheduledPost, connectionId)

	return savedScheduledPost, nil
}

func (a *App) GetUserTeamScheduledPosts(rctx request.CTX, userId, teamId string) ([]*model.ScheduledPost, *model.AppError) {
	scheduledPosts, err := a.Srv().Store().ScheduledPost().GetScheduledPostsForUser(rctx, userId, teamId)
	if err != nil {
		return nil, model.NewAppError("App.GetUserTeamScheduledPosts", "app.get_user_team_scheduled_posts.error", map[string]any{"user_id": userId, "team_id": teamId}, "", http.StatusInternalServerError).Wrap(err)
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

	existingScheduledPost, err := a.Srv().Store().ScheduledPost().Get(rctx, scheduledPost.Id)
	if err != nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.get_scheduled_post.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusInternalServerError).Wrap(err)
	}

	if existingScheduledPost == nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.existing_scheduled_post.not_exist", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusNotFound)
	}

	// Only turning recurrence ON is blocked while the flag is off; editing or rescheduling an
	// already-recurring post and turning recurrence off must stay possible so users can manage
	// series created while the flag was on.
	if scheduledPost.RepeatType != model.ScheduledPostRepeatTypeNone &&
		existingScheduledPost.RepeatType == model.ScheduledPostRepeatTypeNone &&
		!a.recurringScheduledPostsEnabled() {
		return nil, recurringScheduledPostsDisabledError("App.UpdateScheduledPost")
	}

	// This step is not required for update but is useful as we want to return the
	// updated scheduled post. It's better to do this before calling update than after.
	scheduledPost.RestoreNonUpdatableFields(existingScheduledPost)
	scheduledPost.ErrorCode = ""
	scheduledPost.ProcessedAt = 0

	var appErr *model.AppError
	scheduledPost, appErr = a.runGuardedScheduledPostWillBeCreated(rctx, scheduledPost, "UpdateScheduledPost", func(reason string) *model.AppError {
		return model.NewAppError("UpdateScheduledPost", "app.scheduled_post.update.rejected_by_plugin", map[string]any{"Reason": reason}, "", http.StatusBadRequest)
	})
	if appErr != nil {
		return nil, appErr
	}

	if err := a.Srv().Store().ScheduledPost().UpdatedScheduledPost(rctx, scheduledPost); err != nil {
		return nil, model.NewAppError("app.UpdateScheduledPost", "app.update_scheduled_post.update.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPost.Id}, "", http.StatusInternalServerError).Wrap(err)
	}

	a.PublishScheduledPostEvent(rctx, model.WebsocketScheduledPostUpdated, scheduledPost, connectionId)

	return scheduledPost, nil
}

func (a *App) DeleteScheduledPost(rctx request.CTX, userId, scheduledPostId, connectionId string) (*model.ScheduledPost, *model.AppError) {
	scheduledPost, err := a.Srv().Store().ScheduledPost().Get(rctx, scheduledPostId)
	if err != nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.get_scheduled_post.error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusInternalServerError).Wrap(err)
	}

	if scheduledPost == nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.existing_scheduled_post.not_exist", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusNotFound)
	}

	if err := a.Srv().Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPostId}); err != nil {
		return nil, model.NewAppError("app.DeleteScheduledPost", "app.delete_scheduled_post.delete_error", map[string]any{"user_id": userId, "scheduled_post_id": scheduledPostId}, "", http.StatusInternalServerError).Wrap(err)
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
