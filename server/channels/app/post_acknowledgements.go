// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) SaveAcknowledgementForPostWithPost(c request.CTX, post *model.Post, userID string) (*model.PostAcknowledgement, *model.AppError) {
	var err *model.AppError

	if post.CreateAt == 0 {
		// Retrieve the current post to ensure we have the latest version
		post, err = a.GetSinglePost(c, post.Id, false)
		if err != nil {
			return nil, err
		}
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveAcknowledgementForPost", "api.acknowledgement.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	// Pre-populate the ChannelId to save a DB call in store
	acknowledgement := &model.PostAcknowledgement{
		PostId:    post.Id,
		UserId:    userID,
		ChannelId: post.ChannelId,
	}

	savedAck, nErr := a.Srv().Store().PostAcknowledgement().SaveWithModel(acknowledgement)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SaveAcknowledgementForPost", "app.acknowledgement.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.ResolvePersistentNotification(c, post, userID); appErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonResolvePersistentNotificationError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Error resolving persistent notification",
			mlog.String("sender_id", userID),
			mlog.String("post_id", post.RootId),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonResolvePersistentNotificationError),
			mlog.Err(appErr),
		)
		return nil, appErr
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementAdded, savedAck, post)

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return savedAck, nil
}

func (a *App) SaveAcknowledgementForPost(c request.CTX, postID, userID string) (*model.PostAcknowledgement, *model.AppError) {
	post, err := a.GetSinglePost(c, postID, false)
	if err != nil {
		return nil, err
	}

	return a.SaveAcknowledgementForPostWithPost(c, post, userID)
}

