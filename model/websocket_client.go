// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
)

const (
	SOCKET_MAX_MESSAGE_SIZE_KB = 8 * 1024 // 8KB
)

type WebSocketClient struct {
	Url             string          // The location of the server like "ws://localhost:8065"
	ApiUrl          string          // The api location of the server like "ws://localhost:8065/api/v3"
	ConnectUrl      string          // The websocket URL to connect to like "ws://localhost:8065/api/v3/path/to/websocket"
	Conn            *websocket.Conn // The WebSocket connection
	AuthToken       string          // The token used to open the WebSocket
	Sequence        int64           // The ever-incrementing sequence attached to each WebSocket action
	EventChannel    chan *WebSocketEvent
	ResponseChannel chan *WebSocketResponse
	ListenError     *AppError
}

// NewWebSocketClient constructs a new WebSocket client with convienence
// methods for talking to the server.
func NewWebSocketClient(url, authToken string) (*WebSocketClient, *AppError) {
	client := &WebSocketClient{
		Url:        url,
		ApiUrl:     url + API_URL_SUFFIX_V3,
		ConnectUrl: url + API_URL_SUFFIX_V3 + "/users/websocket",
		AuthToken:  authToken,
		Sequence:   1,
	}
	if err := client.Connect(); err != nil {
		return nil, err
	}

	return client, nil
}

// NewWebSocketClient4 constructs a new WebSocket client with convienence
// methods for talking to the server. Uses the v4 endpoint.
func NewWebSocketClient4(url, authToken string) (*WebSocketClient, *AppError) {
	client := &WebSocketClient{
		Url:        url,
		ApiUrl:     url + API_URL_SUFFIX,
		ConnectUrl: url + API_URL_SUFFIX + "/websocket",
		AuthToken:  authToken,
		Sequence:   1,
	}
	if err := client.Connect(); err != nil {
		return nil, err
	}

	return client, nil
}

func (wsc *WebSocketClient) Connect() *AppError {
	var err error
	wsc.Conn, _, err = websocket.DefaultDialer.Dial(wsc.ConnectUrl, nil)
	if err != nil {
		return NewAppError("Connect", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	wsc.EventChannel = make(chan *WebSocketEvent, 100)
	wsc.ResponseChannel = make(chan *WebSocketResponse, 100)

	wsc.SendMessage(WEBSOCKET_AUTHENTICATION_CHALLENGE, map[string]interface{}{"token": wsc.AuthToken})
	if resp, err := wsc.read(); err != nil {
		return err
	} else if resp, ok := resp.(*WebSocketResponse); ok && resp.Status != STATUS_OK {
		return resp.Error
	}

	return nil
}

func (wsc *WebSocketClient) read() (interface{}, *AppError) {
	var rawMsg json.RawMessage
	var err error
	if _, rawMsg, err = wsc.Conn.ReadMessage(); err != nil {
		if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
			return nil, NewAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return nil, nil
	}

	var event WebSocketEvent
	if err := json.Unmarshal(rawMsg, &event); err == nil && event.IsValid() {
		return &event, nil
	}

	var response WebSocketResponse
	if err := json.Unmarshal(rawMsg, &response); err == nil && response.IsValid() {
		return &response, nil
	}

	return nil, nil
}

func (wsc *WebSocketClient) Close() {
	wsc.Conn.Close()
}

func (wsc *WebSocketClient) Listen() {
	go func() {
		defer func() {
			wsc.Conn.Close()
			close(wsc.EventChannel)
			close(wsc.ResponseChannel)
		}()

		for {
			incoming, err := wsc.read()
			if incoming == nil {
				if err != nil {
					wsc.ListenError = NewAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
				return
			} else if event, ok := incoming.(*WebSocketEvent); ok {
				wsc.EventChannel <- event
			} else if response, ok := incoming.(*WebSocketResponse); ok {
				wsc.ResponseChannel <- response
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

// GetStatusesByIds will fetch certain user statuses based on ids and return
// a map of string statuses using user id as the key
func (wsc *WebSocketClient) GetStatusesByIds(userIds []string) {
	data := map[string]interface{}{
		"user_ids": userIds,
	}
	wsc.SendMessage("get_statuses_by_ids", data)
}
