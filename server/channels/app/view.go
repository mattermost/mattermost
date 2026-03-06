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
	if view == nil {
		return nil, model.NewAppError("CreateView", "app.view.create.nil_view.app_error", nil, "view is nil", http.StatusBadRequest)
	}
	saved, err := a.Srv().Store().View().Save(view)
	if err != nil {
		var appErr *model.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
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
			return nil, model.NewAppError("GetView", "app.view.get.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetView", "app.view.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return view, nil
}

func (a *App) GetViewsForChannel(rctx request.CTX, channelID string, opts model.ViewQueryOpts) ([]*model.View, *model.AppError) {
	result, err := a.Srv().Store().View().GetForChannel(channelID, opts)
	if err != nil {
		var invErr *store.ErrInvalidInput
		if errors.As(err, &invErr) {
			return nil, model.NewAppError("GetViewsForChannel", "app.view.get_for_channel.invalid_input.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return nil, model.NewAppError("GetViewsForChannel", "app.view.get_for_channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if result == nil {
		result = []*model.View{}
	}

	return result, nil
}

func (a *App) UpdateView(rctx request.CTX, view *model.View, patch *model.ViewPatch) (*model.View, *model.AppError) {
	if view == nil {
		return nil, model.NewAppError("UpdateView", "app.view.update.nil_view.app_error", nil, "view is nil", http.StatusBadRequest)
	}
	view = view.Clone()
	view.Patch(patch)
	updated, err := a.Srv().Store().View().Update(view)
	if err != nil {
		var appErr *model.AppError
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateView", "app.view.update.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateView", "app.view.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewUpdated, updated)

	return updated, nil
}

func (a *App) DeleteView(rctx request.CTX, view *model.View) *model.AppError {
	if view == nil {
		return model.NewAppError("DeleteView", "app.view.delete.nil_view.app_error", nil, "view is nil", http.StatusBadRequest)
	}
	if err := a.Srv().Store().View().Delete(view.Id, model.GetMillis()); err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("DeleteView", "app.view.delete.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeleteView", "app.view.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Delete events send only the view ID (not the full view JSON) since consumers
	// only need the ID to remove the view from state. Create/Update use publishViewEvent
	// to send the full view.
	message := model.NewWebSocketEvent(model.WebsocketEventViewDeleted, "", view.ChannelId, "", nil, "")
	message.Add("view_id", view.Id)
	a.Publish(message)

	return nil
}

func (a *App) publishViewEvent(rctx request.CTX, eventType model.WebsocketEventType, view *model.View) {
	if view == nil {
		return
	}
	viewJSON, err := json.Marshal(view)
	if err != nil {
		rctx.Logger().Warn("Failed to encode view to JSON", mlog.Err(err))
		return
	}
	message := model.NewWebSocketEvent(eventType, "", view.ChannelId, "", nil, "")
	message.Add("view", string(viewJSON))
	a.Publish(message)
}
