// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestWebSocket(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}
	defer WebSocketClient.Close()

	time.Sleep(300 * time.Millisecond)

	// Test closing and reconnecting
	WebSocketClient.Close()
	if err := WebSocketClient.Connect(); err != nil {
		t.Fatal(err)
	}

	WebSocketClient.Listen()

	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Status != model.STATUS_OK {
		t.Fatal("should have responded OK to authentication challenge")
	}

	WebSocketClient.SendMessage("ping", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Data["text"].(string) != "pong" {
		t.Fatal("wrong response")
	}

	WebSocketClient.SendMessage("", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.no_action.app_error" {
		t.Fatal("should have been no action response")
	}

	WebSocketClient.SendMessage("junk", nil)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.bad_action.app_error" {
		t.Fatal("should have been bad action response")
	}

	req := &model.WebSocketRequest{}
	req.Seq = 0
	req.Action = "ping"
	WebSocketClient.Conn.WriteJSON(req)
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.web_socket_router.bad_seq.app_error" {
		t.Fatal("should have been bad action response")
	}

	WebSocketClient.UserTyping("", "")
	time.Sleep(300 * time.Millisecond)
	if resp := <-WebSocketClient.ResponseChannel; resp.Error.Id != "api.websocket_handler.invalid_param.app_error" {
		t.Fatal("should have been invalid param response")
	} else {
		if resp.Error.DetailedError != "" {
			t.Fatal("detailed error not cleared")
		}
	}
}
