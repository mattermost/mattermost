// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type webSocketHandler interface {
	ServeWebSocket(*WebConn, *model.WebSocketRequest)
}

type WebSocketRouter struct {
	handlers map[string]webSocketHandler
}

func (wr *WebSocketRouter) Handle(action string, handler webSocketHandler) {
	wr.handlers[action] = handler
}

func (wr *WebSocketRouter) ServeWebSocket(c request.CTX, conn *WebConn, r *model.WebSocketRequest) {
	if r.Action == "" {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.no_action.app_error", nil, "", http.StatusBadRequest)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	if r.Seq <= 0 {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_seq.app_error", nil, "", http.StatusBadRequest)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	if r.Action == model.WebsocketAuthenticationChallenge {
		if conn.GetSessionToken() != "" {
			return
		}

		token, ok := r.Data["token"].(string)
		if !ok {
			conn.WebSocket.Close()
			return
		}

		session, err := conn.Suite.GetSession(c, token)
		if err != nil {
			conn.WebSocket.Close()
			return
		}
		conn.SetSession(session)
		conn.SetSessionToken(session.Token)
		conn.UserId = session.UserId

		conn.Platform.HubRegister(conn)

		conn.Platform.Go(func() {
			conn.Suite.SetStatusOnline(c, session.UserId, false)
			conn.Suite.UpdateLastActivityAtIfNeeded(c, *session)
		})

		resp := model.NewWebSocketResponse(model.StatusOk, r.Seq, nil)
		hub := conn.Platform.GetHubForUserId(conn.UserId)
		if hub == nil {
			return
		}
		hub.SendMessage(conn, resp)

		return
	}

	if !conn.IsAuthenticated(c) {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.not_authenticated.app_error", nil, "", http.StatusUnauthorized)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	handler, ok := wr.handlers[r.Action]
	if !ok {
		err := model.NewAppError("ServeWebSocket", "api.web_socket_router.bad_action.app_error", nil, "", http.StatusInternalServerError)
		returnWebSocketError(conn.Platform, conn, r, err)
		return
	}

	handler.ServeWebSocket(conn, r)
}

func returnWebSocketError(ps *PlatformService, conn *WebConn, r *model.WebSocketRequest, err *model.AppError) {
	logF := mlog.Error
	if err.StatusCode >= http.StatusBadRequest && err.StatusCode < http.StatusInternalServerError {
		logF = mlog.Debug
	}
	logF(
		"websocket routing error.",
		mlog.Int64("seq", r.Seq),
		mlog.String("user_id", conn.UserId),
		mlog.String("system_message", err.SystemMessage(i18n.T)),
		mlog.Err(err),
	)

	hub := ps.GetHubForUserId(conn.UserId)
	if hub == nil {
		return
	}

	err.DetailedError = ""
	errorResp := model.NewWebSocketError(r.Seq, err)
	hub.SendMessage(conn, errorResp)
}
