// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (a *App) SaveAcknowledgementForPost(c *request.Context, userID, postID string) (*model.PostAcknowledgement, *model.AppError) {
	post, err := a.GetSinglePost(postID, false)
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

	acknowledgement, nErr := a.Srv().Store().PostAcknowledgement().Save(userID, postID)

	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SaveAcknowledgementForPost", "app.acknowledgement.save.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.DeletePersistentNotificationsPost(post, acknowledgement.UserId, true)

	a.Srv().Go(func() {
		a.sendAcknowledgementEvent(model.WebsocketEventAcknowledgementAdded, acknowledgement, post)
	})

	return acknowledgement, nil
}

func (a *App) DeleteAcknowledgementForPost(c *request.Context, userID, postID string) (*model.PostAcknowledgement, *model.AppError) {
	post, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(c, post.ChannelId)
	if err != nil {
		return nil, err
	}

	if channel.DeleteAt > 0 {
		return nil, model.NewAppError("DeleteAcknowledgementForPost", "api.acknowledgement.delete.archived_channel.app_error", nil, "", http.StatusForbidden)
	}

	oldAck, nErr := a.Srv().Store().PostAcknowledgement().Get(userID, postID)

	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetPostAcknowledgement", "app.acknowledgement.get.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetPostAcknowledgement", "app.acknowledgement.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if model.GetMillis()-oldAck.CreateAt > 5*60*1000 {
		return nil, model.NewAppError("DeleteAcknowledgementForPost", "api.acknowledgement.delete.deadline.app_error", nil, "", http.StatusForbidden)
	}

	acknowledgement, nErr := a.Srv().Store().PostAcknowledgement().Delete(userID, postID)

	if nErr != nil {
		return nil, model.NewAppError("DeleteAcknowledgementForPost", "app.acknowledgement.delete_all_with_emoji_name.get_acknowledgement.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.Srv().Go(func() {
		a.sendAcknowledgementEvent(model.WebsocketEventAcknowledgementRemoved, acknowledgement, post)
	})

	return acknowledgement, nil
}

func (a *App) GetAcknowledgementsForPost(postID string) ([]*model.PostAcknowledgement, *model.AppError) {
	_, err := a.GetSinglePost(postID, false)
	if err != nil {
		return nil, err
	}

	acknowledgements, nErr := a.Srv().Store().PostAcknowledgement().GetForPost(postID)
	if nErr != nil {
		return nil, model.NewAppError("GetAcknowledgementsForPost", "app.acknowledgement.getforpost.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return acknowledgements, nil
}

func (a *App) sendAcknowledgementEvent(event string, acknowledgement *model.PostAcknowledgement, post *model.Post) {
	// send out that a acknowledgement has been added/removed
	message := model.NewWebSocketEvent(event, "", post.ChannelId, "", nil, "")

	acknowledgementJSON, err := json.Marshal(acknowledgement)
	if err != nil {
		a.Log().Warn("Failed to encode acknowledgement to JSON", mlog.Err(err))
	}
	message.Add("acknowledgement", string(acknowledgementJSON))
	a.Publish(message)
}
