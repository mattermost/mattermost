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

func (a *App) CreateView(rctx request.CTX, view *model.View) (*model.View, *model.AppError) {
	if hasPermission, _ := a.HasPermissionToChannel(rctx, view.CreatorId, view.ChannelId, model.PermissionCreatePost); !hasPermission {
		return nil, model.NewAppError("CreateView", "app.view.create.no_permission.app_error", nil, "", http.StatusForbidden)
	}

	saved, err := a.ch.srv.viewService.CreateView(view)
	if err != nil {
		return nil, model.NewAppError("CreateView", "app.view.create.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewCreated, saved)

	return saved, nil
}

func (a *App) GetView(rctx request.CTX, viewID, userID string) (*model.View, *model.AppError) {
	view, err := a.ch.srv.viewService.GetView(viewID)
	if err != nil {
		return nil, model.NewAppError("GetView", "app.view.get.app_error", nil, err.Error(), http.StatusNotFound)
	}

	if hasPermission, _ := a.HasPermissionToChannel(rctx, userID, view.ChannelId, model.PermissionReadChannel); !hasPermission {
		return nil, model.NewAppError("GetView", "app.view.get.no_permission.app_error", nil, "", http.StatusForbidden)
	}

	return view, nil
}

func (a *App) GetViewsForChannel(rctx request.CTX, channelID, userID string) ([]*model.View, *model.AppError) {
	if hasPermission, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionReadChannel); !hasPermission {
		return nil, model.NewAppError("GetViewsForChannel", "app.view.get_for_channel.no_permission.app_error", nil, "", http.StatusForbidden)
	}

	result, err := a.ch.srv.viewService.GetViewsForChannel(channelID)
	if err != nil {
		return nil, model.NewAppError("GetViewsForChannel", "app.view.get_for_channel.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return result, nil
}

func (a *App) UpdateView(rctx request.CTX, viewID, userID string, patch *model.ViewPatch) (*model.View, *model.AppError) {
	view, appErr := a.GetView(rctx, viewID, userID)
	if appErr != nil {
		return nil, appErr
	}

	if hasPermission, _ := a.HasPermissionToChannel(rctx, userID, view.ChannelId, model.PermissionCreatePost); !hasPermission {
		return nil, model.NewAppError("UpdateView", "app.view.update.no_permission.app_error", nil, "", http.StatusForbidden)
	}

	updated, err := a.ch.srv.viewService.UpdateView(view, patch)
	if err != nil {
		return nil, model.NewAppError("UpdateView", "app.view.update.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.publishViewEvent(rctx, model.WebsocketEventViewUpdated, updated)

	return updated, nil
}

func (a *App) DeleteView(rctx request.CTX, viewID, userID string) *model.AppError {
	view, appErr := a.GetView(rctx, viewID, userID)
	if appErr != nil {
		return appErr
	}

	if hasPermission, _ := a.HasPermissionToChannel(rctx, userID, view.ChannelId, model.PermissionCreatePost); !hasPermission {
		return model.NewAppError("DeleteView", "app.view.delete.no_permission.app_error", nil, "", http.StatusForbidden)
	}

	if err := a.ch.srv.viewService.DeleteView(viewID); err != nil {
		return model.NewAppError("DeleteView", "app.view.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
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
