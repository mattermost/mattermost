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

func (a *App) CreateView(rctx request.CTX, view *model.View) (*model.View, *model.AppError) {
	saved, err := a.Srv().Store().View().Save(view)
	if err != nil {
		return nil, model.NewAppError("CreateView", "app.view.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewCreated, saved)

	return saved, nil
}

func (a *App) GetView(rctx request.CTX, viewID string) (*model.View, *model.AppError) {
	view, err := a.Srv().Store().View().Get(viewID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetView", "app.view.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetView", "app.view.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return view, nil
}

func (a *App) GetViewsForChannel(rctx request.CTX, channelID string) ([]*model.View, *model.AppError) {
	result, err := a.Srv().Store().View().GetForChannel(channelID)
	if err != nil {
		return nil, model.NewAppError("GetViewsForChannel", "app.view.get_for_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return result, nil
}

func (a *App) UpdateView(rctx request.CTX, viewID string, patch *model.ViewPatch) (*model.View, *model.AppError) {
	view, appErr := a.GetView(rctx, viewID)
	if appErr != nil {
		return nil, appErr
	}

	view.Patch(patch)
	updated, err := a.Srv().Store().View().Update(view)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("UpdateView", "app.view.update.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("UpdateView", "app.view.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewUpdated, updated)

	return updated, nil
}

func (a *App) DeleteView(rctx request.CTX, viewID string) *model.AppError {
	view, appErr := a.GetView(rctx, viewID)
	if appErr != nil {
		return appErr
	}

	if err := a.Srv().Store().View().Delete(viewID, model.GetMillis()); err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("DeleteView", "app.view.delete.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeleteView", "app.view.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewDeleted, view)

	return nil
}

func (a *App) publishViewEvent(rctx request.CTX, eventType model.WebsocketEventType, view *model.View) {
	viewJSON, err := json.Marshal(view)
	if err != nil {
		rctx.Logger().Warn("Failed to encode view to JSON", mlog.Err(err))
		return
	}
	message := model.NewWebSocketEvent(eventType, "", view.ChannelId, "", nil, "")
	message.Add("view", string(viewJSON))
	a.Publish(message)
}
