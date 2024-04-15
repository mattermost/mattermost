// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitSystem() {
	api.Router.Handle("ping", api.APIWebSocketHandler(ping))
	api.Router.Handle(model.WebsocketPostedNotifyAck, api.APIWebSocketHandler(api.websocketNotificationAck))
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
	api.App.NotificationsLog().Debug("Websocket notification acknowledgment",
		mlog.String("type", model.NotificationTypeWebsocket),
		mlog.String("user_id", req.Session.UserId),
		mlog.Any("user_agent", req.Data["user_agent"]),
		mlog.Any("post_id", req.Data["post_id"]),
		mlog.Any("status", req.Data["status"]),
		mlog.Any("reason", req.Data["reason"]),
		mlog.Any("data", req.Data["data"]),
	)

	// Count metrics for websocket acks
	api.App.CountNotificationAck(model.NotificationTypeWebsocket)

	status := req.Data["status"]
	reason := req.Data["reason"]
	if status == nil || reason == nil {
		return nil, nil
	}

	api.App.CountNotificationReason(model.NotificationStatus(status.(string)), model.NotificationTypeWebsocket, model.NotificationReason(reason.(string)))

	return nil, nil
}
