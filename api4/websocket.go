// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitWebSocket() {
	api.BaseRoutes.ApiRoot.Handle("/websocket", api.ApiHandlerTrustRequester(connectWebSocket)).Methods("GET")
}

func connectWebSocket(c *Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  model.SOCKET_MAX_MESSAGE_SIZE_KB,
		WriteBufferSize: model.SOCKET_MAX_MESSAGE_SIZE_KB,
		CheckOrigin:     c.App.OriginChecker(),
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		mlog.Error("websocket connect err.", mlog.Err(err))
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	wc := c.App.NewWebConn(ws, c.App.Session, c.App.T, "")

	if len(c.App.Session.UserId) > 0 {
		c.App.HubRegister(wc)
	}

	wc.Pump()
}
