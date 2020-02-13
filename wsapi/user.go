// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitUser() {
	api.Router.Handle("user_typing", api.ApiWebSocketHandler(api.userTyping))
	api.Router.Handle("user_update_active_status", api.ApiWebSocketHandler(api.userUpdateActiveStatus))
}

func (api *API) userTyping(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	if api.App.Srv.Busy.IsBusy() {
		// this is considered a non-critical service and will be disabled when server busy.
		return nil, NewServerBusyWebSocketError(req.Action)
	}

	var ok bool
	var channelId string
	if channelId, ok = req.Data["channel_id"].(string); !ok || len(channelId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	if !api.App.SessionHasPermissionToChannel(req.Session, channelId, model.PERMISSION_CREATE_POST) {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	var parentId string
	if parentId, ok = req.Data["parent_id"].(string); !ok {
		parentId = ""
	}

	omitUsers := make(map[string]bool, 1)
	omitUsers[req.Session.UserId] = true

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_TYPING, "", channelId, "", omitUsers)
	event.Add("parent_id", parentId)
	event.Add("user_id", req.Session.UserId)
	api.App.Publish(event)

	return nil, nil
}

func (api *API) userUpdateActiveStatus(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var userIsActive bool
	if userIsActive, ok = req.Data["user_is_active"].(bool); !ok {
		return nil, NewInvalidWebSocketParamError(req.Action, "user_is_active")
	}

	var manual bool
	if manual, ok = req.Data["manual"].(bool); !ok {
		manual = false
	}

	if userIsActive {
		api.App.SetStatusOnline(req.Session.UserId, manual)
	} else {
		api.App.SetStatusAwayIfNeeded(req.Session.UserId, manual)
	}

	return nil, nil
}
