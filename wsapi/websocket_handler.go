// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package wsapi

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) ApiWebSocketHandler(wh func(*model.WebSocketRequest) (map[string]interface{}, *model.AppError)) webSocketHandler {
	return webSocketHandler{api.App, wh}
}

type webSocketHandler struct {
	app         *app.App
	handlerFunc func(*model.WebSocketRequest) (map[string]interface{}, *model.AppError)
}

func (wh webSocketHandler) ServeWebSocket(conn *app.WebConn, r *model.WebSocketRequest) {
	mlog.Debug(fmt.Sprintf("websocket: %s", r.Action))

	session, sessionErr := wh.app.GetSession(conn.GetSessionToken())
	if sessionErr != nil {
		mlog.Error(fmt.Sprintf("%v:%v seq=%v uid=%v %v [details: %v]", "websocket", r.Action, r.Seq, conn.UserId, sessionErr.SystemMessage(utils.T), sessionErr.Error()))
		sessionErr.DetailedError = ""
		errResp := model.NewWebSocketError(r.Seq, sessionErr)

		conn.Send <- errResp
		return
	}

	r.Session = *session
	r.T = conn.T
	r.Locale = conn.Locale

	var data map[string]interface{}
	var err *model.AppError

	if data, err = wh.handlerFunc(r); err != nil {
		mlog.Error(fmt.Sprintf("%v:%v seq=%v uid=%v %v [details: %v]", "websocket", r.Action, r.Seq, r.Session.UserId, err.SystemMessage(utils.T), err.DetailedError))
		err.DetailedError = ""
		errResp := model.NewWebSocketError(r.Seq, err)

		conn.Send <- errResp
		return
	}

	resp := model.NewWebSocketResponse(model.STATUS_OK, r.Seq, data)

	conn.Send <- resp
}

func NewInvalidWebSocketParamError(action string, name string) *model.AppError {
	return model.NewAppError("websocket: "+action, "api.websocket_handler.invalid_param.app_error", map[string]interface{}{"Name": name}, "", http.StatusBadRequest)
}
