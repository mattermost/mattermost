// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"

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

	wc := c.App.NewWebConn(ws, *c.App.Session(), c.App.T, "")

	if *c.App.Config().ServiceSettings.EnableReliableWebSockets {
		connID := r.URL.Query().Get(connectionIDParam)
		if connID == "" {
			// If not present, we assume client is not capable yet, or it's a fresh connection.
			// We just create a new ID.
			connID = model.NewId()
		} else {
			if !model.IsValidId(connID) {
				mlog.Error("Invalid connection ID", mlog.String("id", connID))
				wc.WebSocket.Close()
				return
			}
			// If present, we check if it's present in the connection manager.
			// TODO: the connection manager internally should forward the request
			// to the cluster if it does not have it.
			//
			// If the connection is not present, then we assume either timeout,
			// or server restart. In that case, we set a new one.
			//
			// Now we get the sequence number
			seqVal := r.URL.Query().Get(sequenceNumberParam)
			if seqVal == "" {
				// Sequence_number must be sent with connection id.
				// A client must be either non-compliant or fully compliant.
				mlog.Error("Sequence number not present in websocket request")
				wc.WebSocket.Close()
				return
			}
			seq, err := strconv.Atoi(seqVal)
			if err != nil || seq < 0 {
				mlog.Error("Invalid sequence number set in query param",
					mlog.String("query", seqVal),
					mlog.Err(err))
				wc.WebSocket.Close()
				return
			}
			wc.Sequence = int64(seq)
			// Now if there have been past entries to be back-filled, we do it.
			// First we find the right sequence number point.
			// We start consuming from dead queue first, and then move to active queue
		}
		// In case of fresh connection id, sequence number is already zero.
		wc.SetConnectionID(connID)
	}

	if c.App.Session().UserId != "" {
		c.App.HubRegister(wc)
	}

	wc.Pump()
}
