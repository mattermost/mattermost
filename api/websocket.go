// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/websocket"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
)

const (
	SOCKET_MAX_MESSAGE_SIZE_KB = 8 * 1024 // 8KB
)

func InitWebSocket() {
	l4g.Debug(utils.T("api.web_socket.init.debug"))
	BaseRoutes.Users.Handle("/websocket", ApiAppHandlerTrustRequester(connect)).Methods("GET")
	HubStart()
}

func connect(c *Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  SOCKET_MAX_MESSAGE_SIZE_KB,
		WriteBufferSize: SOCKET_MAX_MESSAGE_SIZE_KB,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		l4g.Error(utils.T("api.web_socket.connect.error"), err)
		c.Err = model.NewLocAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "")
		return
	}

	wc := NewWebConn(c, ws)
	HubRegister(wc)
	go wc.writePump()
	wc.readPump()
}
