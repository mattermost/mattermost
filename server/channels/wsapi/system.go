// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitSystem() {
	api.Router.Handle("ping", api.APIWebSocketHandler(ping))
	api.Router.Handle(string(model.WebsocketPostedNotifyAck), api.APIWebSocketHandler(api.websocketNotificationAck))
}

func ping(req *model.WebSocketRequest) (map[string]any, *model.AppError) {
	data := map[string]any{}
	data["text"] = "pong"
	data["version"] = model.CurrentVersion
	data["server_time"] = model.GetMillis()
	data["node_id"] = ""

	return data, nil
}

func (api *API) websocketNotificationAck(req *model.WebSocketRequest) (map[string]any, *model.AppError) {
	// Log the ACKs if necessary
	api.App.Log().LogM(mlog.MlvlNotificationDebug, "Websocket notification acknowledgment",
		mlog.String("type", model.NotificationTypeWebsocket),
		mlog.String("user_id", req.Session.UserId),
		mlog.Any("user_agent", req.Data["user_agent"]),
		mlog.Any("post_id", req.Data["post_id"]),
		mlog.Any("status", req.Data["status"]),
		mlog.Any("reason", req.Data["reason"]),
		mlog.Any("data", req.Data["data"]),
	)

	// Count metrics for websocket acks
	api.App.CountNotificationAck(model.NotificationTypeWebsocket, model.NotificationNoPlatform)

	status := req.Data["status"]
	reason := req.Data["reason"]
	if status == nil {
		return nil, nil
	}

	statusStr, ok := status.(string)
	if !ok {
		return nil, NewInvalidWebSocketParamError(req.Action, "status")
	}

	notificationStatus := model.NotificationStatus(statusStr)
	if reason == nil && notificationStatus != model.NotificationStatusSuccess {
		return nil, nil
	}
	var notificationReason model.NotificationReason
	if reason != nil {
		reasonStr, ok := reason.(string)
		if !ok {
			return nil, NewInvalidWebSocketParamError(req.Action, "reason")
		}
		notificationReason = model.NotificationReason(reasonStr)
	}

	api.App.CountNotificationReason(
		notificationStatus,
		model.NotificationTypeWebsocket,
		notificationReason,
		model.NotificationNoPlatform,
	)

	return nil, nil
}
