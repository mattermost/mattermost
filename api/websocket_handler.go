// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func ApiWebSocketHandler(wh func(*model.WebSocketRequest) (map[string]interface{}, *model.AppError)) *webSocketHandler {
	return &webSocketHandler{wh}
}

type webSocketHandler struct {
	handlerFunc func(*model.WebSocketRequest) (map[string]interface{}, *model.AppError)
}

func (wh *webSocketHandler) ServeWebSocket(conn *WebConn, r *model.WebSocketRequest) {
	l4g.Debug("/api/v3/users/websocket:%s", r.Action)

	r.Session = *GetSession(conn.SessionToken)
	r.T = conn.T
	r.Locale = conn.Locale

	var data map[string]interface{}
	var err *model.AppError

	if data, err = wh.handlerFunc(r); err != nil {
		l4g.Error(utils.T("api.web_socket_handler.log.error"), "/api/v3/users/websocket", r.Action, r.Seq, r.Session.UserId, err.SystemMessage(utils.T), err.DetailedError)
		err.DetailedError = ""
		conn.Send <- model.NewWebSocketError(r.Seq, err)
		return
	}

	conn.Send <- model.NewWebSocketResponse(model.STATUS_OK, r.Seq, data)
}

func NewInvalidWebSocketParamError(action string, name string) *model.AppError {
	return model.NewLocAppError("/api/v3/users/websocket:"+action, "api.websocket_handler.invalid_param.app_error", map[string]interface{}{"Name": name}, "")
}
