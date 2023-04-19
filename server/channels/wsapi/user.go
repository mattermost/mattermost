// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

func (api *API) InitUser() {
	api.Router.Handle("user_typing", api.APIWebSocketHandler(api.userTyping))
	api.Router.Handle("user_update_active_status", api.APIWebSocketHandler(api.userUpdateActiveStatus))
}

func (api *API) userTyping(req *model.WebSocketRequest) (map[string]any, *model.AppError) {
	api.App.ExtendSessionExpiryIfNeeded(&req.Session)

	if api.App.Srv().Platform().Busy.IsBusy() {
		// this is considered a non-critical service and will be disabled when server busy.
		return nil, NewServerBusyWebSocketError(req.Action)
	}

	var ok bool
	var channelId string
	if channelId, ok = req.Data["channel_id"].(string); !ok || !model.IsValidId(channelId) {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	if !api.App.SessionHasPermissionToChannel(request.EmptyContext(api.App.Log()), req.Session, channelId, model.PermissionCreatePost) {
		return nil, NewInvalidWebSocketParamError(req.Action, "channel_id")
	}

	var parentId string
	if parentId, ok = req.Data["parent_id"].(string); !ok {
		parentId = ""
	}

	appErr := api.App.PublishUserTyping(req.Session.UserId, channelId, parentId)

	return nil, appErr
}

func (api *API) userUpdateActiveStatus(req *model.WebSocketRequest) (map[string]any, *model.AppError) {
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
