// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
)

func TestWebConnShouldSendEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	session, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TEAM_USER_ROLE_ID,
		},
	}})
	require.Nil(t, err)

	basicUserWc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser.Id,
		T:      i18n.T,
	}

	basicUserWc.SetSession(session)
	basicUserWc.SetSessionToken(session.Token)
	basicUserWc.SetSessionExpiresAt(session.ExpiresAt)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser2.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TEAM_ADMIN_ROLE_ID,
		},
	}})
	require.Nil(t, err)

	basicUser2Wc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser2.Id,
		T:      i18n.T,
	}

	basicUser2Wc.SetSession(session2)
	basicUser2Wc.SetSessionToken(session2.Token)
	basicUser2Wc.SetSessionExpiresAt(session2.ExpiresAt)

	session3, err := th.App.CreateSession(&model.Session{UserId: th.SystemAdminUser.Id, Roles: th.SystemAdminUser.GetRawRoles()})
	require.Nil(t, err)

	adminUserWc := &WebConn{
		App:    th.App,
		UserId: th.SystemAdminUser.Id,
		T:      i18n.T,
	}

	adminUserWc.SetSession(session3)
	adminUserWc.SetSessionToken(session3.Token)
	adminUserWc.SetSessionExpiresAt(session3.ExpiresAt)

	cases := []struct {
		Description   string
		Broadcast     *model.WebsocketBroadcast
		User1Expected bool
		User2Expected bool
		AdminExpected bool
	}{
		{"should send to all", &model.WebsocketBroadcast{}, true, true, true},
		{"should only send to basic user", &model.WebsocketBroadcast{UserId: th.BasicUser.Id}, true, false, false},
		{"should omit basic user 2", &model.WebsocketBroadcast{OmitUsers: map[string]bool{th.BasicUser2.Id: true}}, true, false, true},
		{"should only send to admin", &model.WebsocketBroadcast{ContainsSensitiveData: true}, false, false, true},
		{"should only send to non-admins", &model.WebsocketBroadcast{ContainsSanitizedData: true}, true, true, false},
		{"should send to nobody", &model.WebsocketBroadcast{ContainsSensitiveData: true, ContainsSanitizedData: true}, false, false, false},
		// needs more cases to get full coverage
	}

	event := model.NewWebSocketEvent("some_event", "", "", "", nil)
	for _, c := range cases {
		event = event.SetBroadcast(c.Broadcast)
		assert.Equal(t, c.User1Expected, basicUserWc.shouldSendEvent(event), c.Description)
		assert.Equal(t, c.User2Expected, basicUser2Wc.shouldSendEvent(event), c.Description)
		assert.Equal(t, c.AdminExpected, adminUserWc.shouldSendEvent(event), c.Description)
	}

	event2 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_UPDATE_TEAM, th.BasicTeam.Id, "", "", nil)
	assert.True(t, basicUserWc.shouldSendEvent(event2))
	assert.True(t, basicUser2Wc.shouldSendEvent(event2))

	event3 := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_UPDATE_TEAM, "wrongId", "", "", nil)
	assert.False(t, basicUserWc.shouldSendEvent(event3))
}

func TestWebConnAddDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableReliableWebSockets = true })

	wc := th.App.NewWebConn(WebConnConfig{})

	for i := 0; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	for i := 0; i < 2; i++ {
		assert.Equal(t, int64(i), wc.deadQueue[i].GetSequence())
	}

	// Should push out the first two elements
	for i := 0; i < deadQueueSize; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i + 2))
		wc.addToDeadQueue(msg)
	}
	for i := 0; i < deadQueueSize; i++ {
		assert.Equal(t, int64(i+2), wc.deadQueue[(i+2)%deadQueueSize].GetSequence())
	}
}

func TestWebConnIsInDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableReliableWebSockets = true
	})

	wc := th.App.NewWebConn(WebConnConfig{})

	var i int
	for ; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(0)
	assert.True(t, wc.isInDeadQueue())
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(1)
	assert.True(t, wc.isInDeadQueue())
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(2)
	assert.False(t, wc.isInDeadQueue())
	assert.False(t, wc.hasMsgLoss())

	for ; i < deadQueueSize+2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(129)
	assert.True(t, wc.isInDeadQueue())
	wc.Sequence = int64(128)
	assert.True(t, wc.isInDeadQueue())
	wc.Sequence = int64(2)
	assert.True(t, wc.isInDeadQueue())
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(0)
	assert.False(t, wc.isInDeadQueue())
	wc.Sequence = int64(130)
	assert.False(t, wc.isInDeadQueue())
	assert.False(t, wc.hasMsgLoss())
}

func TestWebConnDrainDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableReliableWebSockets = true
	})

	var dialConn = func(t *testing.T, a *App, addr net.Addr) *WebConn {
		d := websocket.Dialer{}
		c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
		require.NoError(t, err)

		cfg := WebConnConfig{
			WebSocket: c,
		}
		return a.NewWebConn(cfg)
	}

	t.Run("Empty Queue", func(t *testing.T) {
		var handler = func(t *testing.T) http.HandlerFunc {
			return func(w http.ResponseWriter, req *http.Request) {
				upgrader := &websocket.Upgrader{}
				conn, err := upgrader.Upgrade(w, req, nil)
				cnt := 0
				for err == nil {
					_, _, err = conn.ReadMessage()
					cnt++
				}
				assert.Equal(t, 1, cnt)
				if _, ok := err.(*websocket.CloseError); !ok {
					require.NoError(t, err)
				}
			}
		}
		s := httptest.NewServer(handler(t))
		defer s.Close()

		wc := dialConn(t, th.App, s.Listener.Addr())
		defer wc.WebSocket.Close()
		wc.clearDeadQueue()

		err := wc.drainDeadQueue()
		require.NoError(t, err)
	})

	var handler = func(t *testing.T, seqNum int64, limit int) http.HandlerFunc {
		return func(w http.ResponseWriter, req *http.Request) {
			upgrader := &websocket.Upgrader{}
			conn, err := upgrader.Upgrade(w, req, nil)
			var buf []byte
			i := seqNum
			for err == nil {
				_, buf, err = conn.ReadMessage()
				ev := model.WebSocketEventFromJson(bytes.NewReader(buf))
				require.LessOrEqual(t, int(i), limit)
				assert.Equal(t, i, ev.Sequence)
				i++
			}
			if _, ok := err.(*websocket.CloseError); !ok {
				require.NoError(t, err)
			}
		}
	}

	run := func(seqNum int64, limit int) {
		s := httptest.NewServer(handler(t, seqNum, limit))
		defer s.Close()

		wc := dialConn(t, th.App, s.Listener.Addr())
		defer wc.WebSocket.Close()

		var i int
		for ; i < limit; i++ {
			msg := model.NewWebSocketEvent("", "", "", "", map[string]bool{})
			msg = msg.SetSequence(int64(i))
			wc.addToDeadQueue(msg)
		}
		wc.Sequence = seqNum
		require.True(t, wc.isInDeadQueue())

		err := wc.drainDeadQueue()
		require.NoError(t, err)
	}

	t.Run("Half-full Queue", func(t *testing.T) {
		t.Run("Middle", func(t *testing.T) { run(int64(2), 10) })
		t.Run("Beginning", func(t *testing.T) { run(int64(0), 10) })
		t.Run("End", func(t *testing.T) { run(int64(9), 10) })
		t.Run("Full", func(t *testing.T) { run(int64(deadQueueSize-1), deadQueueSize) })
	})

	t.Run("Cycled Queue", func(t *testing.T) {
		t.Run("First un-overwritten", func(t *testing.T) { run(int64(10), deadQueueSize+10) })
		t.Run("End", func(t *testing.T) { run(int64(127), deadQueueSize+10) })
		t.Run("Cycled End", func(t *testing.T) { run(int64(137), deadQueueSize+10) })
		t.Run("Overwritten First", func(t *testing.T) { run(int64(128), deadQueueSize+10) })
	})
}
