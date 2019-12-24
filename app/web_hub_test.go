// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func dummyWebsocketHandler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		upgrader := &websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		}
		conn, err := upgrader.Upgrade(w, req, nil)
		for err == nil {
			_, _, err = conn.ReadMessage()
		}
		if _, ok := err.(*websocket.CloseError); !ok {
			require.NoError(t, err)
		}
	}
}

func registerDummyWebConn(t *testing.T, a *App, addr net.Addr, userId string) *WebConn {
	session, appErr := a.CreateSession(&model.Session{
		UserId: userId,
	})
	require.Nil(t, appErr)

	d := websocket.Dialer{}
	c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
	require.NoError(t, err)

	wc := a.NewWebConn(c, *session, goi18n.IdentityTfunc(), "en")
	a.HubRegister(wc)
	go wc.Pump()
	return wc
}

func TestHubStopWithMultipleConnections(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	th.App.HubStart()
	wc1 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	wc2 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	wc3 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	defer wc1.Close()
	defer wc2.Close()
	defer wc3.Close()
}

// TestHubStopRaceCondition verifies that attempts to use the hub after it has shutdown does not
// block the caller indefinitely.
func TestHubStopRaceCondition(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(dummyWebsocketHandler(t))

	th.App.HubStart()
	wc1 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
	defer wc1.Close()

	hub := th.App.Srv.Hubs[0]
	th.App.HubStop()
	time.Sleep(5 * time.Second)

	done := make(chan bool)
	go func() {
		wc4 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
		wc5 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
		hub.Register(wc4)
		hub.Register(wc5)

		hub.UpdateActivity("userId", "sessionToken", 0)

		for i := 0; i <= BROADCAST_QUEUE_SIZE; i++ {
			hub.Broadcast(model.NewWebSocketEvent("", "", "", "", nil))
		}

		hub.InvalidateUser("userId")
		hub.Unregister(wc4)
		hub.Unregister(wc5)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		require.FailNow(t, "hub call did not return within 15 seconds after stop")
	}
}