func (a *App) DeleteAcknowledgementForPostWithPost(c request.CTX, post *model.Post, userID string) *model.AppError {
	var err *model.AppError

	if post.CreateAt == 0 {
		// Retrieve the current post to ensure we have the latest version
		post, err = a.GetSinglePost(c, post.Id, false)
		if err != nil {
			return err
		}
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return err
	}

	if channel.DeleteAt > 0 {
		return model.NewAppError("DeleteAcknowledgementForPost", "api.acknowledgement.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	oldAck, nErr := a.Srv().Store().PostAcknowledgement().Get(post.Id, userID)

	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return model.NewAppError("GetPostAcknowledgement", "app.acknowledgement.get.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return model.NewAppError("GetPostAcknowledgement", "app.acknowledgement.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if model.GetMillis()-oldAck.AcknowledgedAt > 5*60*1000 {
		return model.NewAppError("DeleteAcknowledgementForPost", "api.acknowledgement.delete.deadline.app_error", nil, "", http.StatusForbidden)
	}

	nErr = a.Srv().Store().PostAcknowledgement().Delete(oldAck)
	if nErr != nil {
		return model.NewAppError("DeleteAcknowledgementForPost", "app.acknowledgement.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementRemoved, oldAck, post)

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return nil
}

func (a *App) DeleteAcknowledgementForPost(c request.CTX, postID, userID string) *model.AppError {
	post, err := a.GetSinglePost(c, postID, false)
	if err != nil {
		return err
	}

	return a.DeleteAcknowledgementForPostWithPost(c, post, userID)
}

func (a *App) GetAcknowledgementsForPost(postID string) ([]*model.PostAcknowledgement, *model.AppError) {
	acknowledgements, nErr := a.Srv().Store().PostAcknowledgement().GetForPost(postID)
	if nErr != nil {
		return nil, model.NewAppError("GetAcknowledgementsForPost", "app.acknowledgement.getforpost.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return acknowledgements, nil
}

func (a *App) GetAcknowledgementsForPostList(postList *model.PostList) (map[string][]*model.PostAcknowledgement, *model.AppError) {
	acknowledgements, err := a.Srv().Store().PostAcknowledgement().GetForPosts(postList.Order)

	if err != nil {
		return nil, model.NewAppError("GetPostAcknowledgementsForPostList", "app.acknowledgement.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	acknowledgementsMap := make(map[string][]*model.PostAcknowledgement)

	for _, ack := range acknowledgements {
		acknowledgementsMap[ack.PostId] = append(acknowledgementsMap[ack.PostId], ack)
	}

	return acknowledgementsMap, nil
}

// SaveAcknowledgementsForPostWithPost saves multiple acknowledgements for a post in a single operation.
func (a *App) SaveAcknowledgementsForPostWithPost(c request.CTX, post *model.Post, userIDs []string) ([]*model.PostAcknowledgement, *model.AppError) {
	if len(userIDs) == 0 {
		return []*model.PostAcknowledgement{}, nil
	}

	var err *model.AppError

	if post.CreateAt == 0 {
		// Retrieve the current post to ensure we have the latest version
		post, err = a.GetSinglePost(c, post.Id, false)
		if err != nil {
			return nil, err
		}
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveAcknowledgementsForPost", "api.acknowledgement.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	// Create acknowledgements with current timestamp
	acknowledgedAt := model.GetMillis()
	var acknowledgements []*model.PostAcknowledgement

	for _, userID := range userIDs {
		acknowledgements = append(acknowledgements, &model.PostAcknowledgement{
			PostId:         post.Id,
			UserId:         userID,
			ChannelId:      post.ChannelId,
			AcknowledgedAt: acknowledgedAt,
		})
	}

	// Save all acknowledgements
	savedAcks, nErr := a.Srv().Store().PostAcknowledgement().BatchSave(acknowledgements)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SaveAcknowledgementsForPost", "app.acknowledgement.batch_save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// Resolve persistent notifications for each user
	for _, userID := range userIDs {
		if appErr := a.ResolvePersistentNotification(c, post, userID); appErr != nil {
			a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonResolvePersistentNotificationError, model.NotificationNoPlatform)
			a.NotificationsLog().Error("Error resolving persistent notification",
				mlog.String("sender_id", userID),
				mlog.String("post_id", post.RootId),
				mlog.String("status", model.NotificationStatusError),
				mlog.String("reason", model.NotificationReasonResolvePersistentNotificationError),
				mlog.Err(appErr),
			)
			// We continue processing other acknowledgements even if one fails
		}
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	// Send WebSocket events for each acknowledgement
	for _, ack := range savedAcks {
		a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementAdded, ack, post)
	}

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return savedAcks, nil
}

// DeleteAcknowledgementsForPost deletes all acknowledgements for a post.
func (a *App) DeleteAcknowledgementsForPostWithPost(c request.CTX, post *model.Post) *model.AppError {
	var err *model.AppError

	if post.CreateAt == 0 {
		// Retrieve the current post to ensure we have the latest version
		post, err = a.GetSinglePost(c, post.Id, false)
		if err != nil {
			return err
		}
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return err
	}

	if channel.DeleteAt > 0 {
		return model.NewAppError("DeleteAcknowledgementsForPost", "api.acknowledgement.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	// Get all current acknowledgements
	acknowledgements, appErr := a.GetAcknowledgementsForPost(post.Id)
	if appErr != nil {
		return appErr
	}

	// No acknowledgements to delete
	if len(acknowledgements) == 0 {
		return nil
	}

	// Delete all acknowledgements
	nErr := a.Srv().Store().PostAcknowledgement().BatchDelete(acknowledgements)
	if nErr != nil {
		return model.NewAppError("DeleteAcknowledgementsForPost", "app.acknowledgement.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, ack := range acknowledgements {
		a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementRemoved, ack, post)
	}

	// Invalidate the last post time cache
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return nil
}

func (a *App) sendAcknowledgementEvent(rctx request.CTX, event model.WebsocketEventType, acknowledgement *model.PostAcknowledgement, post *model.Post) {
	// send out that a acknowledgement has been added/removed
	message := model.NewWebSocketEvent(event, "", post.ChannelId, "", nil, "")

	acknowledgementJSON, err := json.Marshal(acknowledgement)
	if err != nil {
		rctx.Logger().Warn("Failed to encode acknowledgement to JSON", mlog.Err(err))
	}
	message.Add("acknowledgement", string(acknowledgementJSON))
	a.Publish(message)
}

func (a *App) SaveAcknowledgementForPostWithModel(c request.CTX, acknowledgement *model.PostAcknowledgement) (*model.PostAcknowledgement, *model.AppError) {
	// Get the post to verify it exists and get the channel
	post, err := a.GetSinglePost(c, acknowledgement.PostId, false)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveAcknowledgementForPostWithModel", "api.acknowledgement.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	// Make sure ChannelId is set
	if acknowledgement.ChannelId == "" {
		acknowledgement.ChannelId = post.ChannelId
	}

	savedAck, nErr := a.Srv().Store().PostAcknowledgement().SaveWithModel(acknowledgement)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SaveAcknowledgementForPostWithModel", "app.acknowledgement.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if appErr := a.ResolvePersistentNotification(c, post, acknowledgement.UserId); appErr != nil {
		a.CountNotificationReason(model.NotificationStatusError, model.NotificationTypeWebsocket, model.NotificationReasonResolvePersistentNotificationError, model.NotificationNoPlatform)
		a.NotificationsLog().Error("Error resolving persistent notification",
			mlog.String("sender_id", acknowledgement.UserId),
			mlog.String("post_id", post.RootId),
			mlog.String("status", model.NotificationStatusError),
			mlog.String("reason", model.NotificationReasonResolvePersistentNotificationError),
			mlog.Err(appErr),
		)
		return nil, appErr
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementAdded, savedAck, post)

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return savedAck, nil
}

func (a *App) DeleteAcknowledgementForPostWithModel(c request.CTX, acknowledgement *model.PostAcknowledgement) *model.AppError {
	// Get the post to verify it exists and get the channel
	post, err := a.GetSinglePost(c, acknowledgement.PostId, false)
	if err != nil {
		return err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return err
	}

	if channel.DeleteAt > 0 {
		return model.NewAppError("DeleteAcknowledgementForPostWithModel", "api.acknowledgement.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	nErr := a.Srv().Store().PostAcknowledgement().Delete(acknowledgement)
	if nErr != nil {
		return model.NewAppError("DeleteAcknowledgementForPostWithModel", "app.acknowledgement.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	// The post is always modified since the UpdateAt always changes
	a.Srv().Store().Post().InvalidateLastPostTimeCache(channel.Id)

	a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementRemoved, acknowledgement, post)

	// Trigger post updated event to ensure shared channel sync
	a.sendPostUpdateEvent(c, post)

	return nil
}

func (a *App) sendPostUpdateEvent(c request.CTX, post *model.Post) {
	// Fetch the latest version of the post to ensure we have the updated timestamp
	updatedPost, err := a.GetSinglePost(c, post.Id, false)
	if err != nil {
		c.Logger().Warn("Failed to get updated post for acknowledgement sync", mlog.String("post_id", post.Id), mlog.Err(err))
		return
	}

	// Send a post edited event to trigger shared channel sync
	message := model.NewWebSocketEvent(model.WebsocketEventPostEdited, "", updatedPost.ChannelId, "", nil, "")

	// Prepare the post with metadata for the event
	preparedPost := a.PreparePostForClient(c, updatedPost, false, true, true)

	if appErr := a.publishWebsocketEventForPost(c, preparedPost, message); appErr != nil {
		c.Logger().Warn("Failed to send post update event for acknowledgement sync", mlog.String("post_id", post.Id), mlog.Err(appErr))
	}
}
