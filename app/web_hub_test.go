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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func dummyWebsocketHandler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		mlog.Debug("dummyWebsocketHandler")
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

	hub := th.App.Srv().GetHubs()[0]
	th.App.HubStop()
	time.Sleep(5 * time.Second)

	done := make(chan bool)
	go func() {
		wc4 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
		wc5 := registerDummyWebConn(t, th.App, s.Listener.Addr(), th.BasicUser.Id)
		hub.Register(wc4)
		hub.Register(wc5)

		hub.UpdateActivity("userId", "sessionToken", 0)

		for i := 0; i <= broadcastQueueSize; i++ {
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

func TestHubConnIndex(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	connIndex := newHubConnectionIndex()

	// User1
	wc1 := &WebConn{
		App:    th.App,
		UserId: model.NewId(),
	}

	// User2
	wc2 := &WebConn{
		App:    th.App,
		UserId: model.NewId(),
	}
	wc3 := &WebConn{
		App:    th.App,
		UserId: wc2.UserId,
	}
	wc4 := &WebConn{
		App:    th.App,
		UserId: wc2.UserId,
	}

	connIndex.Add(wc1)
	connIndex.Add(wc2)
	connIndex.Add(wc3)
	connIndex.Add(wc4)

	t.Run("Basic", func(t *testing.T) {
		assert.True(t, connIndex.Has(wc1))
		assert.True(t, connIndex.Has(wc2))

		assert.ElementsMatch(t, connIndex.ForUser(wc2.UserId), []*WebConn{wc2, wc3, wc4})
		assert.ElementsMatch(t, connIndex.ForUser(wc1.UserId), []*WebConn{wc1})
		assert.True(t, connIndex.Has(wc2))
		assert.True(t, connIndex.Has(wc1))
		assert.Len(t, connIndex.All(), 4)
	})

	t.Run("RemoveMiddleUser2", func(t *testing.T) {
		connIndex.Remove(wc3) // Remove from middle from user2

		assert.ElementsMatch(t, connIndex.ForUser(wc2.UserId), []*WebConn{wc2, wc4})
		assert.ElementsMatch(t, connIndex.ForUser(wc1.UserId), []*WebConn{wc1})
		assert.True(t, connIndex.Has(wc2))
		assert.False(t, connIndex.Has(wc3))
		assert.True(t, connIndex.Has(wc4))
		assert.Len(t, connIndex.All(), 3)
	})

	t.Run("RemoveUser1", func(t *testing.T) {
		connIndex.Remove(wc1) // Remove sole connection from user1

		assert.ElementsMatch(t, connIndex.ForUser(wc2.UserId), []*WebConn{wc2, wc4})
		assert.ElementsMatch(t, connIndex.ForUser(wc1.UserId), []*WebConn{})
		assert.Len(t, connIndex.All(), 2)
		assert.False(t, connIndex.Has(wc1))
		assert.True(t, connIndex.Has(wc2))
	})

	t.Run("RemoveEndUser2", func(t *testing.T) {
		connIndex.Remove(wc4) // Remove from end from user2

		assert.ElementsMatch(t, connIndex.ForUser(wc2.UserId), []*WebConn{wc4})
		assert.ElementsMatch(t, connIndex.ForUser(wc1.UserId), []*WebConn{})
		assert.True(t, connIndex.Has(wc2))
		assert.False(t, connIndex.Has(wc3))
		assert.False(t, connIndex.Has(wc4))
		assert.Len(t, connIndex.All(), 1)
	})
}

// Always run this with -benchtime=0.1s
// See: https://github.com/golang/go/issues/27217.
func BenchmarkHubConnIndex(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()
	connIndex := newHubConnectionIndex()

	// User1
	wc1 := &WebConn{
		App:    th.App,
		UserId: model.NewId(),
	}

	// User2
	wc2 := &WebConn{
		App:    th.App,
		UserId: model.NewId(),
	}
	b.ResetTimer()
	b.Run("Add", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			connIndex.Add(wc1)
			connIndex.Add(wc2)

			b.StopTimer()
			connIndex.Remove(wc1)
			connIndex.Remove(wc2)
			b.StartTimer()
		}
	})

	b.Run("Remove", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			connIndex.Add(wc1)
			connIndex.Add(wc2)
			b.StartTimer()

			connIndex.Remove(wc1)
			connIndex.Remove(wc2)
		}
	})
}

func TestHubIsRegistered(t *testing.T) {
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

	session1 := wc1.session.Load().(*model.Session)

	assert.True(t, th.App.SessionIsRegistered(*session1))
	assert.True(t, th.App.SessionIsRegistered(*wc2.session.Load().(*model.Session)))
	assert.True(t, th.App.SessionIsRegistered(*wc3.session.Load().(*model.Session)))

	session4, appErr := th.App.CreateSession(&model.Session{
		UserId: th.BasicUser2.Id,
	})
	require.Nil(t, appErr)
	assert.False(t, th.App.SessionIsRegistered(*session4))
}
