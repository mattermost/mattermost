// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

const (
	connectionIDParam   = "connection_id"
	sequenceNumberParam = "sequence_number"
)

func (api *API) InitWebSocket() {
	// Optionally supports a trailing slash
	api.BaseRoutes.APIRoot.Handle("/{websocket:websocket(?:\\/)?}", api.APIHandlerTrustRequester(connectWebSocket)).Methods("GET")
}

func connectWebSocket(c *Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  model.SocketMaxMessageSizeKb,
		WriteBufferSize: model.SocketMaxMessageSizeKb,
		CheckOrigin:     c.App.OriginChecker(),
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		c.Err = model.NewAppError("connect", "api.web_socket.connect.upgrade.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	// We initialize webconn with all the necessary data.
	// If the queues are empty, they are initialized in the constructor.
	cfg := &platform.WebConnConfig{
		WebSocket: ws,
		Session:   *c.AppContext.Session(),
		TFunc:     c.AppContext.T,
		Locale:    "",
		Active:    true,
	}

	cfg.ConnectionID = r.URL.Query().Get(connectionIDParam)
	if cfg.ConnectionID == "" || c.AppContext.Session().UserId == "" {
		// If not present, we assume client is not capable yet, or it's a fresh connection.
		// We just create a new ID.
		cfg.ConnectionID = model.NewId()
		// In case of fresh connection id, sequence number is already zero.
	} else {
		cfg, err = c.App.Srv().Platform().PopulateWebConnConfig(c.AppContext.Session(), cfg, r.URL.Query().Get(sequenceNumberParam))
		if err != nil {
			mlog.Warn("Error while populating webconn config", mlog.String("id", r.URL.Query().Get(connectionIDParam)), mlog.Err(err))
			ws.Close()
			return
		}
	}

	wc := c.App.Srv().Platform().NewWebConn(cfg, c.App, c.App.Srv().Channels())
	if c.AppContext.Session().UserId != "" {
		c.App.Srv().Platform().HubRegister(wc)
	}

	wc.Pump()
}
