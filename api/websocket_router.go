// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type WebSocketRouter struct {
	handlers map[string]*webSocketHandler
}

func NewWebSocketRouter() *WebSocketRouter {
	router := &WebSocketRouter{}
	router.handlers = make(map[string]*webSocketHandler)
	return router
}

func (wr *WebSocketRouter) Handle(action string, handler *webSocketHandler) {
	wr.handlers[action] = handler
}

func (wr *WebSocketRouter) ServeWebSocket(conn *WebConn, r *model.WebSocketRequest) {
	if r.Action == "" {
		err := model.NewLocAppError("ServeWebSocket", "api.web_socket_router.no_action.app_error", nil, "")
		wr.ReturnWebSocketError(conn, r, err)
		return
	}

	if r.Seq <= 0 {
		err := model.NewLocAppError("ServeWebSocket", "api.web_socket_router.bad_seq.app_error", nil, "")
		wr.ReturnWebSocketError(conn, r, err)
		return
	}

	var handler *webSocketHandler
	if h, ok := wr.handlers[r.Action]; !ok {
		err := model.NewLocAppError("ServeWebSocket", "api.web_socket_router.bad_action.app_error", nil, "")
		wr.ReturnWebSocketError(conn, r, err)
		return
	} else {
		handler = h
	}

	handler.ServeWebSocket(conn, r)
}

func (wr *WebSocketRouter) ReturnWebSocketError(conn *WebConn, r *model.WebSocketRequest, err *model.AppError) {
	l4g.Error(utils.T("api.web_socket_router.log.error"), r.Seq, conn.UserId, err.SystemMessage(utils.T), err.DetailedError)

	err.DetailedError = ""
	errorResp := model.NewWebSocketError(r.Seq, err)

	conn.Send <- errorResp
}
