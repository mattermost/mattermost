// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func InitWebSocket() {
	l4g.Debug(utils.T("api.web_socket.init.debug"))

	BaseRoutes.ApiRoot.Handle("/websocket", ApiHandlerTrustRequester(connectWebSocket)).Methods("GET")
}

func connectWebSocket(c *Context, w http.ResponseWriter, r *http.Request) {
	originChecker := utils.GetOriginChecker(r)

	upgrader := websocket.Upgrader{
		ReadBufferSize:  model.SOCKET_MAX_MESSAGE_SIZE_KB,
		WriteBufferSize: model.SOCKET_MAX_MESSAGE_SIZE_KB,
		CheckOrigin:     originChecker,
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		l4g.Error(utils.T("api.web_socket.connect.error"), err)
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	wc := c.App.NewWebConn(ws, c.Session, c.T, "")

	if len(c.Session.UserId) > 0 {
		app.HubRegister(wc)
	}

	go wc.WritePump()
	wc.ReadPump()
}
