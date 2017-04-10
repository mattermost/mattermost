// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitWebrtc() {
	l4g.Debug(utils.T("wsapi.webtrc.init.debug"))

	app.Srv.WebSocketRouter.Handle("webrtc", ApiWebSocketHandler(webrtcMessage))
}

func webrtcMessage(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var toUserId string
	if toUserId, ok = req.Data["to_user_id"].(string); !ok || len(toUserId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "to_user_id")
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_WEBRTC, "", "", toUserId, nil)
	event.Data = req.Data
	go app.Publish(event)

	return nil, nil
}
