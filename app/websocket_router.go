// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type webSocketHandler interface {
	ServeWebSocket(*WebConn, *model.WebSocketRequest)
}

type WebSocketRouter struct {
	app      *App
	handlers map[string]webSocketHandler
}

func (wr *WebSocketRouter) Handle(action string, handler webSocketHandler) {
	wr.handlers[action] = handler
}

func (wr *WebSocketRouter) ServeWebSocket(conn *WebConn, r *model.WebSocketRequest) {
	if r.Action == "" {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.no_action.app_error", nil, "", http.StatusBadRequest)
		ReturnWebSocketError(conn, r, err)
		return
	}

	if r.Seq <= 0 {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_seq.app_error", nil, "", http.StatusBadRequest)
		ReturnWebSocketError(conn, r, err)
		return
	}

	if r.Action == model.WEBSOCKET_AUTHENTICATION_CHALLENGE {
		if conn.GetSessionToken() != "" {
			return
		}

		token, ok := r.Data["token"].(string)
		if !ok {
			conn.WebSocket.Close()
			return
		}

		session, err := wr.app.GetSession(token)
		if err != nil {
			conn.WebSocket.Close()
			return
		}

		wr.app.Srv.Go(func() {
			wr.app.SetStatusOnline(session.UserId, false)
			wr.app.UpdateLastActivityAtIfNeeded(*session)
		})

		conn.SetSession(session)
		conn.SetSessionToken(session.Token)
		conn.UserId = session.UserId

		wr.app.HubRegister(conn)

		resp := model.NewWebSocketResponse(model.STATUS_OK, r.Seq, nil)
		conn.Send <- resp

		return
	}

	if !conn.IsAuthenticated() {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.not_authenticated.app_error", nil, "", http.StatusUnauthorized)
		ReturnWebSocketError(conn, r, err)
		return
	}

	handler, ok := wr.handlers[r.Action]
	if !ok {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_action.app_error", nil, "", http.StatusInternalServerError)
		ReturnWebSocketError(conn, r, err)
		return
	}

	handler.ServeWebSocket(conn, r)
}

func ReturnWebSocketError(conn *WebConn, r *model.WebSocketRequest, err *model.AppError) {
	mlog.Error(
		"websocket routing error.",
		mlog.Int64("seq", r.Seq),
		mlog.String("user_id", conn.UserId),
		mlog.String("system_message", err.SystemMessage(utils.T)),
		mlog.Err(err),
	)

	err.DetailedError = ""
	errorResp := model.NewWebSocketError(r.Seq, err)

	conn.Send <- errorResp
}
