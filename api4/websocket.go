// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"strconv"

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

	var connID string
	var seq int
	var activeQueue chan model.WebSocketMessage
	var deadQueue []*model.WebSocketEvent
	var deadQueuePointer int
	var active bool = true
	if *c.App.Config().ServiceSettings.EnableReliableWebSockets {
		connID = r.URL.Query().Get(connectionIDParam)
		if connID == "" || c.App.Session().UserId == "" {
			// If not present, we assume client is not capable yet, or it's a fresh connection.
			// We just create a new ID.
			connID = model.NewId()
			// In case of fresh connection id, sequence number is already zero.
		} else {
			if !model.IsValidId(connID) {
				mlog.Warn("Invalid connection ID", mlog.String("id", connID))
				ws.Close()
				return
			}

			// TODO: the method should internally forward the request
			// to the cluster if it does not have it.
			res := c.App.CheckWebConn(c.App.Session().UserId, connID)
			if res == nil {
				// If the connection is not present, then we assume either timeout,
				// or server restart. In that case, we set a new one.
				connID = model.NewId()
			} else {
				// Connection is present, we get the active queue, dead queue
				activeQueue = res.ActiveQueue
				deadQueue = res.DeadQueue
				deadQueuePointer = res.DeadQueuePointer
				active = false
				// Now we get the sequence number
				seqVal := r.URL.Query().Get(sequenceNumberParam)
				if seqVal == "" {
					// Sequence_number must be sent with connection id.
					// A client must be either non-compliant or fully compliant.
					mlog.Warn("Sequence number not present in websocket request")
					ws.Close()
					return
				}
				seq, err = strconv.Atoi(seqVal)
				if err != nil || seq < 0 {
					mlog.Warn("Invalid sequence number set in query param",
						mlog.String("query", seqVal),
						mlog.Err(err))
					ws.Close()
					return
				}
			}
		}
	}

	// We initialize webconn with all the necessary data.
	// If the queues are empty, they are initialized in the constructor.
	in := app.WebConnConfig{
		WebSocket:        ws,
		Session:          *c.App.Session(),
		TFunc:            c.App.T,
		Locale:           "",
		Sequence:         seq,
		ConnectionID:     connID,
		ActiveQueue:      activeQueue,
		DeadQueue:        deadQueue,
		DeadQueuePointer: deadQueuePointer,
		Active:           active,
	}
	wc := c.App.NewWebConn(in)
	if c.App.Session().UserId != "" {
		c.App.HubRegister(wc)
	}

	wc.Pump()
}
