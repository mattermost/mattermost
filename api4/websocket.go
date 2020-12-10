// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"time"

	"github.com/gobwas/ws"
	"github.com/mailru/easygo/netpoll"

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

	conn, _, _, err := upgrader.Upgrade(r, w)
	if err != nil {
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	wc := c.App.NewWebConn(conn, *c.App.Session(), c.App.T, "")
	if c.App.Session().UserId != "" {
		c.App.HubRegister(wc)
	}

	go wc.Pump()

	desc := netpoll.Must(netpoll.HandleRead(conn))
	c.App.Srv().Poller().Start(desc, func(wsEv netpoll.Event) {
		if wsEv&(netpoll.EventReadHup|netpoll.EventHup) != 0 {
			c.App.Srv().Poller().Stop(desc)
			wc.Close()
			return
		}

		// read from conn
		// TODO(agniva): Implement semaphore to force backpressure
		// on goroutine creation.
		go func() {
			err := wc.ReadMsg()
			if err != nil {
				mlog.Debug("Error while reading message from websocket", mlog.Err(err))
				c.App.Srv().Poller().Stop(desc)
				wc.Close()
			}
		}()
	})
}
