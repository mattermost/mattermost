// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package wsapi

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
)

func (api *API) APIWebSocketHandler(wh func(*model.WebSocketRequest) (map[string]any, *model.AppError)) webSocketHandler {
	return webSocketHandler{api.App, wh}
}

type webSocketHandler struct {
	app         *app.App
	handlerFunc func(*model.WebSocketRequest) (map[string]any, *model.AppError)
}

func (wh webSocketHandler) ServeWebSocket(conn *platform.WebConn, r *model.WebSocketRequest) {
	mlog.Debug("Websocket request", mlog.String("action", r.Action))

	hub := wh.app.Srv().Platform().GetHubForUserId(conn.UserId)
	if hub == nil {
		return
	}
	session, sessionErr := wh.app.GetSession(conn.GetSessionToken())

	if sessionErr != nil {
		mlog.Error(
			"websocket session error",
			mlog.String("action", r.Action),
			mlog.Int("seq", r.Seq),
			mlog.String("user_id", conn.UserId),
			mlog.String("error_message", sessionErr.SystemMessage(i18n.T)),
			mlog.Err(sessionErr),
		)
		sessionErr.WipeDetailed()
		errResp := model.NewWebSocketError(r.Seq, sessionErr)
		hub.SendMessage(conn, errResp)
		return
	}

	r.Session = *session
	r.T = conn.T
	r.Locale = conn.Locale

	var data map[string]any
	var err *model.AppError

	if data, err = wh.handlerFunc(r); err != nil {
		mlog.Error(
			"websocket request handling error",
			mlog.String("action", r.Action),
			mlog.Int("seq", r.Seq),
			mlog.String("user_id", conn.UserId),
			mlog.String("error_message", err.SystemMessage(i18n.T)),
			mlog.Err(err),
		)
		err.WipeDetailed()
		errResp := model.NewWebSocketError(r.Seq, err)
		hub.SendMessage(conn, errResp)
		return
	}

	resp := model.NewWebSocketResponse(model.StatusOk, r.Seq, data)
	hub.SendMessage(conn, resp)
}

func NewInvalidWebSocketParamError(action string, name string) *model.AppError {
	return model.NewAppError("websocket: "+action, "api.websocket_handler.invalid_param.app_error", map[string]any{"Name": name}, "", http.StatusBadRequest)
}

func NewServerBusyWebSocketError(action string) *model.AppError {
	return model.NewAppError("websocket: "+action, "api.websocket_handler.server_busy.app_error", nil, "", http.StatusServiceUnavailable)
}
