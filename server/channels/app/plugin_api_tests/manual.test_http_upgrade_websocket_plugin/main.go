// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer ws.Close()

	for {
		mt, msg, err := ws.ReadMessage()
		if err != nil {
			break
		}
		var req model.WebSocketRequest
		err = json.Unmarshal(msg, &req)
		if err != nil {
			break
		}
		resp := model.NewWebSocketResponse("OK", req.Seq, map[string]any{"action": req.Action, "value": req.Data["value"]})
		respJSON, err := resp.ToJSON()
		if err != nil {
			break
		}
		if err = ws.WriteMessage(mt, respJSON); err != nil {
			break
		}
	}
}

func main() {
	plugin.ClientMain(&Plugin{})
}
