// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitSystem() {
	api.Router.Handle("ping", api.APIWebSocketHandler(ping))
	api.Router.Handle("posted_ack", api.APIWebSocketHandler(api.websocketNotificationAck))
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
	// Log the ack
	api.App.Metrics().IncrementWebsocketEvent(model.WebsocketPostedAck)

	// Log if the websocket event resulted in a notification
	api.App.NotificationsLog().Debug("Websocket notification acknowledgment",
		mlog.String("type", model.TypeWebsocket),
		mlog.String("user_id", req.Session.UserId),
		mlog.Any("user_agent", req.Data["user_agent"]),
		mlog.Any("post_id", req.Data["post_id"]),
		mlog.Any("result", req.Data["result"]),
		mlog.Any("reason", req.Data["reason"]),
		mlog.Any("data", req.Data["data"]),
	)

	return nil, nil
}
