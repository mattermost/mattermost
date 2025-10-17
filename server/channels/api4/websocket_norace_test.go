// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !race
// +build !race

package api4

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestWebSocket is intentionally made to skip -race mode
// because the websocket client is known to be racy and needs a big overhaul
// to fix everything.
func TestWebSocket(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()
	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	defer WebSocketClient.Close()

	time.Sleep(300 * time.Millisecond)

	// Test closing and reconnecting
	WebSocketClient.Close()
	appErr := WebSocketClient.Connect()
	require.Nil(t, appErr)

	WebSocketClient.Listen()

	resp := <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Status, model.StatusOk, "should have responded OK to authentication challenge")

	WebSocketClient.SendMessage("ping", nil)
	resp = <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Data["text"].(string), "pong", "wrong response")

	WebSocketClient.SendMessage("", nil)
	resp = <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Error.Id, "api.web_socket_router.no_action.app_error", "should have been no action response")

	WebSocketClient.SendMessage("junk", nil)
	resp = <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Error.Id, "api.web_socket_router.bad_action.app_error", "should have been bad action response")

	WebSocketClient.UserTyping("", "")
	resp = <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Error.Id, "api.websocket_handler.invalid_param.app_error", "should have been invalid param response")
	require.Equal(t, resp.Error.DetailedError, "", "detailed error not cleared")

	WebSocketClient.UserTyping(th.BasicChannel.Id, "")
	resp = <-WebSocketClient.ResponseChannel
	require.Nil(t, resp.Error)

	WebSocketClient.UserTyping(th.BasicPrivateChannel2.Id, "")
	resp = <-WebSocketClient.ResponseChannel
	require.Equal(t, resp.Error.Id, "api.websocket_handler.invalid_param.app_error", "should have been invalid param response")
	require.Equal(t, resp.Error.DetailedError, "", "detailed error not cleared")
}
