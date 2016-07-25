// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"net/http"
)

type WebSocketClient struct {
	Url             string          // The location of the server like "ws://localhost:8065"
	ApiUrl          string          // The api location of the server like "ws://localhost:8065/api/v3"
	Conn            *websocket.Conn // The WebSocket connection
	AuthToken       string          // The token used to open the WebSocket
	Sequence        int64           // The ever-incrementing sequence attached to each WebSocket action
	EventChannel    chan *WebSocketEvent
	ResponseChannel chan *WebSocketResponse
}

// NewWebSocketClient constructs a new WebSocket client with convienence
// methods for talking to the server.
func NewWebSocketClient(url, authToken string) (*WebSocketClient, *AppError) {
	header := http.Header{}
	header.Set(HEADER_AUTH, "BEARER "+authToken)
	conn, _, err := websocket.DefaultDialer.Dial(url+API_URL_SUFFIX+"/users/websocket", header)
	if err != nil {
		return nil, NewLocAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error())
	}

	return &WebSocketClient{
		url,
		url + API_URL_SUFFIX,
		conn,
		authToken,
		1,
		make(chan *WebSocketEvent, 100),
		make(chan *WebSocketResponse, 100),
	}, nil
}

func (wsc *WebSocketClient) Connect() *AppError {
	header := http.Header{}
	header.Set(HEADER_AUTH, "BEARER "+wsc.AuthToken)

	var err error
	wsc.Conn, _, err = websocket.DefaultDialer.Dial(wsc.ApiUrl+"/users/websocket", header)
	if err != nil {
		return NewLocAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error())
	}

	return nil
}

func (wsc *WebSocketClient) Close() {
	wsc.Conn.Close()
}

func (wsc *WebSocketClient) Listen() {
	go func() {
		for {
			var rawMsg json.RawMessage
			var err error
			if _, rawMsg, err = wsc.Conn.ReadMessage(); err != nil {
				return
			}

			var event WebSocketEvent
			if err := json.Unmarshal(rawMsg, &event); err == nil && event.IsValid() {
				wsc.EventChannel <- &event
				continue
			}

			var response WebSocketResponse
			if err := json.Unmarshal(rawMsg, &response); err == nil && response.IsValid() {
				wsc.ResponseChannel <- &response
				continue
			}
		}
	}()
}

func (wsc *WebSocketClient) SendMessage(action string, data map[string]interface{}) {
	req := &WebSocketRequest{}
	req.Seq = wsc.Sequence
	req.Action = action
	req.Data = data

	wsc.Sequence++

	wsc.Conn.WriteJSON(req)
}

// UserTyping will push a user_typing event out to all connected users
// who are in the specified channel
func (wsc *WebSocketClient) UserTyping(channelId, parentId string) {
	data := map[string]interface{}{
		"channel_id": channelId,
		"parent_id":  parentId,
	}

	wsc.SendMessage("user_typing", data)
}

// GetStatuses will return a map of string statuses using user id as the key
func (wsc *WebSocketClient) GetStatuses() {
	wsc.SendMessage("get_statuses", nil)
}
