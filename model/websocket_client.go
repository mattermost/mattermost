// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	SOCKET_MAX_MESSAGE_SIZE_KB  = 8 * 1024 // 8KB
	PING_TIMEOUT_BUFFER_SECONDS = 5
)

type WebSocketClient struct {
	Url                string          // The location of the server like "ws://localhost:8065"
	ApiUrl             string          // The api location of the server like "ws://localhost:8065/api/v3"
	ConnectUrl         string          // The websocket URL to connect to like "ws://localhost:8065/api/v3/path/to/websocket"
	Conn               *websocket.Conn // The WebSocket connection
	AuthToken          string          // The token used to open the WebSocket
	Sequence           int64           // The ever-incrementing sequence attached to each WebSocket action
	PingTimeoutChannel chan bool       // The channel used to signal ping timeouts
	EventChannel       chan *WebSocketEvent
	ResponseChannel    chan *WebSocketResponse
	ListenError        *AppError
	pingTimeoutTimer   *time.Timer
}

// NewWebSocketClient constructs a new WebSocket client with convenience
// methods for talking to the server.
func NewWebSocketClient(url, authToken string) (*WebSocketClient, *AppError) {
	return NewWebSocketClientWithDialer(websocket.DefaultDialer, url, authToken)
}

// NewWebSocketClientWithDialer constructs a new WebSocket client with convenience
// methods for talking to the server using a custom dialer.
func NewWebSocketClientWithDialer(dialer *websocket.Dialer, url, authToken string) (*WebSocketClient, *AppError) {
	conn, _, err := dialer.Dial(url+API_URL_SUFFIX+"/websocket", nil)
	if err != nil {
		return nil, NewAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	client := &WebSocketClient{
		url,
		url + API_URL_SUFFIX,
		url + API_URL_SUFFIX + "/websocket",
		conn,
		authToken,
		1,
		make(chan bool, 1),
		make(chan *WebSocketEvent, 100),
		make(chan *WebSocketResponse, 100),
		nil,
		nil,
	}

	client.configurePingHandling()

	client.SendMessage(WEBSOCKET_AUTHENTICATION_CHALLENGE, map[string]interface{}{"token": authToken})

	return client, nil
}

// NewWebSocketClient4 constructs a new WebSocket client with convenience
// methods for talking to the server. Uses the v4 endpoint.
func NewWebSocketClient4(url, authToken string) (*WebSocketClient, *AppError) {
	return NewWebSocketClient4WithDialer(websocket.DefaultDialer, url, authToken)
}

// NewWebSocketClient4WithDialer constructs a new WebSocket client with convenience
// methods for talking to the server using a custom dialer. Uses the v4 endpoint.
func NewWebSocketClient4WithDialer(dialer *websocket.Dialer, url, authToken string) (*WebSocketClient, *AppError) {
	return NewWebSocketClientWithDialer(dialer, url, authToken)
}

func (wsc *WebSocketClient) Connect() *AppError {
	return wsc.ConnectWithDialer(websocket.DefaultDialer)
}

func (wsc *WebSocketClient) ConnectWithDialer(dialer *websocket.Dialer) *AppError {
	var err error
	wsc.Conn, _, err = dialer.Dial(wsc.ConnectUrl, nil)
	if err != nil {
		return NewAppError("Connect", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	wsc.configurePingHandling()

	wsc.EventChannel = make(chan *WebSocketEvent, 100)
	wsc.ResponseChannel = make(chan *WebSocketResponse, 100)

	wsc.SendMessage(WEBSOCKET_AUTHENTICATION_CHALLENGE, map[string]interface{}{"token": wsc.AuthToken})

	return nil
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
			var rawMsg json.RawMessage
			var err error
			if _, rawMsg, err = wsc.Conn.ReadMessage(); err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseNoStatusReceived) {
					wsc.ListenError = NewAppError("NewWebSocketClient", "model.websocket_client.connect_fail.app_error", nil, err.Error(), http.StatusInternalServerError)
				}

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

// GetStatusesByIds will fetch certain user statuses based on ids and return
// a map of string statuses using user id as the key
func (wsc *WebSocketClient) GetStatusesByIds(userIds []string) {
	data := map[string]interface{}{
		"user_ids": userIds,
	}
	wsc.SendMessage("get_statuses_by_ids", data)
}

func (wsc *WebSocketClient) configurePingHandling() {
	wsc.Conn.SetPingHandler(wsc.pingHandler)
	wsc.pingTimeoutTimer = time.NewTimer(time.Second * (60 + PING_TIMEOUT_BUFFER_SECONDS))
	go wsc.pingWatchdog()
}

func (wsc *WebSocketClient) pingHandler(appData string) error {
	if !wsc.pingTimeoutTimer.Stop() {
		<-wsc.pingTimeoutTimer.C
	}

	wsc.pingTimeoutTimer.Reset(time.Second * (60 + PING_TIMEOUT_BUFFER_SECONDS))
	wsc.Conn.WriteMessage(websocket.PongMessage, []byte{})
	return nil
}

func (wsc *WebSocketClient) pingWatchdog() {
	<-wsc.pingTimeoutTimer.C
	wsc.PingTimeoutChannel <- true
}
