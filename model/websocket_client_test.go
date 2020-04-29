// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"
)

func dummyWebsocketHandler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		upgrader := &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		}
		conn, err := upgrader.Upgrade(w, req, nil)
		var buf []byte
		for {
			_, buf, err = conn.ReadMessage()
			if err != nil {
				break
			}
			t.Logf("%s\n", buf)
			err = conn.WriteMessage(websocket.PingMessage, []byte("ping"))
			if err != nil {
				break
			}
		}
		if _, ok := err.(*websocket.CloseError); !ok {
			require.NoError(t, err)
		}
	}
}

// TestWebSocketRace needs to be run with -race to verify that
// there is no race.
func TestWebSocketRace(t *testing.T) {
	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	url := strings.Replace(s.URL, "http://", "ws://", 1)
	cli, err := NewWebSocketClient4(url, "authToken")
	require.Nil(t, err)

	cli.Listen()

	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		cli.UserTyping("channel", "parentId")
	}
}
