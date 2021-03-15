// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gobwas/ws"

	"github.com/mattermost/mattermost-server/v5/mlog"
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

	// Uprgade the HTTP version header to 1.1, if we detect a 1.0 header.
	// This is a hack to work around a flaw in our proxy configs which sends the protocol version as 1.0.
	// It will be removed in a future version.
	if r.ProtoMajor == 1 && r.ProtoMinor == 0 {
		r.ProtoMinor = 1
		mlog.Warn("The HTTP version field was detected as 1.0 during WebSocket handshake. This is most probably due to an incorrect proxy configuration. Please upgrade your proxy config to set the header version to a minimum of 1.1.")
	}

	conn, _, _, err := upgrader.Upgrade(r, w)
	if err != nil {
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "", http.StatusInternalServerError)
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
