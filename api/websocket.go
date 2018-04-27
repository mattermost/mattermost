// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitWebSocket() {
	api.BaseRoutes.Users.Handle("/websocket", api.ApiAppHandlerTrustRequester(connect)).Methods("GET")
}

func connect(c *Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  model.SOCKET_MAX_MESSAGE_SIZE_KB,
		WriteBufferSize: model.SOCKET_MAX_MESSAGE_SIZE_KB,
		CheckOrigin:     c.App.OriginChecker(),
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		mlog.Error(fmt.Sprintf("websocket connect err: %v", err))
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	wc := c.App.NewWebConn(ws, c.Session, c.T, c.Locale)

	if len(c.Session.UserId) > 0 {
		c.App.HubRegister(wc)
	}

	wc.Pump()
}
