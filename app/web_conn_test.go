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

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

func TestWebConnShouldSendEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	session, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamUserRoleId,
		},
	}})
	require.Nil(t, err)

	basicUserWc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser.Id,
		T:      i18n.T,
	}

	user1ConnID := model.NewId()
	basicUserWc.SetConnectionID(user1ConnID)
	basicUserWc.SetSession(session)
	basicUserWc.SetSessionToken(session.Token)
	basicUserWc.SetSessionExpiresAt(session.ExpiresAt)

	session2, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser2.Id, Roles: th.BasicUser2.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser2.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamAdminRoleId,
		},
	}})
	require.Nil(t, err)

	basicUser2Wc := &WebConn{
		App:    th.App,
		UserId: th.BasicUser2.Id,
		T:      i18n.T,
	}

	user2ConnID := model.NewId()
	basicUser2Wc.SetConnectionID(user2ConnID)
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

	adminConnID := model.NewId()
	adminUserWc.SetConnectionID(adminConnID)
	adminUserWc.SetSession(session3)
	adminUserWc.SetSessionToken(session3.Token)
	adminUserWc.SetSessionExpiresAt(session3.ExpiresAt)

	session4, err := th.App.CreateSession(&model.Session{UserId: th.BasicUser.Id, Roles: th.BasicUser.GetRawRoles(), TeamMembers: []*model.TeamMember{
		{
			UserId: th.BasicUser.Id,
			TeamId: th.BasicTeam.Id,
			Roles:  model.TeamUserRoleId,
		},
	}})
	require.Nil(t, err)

	basicUserWc2 := &WebConn{
		App:    th.App,
		UserId: th.BasicUser.Id,
		T:      i18n.T,
	}

	user1Conn2ID := model.NewId()
	basicUserWc2.SetConnectionID(user1Conn2ID)
	basicUserWc2.SetSession(session4)
	basicUserWc2.SetSessionToken(session4.Token)
	basicUserWc2.SetSessionExpiresAt(session4.ExpiresAt)

	// By default, only BasicUser and BasicUser2 get added to the BasicTeam.
	th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)

	// Create another channel with just BasicUser (implicitly) and SystemAdminUser to test channel broadcast
	channel2 := th.CreateChannel(th.Context, th.BasicTeam)
	th.AddUserToChannel(th.SystemAdminUser, channel2)

	cases := []struct {
		Description        string
		Broadcast          *model.WebsocketBroadcast
		User1Expected      bool
		User2Expected      bool
		AdminExpected      bool
		User1Conn2Expected bool
	}{
		{"should send to all", &model.WebsocketBroadcast{}, true, true, true, true},
		{"should only send to basic user", &model.WebsocketBroadcast{UserId: th.BasicUser.Id}, true, false, false, true},
		{"should only send to basic user conn 1", &model.WebsocketBroadcast{ConnectionId: user1ConnID}, true, false, false, false},
		{"should only send to basic user conn 2", &model.WebsocketBroadcast{ConnectionId: user1Conn2ID}, false, false, false, true},
		{"should omit basic user 2", &model.WebsocketBroadcast{OmitUsers: map[string]bool{th.BasicUser2.Id: true}}, true, false, true, true},
		{"should only send to admin", &model.WebsocketBroadcast{ContainsSensitiveData: true}, false, false, true, false},
		{"should only send to non-admins", &model.WebsocketBroadcast{ContainsSanitizedData: true}, true, true, false, true},
		{"should send to nobody", &model.WebsocketBroadcast{ContainsSensitiveData: true, ContainsSanitizedData: true}, false, false, false, false},
		{"should omit basic user 2 by connection id", &model.WebsocketBroadcast{OmitConnectionId: user2ConnID}, true, false, true, true},
		// needs more cases to get full coverage
	}

	event := model.NewWebSocketEvent("some_event", "", "", "", nil, "")
	for _, c := range cases {
		t.Run(c.Description, func(t *testing.T) {
			event = event.SetBroadcast(c.Broadcast)
			if c.User1Expected {
				assert.True(t, basicUserWc.shouldSendEvent(th.Context, event), "expected user 1")
			} else {
				assert.False(t, basicUserWc.shouldSendEvent(th.Context, event), "did not expect user 1")
			}
			if c.User2Expected {
				assert.True(t, basicUser2Wc.shouldSendEvent(th.Context, event), "expected user 2")
			} else {
				assert.False(t, basicUser2Wc.shouldSendEvent(th.Context, event), "did not expect user 2")
			}
			if c.AdminExpected {
				assert.True(t, adminUserWc.shouldSendEvent(th.Context, event), "expected admin")
			} else {
				assert.False(t, adminUserWc.shouldSendEvent(th.Context, event), "did not expect admin")
			}
			if c.User1Conn2Expected {
				assert.True(t, basicUserWc2.shouldSendEvent(th.Context, event), "expected user 1 conn 2")
			} else {
				assert.False(t, basicUserWc2.shouldSendEvent(th.Context, event), "did not expect user 1 conn 2")
			}
		})
	}

	t.Run("should send to basic user in basic channel", func(t *testing.T) {
		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: th.BasicChannel.Id})

		assert.True(t, basicUserWc.shouldSendEvent(th.Context, event), "expected user 1")
		assert.False(t, basicUser2Wc.shouldSendEvent(th.Context, event), "did not expect user 2")
		assert.False(t, adminUserWc.shouldSendEvent(th.Context, event), "did not expect admin")
	})

	t.Run("should send to basic user and admin in channel2", func(t *testing.T) {
		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: channel2.Id})

		assert.True(t, basicUserWc.shouldSendEvent(th.Context, event), "expected user 1")
		assert.False(t, basicUser2Wc.shouldSendEvent(th.Context, event), "did not expect user 2")
		assert.True(t, adminUserWc.shouldSendEvent(th.Context, event), "expected admin")
	})

	t.Run("channel member cache invalidated after user added to channel", func(t *testing.T) {
		th.AddUserToChannel(th.BasicUser2, channel2)
		basicUser2Wc.InvalidateCache()

		event = event.SetBroadcast(&model.WebsocketBroadcast{ChannelId: channel2.Id})
		assert.True(t, basicUserWc.shouldSendEvent(th.Context, event), "expected user 1")
		assert.True(t, basicUser2Wc.shouldSendEvent(th.Context, event), "expected user 2")
		assert.True(t, adminUserWc.shouldSendEvent(th.Context, event), "expected admin")
	})

	event2 := model.NewWebSocketEvent(model.WebsocketEventUpdateTeam, th.BasicTeam.Id, "", "", nil, "")
	assert.True(t, basicUserWc.shouldSendEvent(th.Context, event2))
	assert.True(t, basicUser2Wc.shouldSendEvent(th.Context, event2))

	event3 := model.NewWebSocketEvent(model.WebsocketEventUpdateTeam, "wrongId", "", "", nil, "")
	assert.False(t, basicUserWc.shouldSendEvent(th.Context, event3))
}

func TestWebConnAddDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	wc := th.App.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	})

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

	wc := th.App.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	})

	var i int
	for ; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(0)
	ok, ind := wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 0, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(1)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 1, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(2)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	assert.False(t, wc.hasMsgLoss())

	for ; i < deadQueueSize+2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.Sequence = int64(129)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 1, ind)
	wc.Sequence = int64(128)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 0, ind)
	wc.Sequence = int64(2)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.True(t, ok)
	assert.Equal(t, 2, ind)
	assert.True(t, wc.hasMsgLoss())
	wc.Sequence = int64(0)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	wc.Sequence = int64(130)
	ok, ind = wc.isInDeadQueue(wc.Sequence)
	assert.False(t, ok)
	assert.Equal(t, 0, ind)
	assert.False(t, wc.hasMsgLoss())
}

func TestWebConnClearDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	wc := th.App.NewWebConn(&WebConnConfig{
		WebSocket: &websocket.Conn{},
	})

	var i int
	for ; i < 2; i++ {
		msg := &model.WebSocketEvent{}
		msg = msg.SetSequence(int64(i))
		wc.addToDeadQueue(msg)
	}

	wc.clearDeadQueue()

	assert.Equal(t, 0, wc.deadQueuePointer)
}

func TestWebConnDrainDeadQueue(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	var dialConn = func(t *testing.T, a *App, addr net.Addr) *WebConn {
		d := websocket.Dialer{}
		c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
		require.NoError(t, err)

		cfg := &WebConnConfig{
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

		err := wc.drainDeadQueue(th.Context, 0)
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
				if err != nil && len(buf) > 0 {
					ev, jsonErr := model.WebSocketEventFromJSON(bytes.NewReader(buf))
					require.NoError(t, jsonErr)
					require.LessOrEqual(t, int(i), limit)
					assert.Equal(t, i, ev.GetSequence())
					i++
				}
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

		for i := 0; i < limit; i++ {
			msg := model.NewWebSocketEvent("", "", "", "", map[string]bool{}, "")
			msg = msg.SetSequence(int64(i))
			wc.addToDeadQueue(msg)
		}
		wc.Sequence = seqNum
		ok, index := wc.isInDeadQueue(wc.Sequence)
		require.True(t, ok)

		err := wc.drainDeadQueue(th.Context, index)
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
