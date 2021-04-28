// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

const (
	connectionIDParam   = "connection_id"
	sequenceNumberParam = "sequence_number"
)

func (api *API) InitWebSocket() {
	// Optionally supports a trailing slash
	api.BaseRoutes.ApiRoot.Handle("/{websocket:websocket(?:\\/)?}", api.ApiHandlerTrustRequester(connectWebSocket)).Methods("GET")
}

func connectWebSocket(c *Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  model.SOCKET_MAX_MESSAGE_SIZE_KB,
		WriteBufferSize: model.SOCKET_MAX_MESSAGE_SIZE_KB,
		CheckOrigin:     c.App.OriginChecker(),
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	// We initialize webconn with all the necessary data.
	// If the queues are empty, they are initialized in the constructor.
	cfg := &app.WebConnConfig{
		WebSocket: ws,
		Session:   *c.App.Session(),
		TFunc:     c.App.T,
		Locale:    "",
		Active:    true,
	}

	if *c.App.Config().ServiceSettings.EnableReliableWebSockets {
		cfg.ConnectionID = r.URL.Query().Get(connectionIDParam)
		if cfg.ConnectionID == "" || c.App.Session().UserId == "" {
			// If not present, we assume client is not capable yet, or it's a fresh connection.
			// We just create a new ID.
			cfg.ConnectionID = model.NewId()
			// In case of fresh connection id, sequence number is already zero.
		} else {
			cfg, err = c.App.PopulateWebConnConfig(cfg, r.URL.Query().Get(sequenceNumberParam))
			if err != nil {
				mlog.Warn("Error while populating webconn config", mlog.String("id", r.URL.Query().Get(connectionIDParam)), mlog.Err(err))
				ws.Close()
				return
			}
		}
	}

	wc := c.App.NewWebConn(cfg)
	if c.App.Session().UserId != "" {
		c.App.HubRegister(wc)
	}

	wc.Pump()
}
