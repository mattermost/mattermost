// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

func InitWebrtc() {
	l4g.Debug(utils.T("api.webrtc.init.debug"))

	BaseRoutes.Webrtc.Handle("/token", ApiUserRequired(webrtcToken)).Methods("POST")

	BaseRoutes.WebSocket.Handle("webrtc", ApiWebSocketHandler(webrtcMessage))
}

func webrtcToken(c *Context, w http.ResponseWriter, r *http.Request) {
	webrtcInterface := einterfaces.GetWebrtcInterface()

	if webrtcInterface == nil {
		c.Err = model.NewLocAppError("webrtcToken", "api.webrtc.not_available.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if result, err := webrtcInterface.Token(c.Session.Id); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.MapToJson(result)))
	}
}

func webrtcMessage(req *model.WebSocketRequest) (map[string]interface{}, *model.AppError) {
	var ok bool
	var toUserId string
	if toUserId, ok = req.Data["to_user_id"].(string); !ok || len(toUserId) != 26 {
		return nil, NewInvalidWebSocketParamError(req.Action, "to_user_id")
	}

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_WEBRTC, "", "", toUserId, nil)
	event.Data = req.Data
	go Publish(event)

	return nil, nil
}
