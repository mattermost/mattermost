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

func (a *App) SaveAcknowledgementForPost(c request.CTX, postID, userID string) (*model.PostAcknowledgement, *model.AppError) {
	post, err := a.GetSinglePost(c, postID, false)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("SaveAcknowledgementForPost", "api.acknowledgement.save.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	acknowledgedAt := model.GetMillis()
	acknowledgement, nErr := a.Srv().Store().PostAcknowledgement().Save(postID, userID, acknowledgedAt)
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

	a.sendAcknowledgementEvent(c, model.WebsocketEventAcknowledgementAdded, acknowledgement, post)

	return acknowledgement, nil
}

func (a *App) DeleteAcknowledgementForPost(c request.CTX, postID, userID string) *model.AppError {
	post, err := a.GetSinglePost(c, postID, false)
	if err != nil {
		return err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return err
	}

	if channel.DeleteAt > 0 {
		return model.NewAppError("DeleteAcknowledgementForPost", "api.acknowledgement.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	oldAck, nErr := a.Srv().Store().PostAcknowledgement().Get(postID, userID)

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

	return nil
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
