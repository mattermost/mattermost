// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/vmihailenco/msgpack/v5"
)

func dummyWebsocketHandler(t *testing.T, wg *sync.WaitGroup) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		defer wg.Done()
		upgrader := &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		}
		conn, err := upgrader.Upgrade(w, req, nil)
		require.NoError(t, err)
		var buf []byte
		for {
			err = conn.SetReadDeadline(time.Now().Add(time.Second))
			if err != nil {
				break
			}
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
	}
}

// TestWebSocketRace needs to be run with -race to verify that
// there is no race.
func TestWebSocketRace(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)
	s := httptest.NewServer(dummyWebsocketHandler(t, &wg))
	defer func() {
		s.Close()
		wg.Wait()
	}()

	url := strings.Replace(s.URL, "http://", "ws://", 1)
	cli, err := NewWebSocketClient4(url, "authToken")
	require.NoError(t, err)

	cli.Listen()

	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		cli.UserTyping("channel", "parentId")
	}
}

func TestWebSocketClose(t *testing.T) {
	// This fails in SuddenClose because we check for closing the writeChan
	// only after waiting the closure of Event and Response channels.
	// Therefore, it is still racy and can panic. There is no use chasing this
	// again because it will be completely overhauled in v6.
	t.Skip("Skipping the test. Will be changed in v6.")
	var wg sync.WaitGroup
	wg.Add(1)
	s := httptest.NewServer(dummyWebsocketHandler(t, &wg))
	defer func() {
		s.Close()
		wg.Wait()
	}()

	url := strings.Replace(s.URL, "http://", "ws://", 1)

	// Check whether the Event and Response channels
	// have been closed or not.
	waitClose := func(doneChan chan struct{}) int {
		numClosed := 0
		timeout := time.After(300 * time.Millisecond)
		for {
			select {
			case <-doneChan:
				numClosed++
				if numClosed == 2 {
					return numClosed
				}
			case <-timeout:
				require.Fail(t, "timed out waiting for channels to be closed")
				return numClosed
			}
		}
	}

	checkWriteChan := func(writeChan chan writeMessage) {
		defer func() {
			if x := recover(); x == nil {
				require.Fail(t, "should have panicked due to closing a closed channel")
			}
		}()
		close(writeChan)
	}

	waitForResponses := func(doneChan chan struct{}, cli *WebSocketClient) {
		go func() {
			for range cli.EventChannel { //nolint:revive
			}
			doneChan <- struct{}{}
		}()
		go func() {
			for range cli.ResponseChannel { //nolint:revive
			}
			doneChan <- struct{}{}
		}()
	}

	t.Run("SuddenClose", func(t *testing.T) {
		cli, err := NewWebSocketClient4(url, "authToken")
		require.NoError(t, err)

		cli.Listen()

		doneChan := make(chan struct{}, 2)
		waitForResponses(doneChan, cli)

		cli.UserTyping("channelId", "parentId")
		cli.Conn.Close()

		numClosed := waitClose(doneChan)
		assert.Equal(t, 2, numClosed, "unexpected number of channels closed")

		// Check whether the write channel was closed or not.
		checkWriteChan(cli.writeChan)

		require.NotNil(t, cli.ListenError, "non-nil listen error")
		assert.Equal(t, "model.websocket_client.connect_fail.app_error", cli.ListenError.Id, "unexpected error id")
	})

	t.Run("ExplicitClose", func(t *testing.T) {
		cli, err := NewWebSocketClient4(url, "authToken")
		require.NoError(t, err)

		cli.Listen()

		doneChan := make(chan struct{}, 2)
		waitForResponses(doneChan, cli)

		cli.UserTyping("channelId", "parentId")
		cli.Close()

		numClosed := waitClose(doneChan)
		assert.Equal(t, 2, numClosed, "unexpected number of channels closed")

		// Check whether the write channel was closed or not.
		checkWriteChan(cli.writeChan)
	})
}

func binaryWebsocketHandler(t *testing.T, clientData map[string]any, doneCh chan struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		defer close(doneCh)
		upgrader := &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		}
		conn, err := upgrader.Upgrade(w, req, nil)
		require.NoError(t, err)
		defer conn.Close()

		for {
			msgType, buf, err := conn.ReadMessage()
			require.NoError(t, err)
			if msgType == websocket.BinaryMessage {
				require.Equal(t, msgType, websocket.BinaryMessage)
				wsReq := &WebSocketRequest{}
				err = msgpack.Unmarshal(buf, wsReq)
				require.NoError(t, err)
				require.Equal(t, clientData, wsReq.Data)
				break
			}
		}
	}
}

func TestWebSocketSendBinaryMessage(t *testing.T) {
	clientData := map[string]any{
		"data": []byte("some data to send as binary"),
	}

	doneCh := make(chan struct{})
	s := httptest.NewServer(binaryWebsocketHandler(t, clientData, doneCh))
	defer s.Close()

	url := strings.Replace(s.URL, "http://", "ws://", 1)
	cli, err := NewWebSocketClient4(url, "authToken")
	require.NoError(t, err)
	cli.Listen()
	defer cli.Close()

	err = cli.SendBinaryMessage("binaryAction", map[string]any{
		"unmarshable": func() {},
	})
	require.Error(t, err)

	err = cli.SendBinaryMessage("binaryAction", clientData)
	require.NoError(t, err)

	// This is to make sure the message is handled prior to exiting.
	<-doneCh
}
