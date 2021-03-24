// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gobwas/ws"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitWebSocket() {
	// Optionally supports a trailing slash
	api.BaseRoutes.ApiRoot.Handle("/{websocket:websocket(?:\\/)?}", api.ApiHandlerTrustRequester(connectWebSocket)).Methods("GET")
}

func connectWebSocket(c *Context, w http.ResponseWriter, r *http.Request) {
	fn := c.App.OriginChecker()
	if fn != nil && !fn(r) {
		c.Err = model.NewAppError("origin_check", "api.web_socket.connect.check_origin.app_error", nil, "", http.StatusBadRequest)
		return
	}

	upgrader := ws.HTTPUpgrader{
		Timeout: 5 * time.Second,
	}

	conn, _, _, err := upgrader.Upgrade(r, w)
	if err != nil {
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	wc := c.App.NewWebConn(conn, *c.App.Session(), c.App.T, "")
	if c.App.Session().UserId != "" {
		c.App.HubRegister(wc)
	}

	if runtime.GOOS == "windows" {
		wc.BlockingPump()
	} else {
		go wc.Pump()
	}
}
