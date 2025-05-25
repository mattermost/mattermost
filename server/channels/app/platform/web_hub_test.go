// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"iter"
	"net"
	"net/http"
	"net/http/httptest"
	"runtime"
	"slices"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	platform_mocks "github.com/mattermost/mattermost/server/v8/channels/app/platform/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
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

func registerDummyWebConn(t *testing.T, th *TestHelper, addr net.Addr, session *model.Session) *WebConn {
	d := websocket.Dialer{}
	c, _, err := d.Dial("ws://"+addr.String()+"/ws", nil)
	require.NoError(t, err)

	cfg := &WebConnConfig{
		WebSocket: c,
		Session:   *session,
		TFunc:     i18n.IdentityTfunc(),
		Locale:    "en",
	}
	wc := th.Service.NewWebConn(cfg, th.Suite, &hookRunner{})
	require.NoError(t, th.Service.HubRegister(wc))
	go wc.Pump()
	return wc
}

func TestHubStopWithMultipleConnections(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	err = th.Service.Start(nil)
	require.NoError(t, err)
	wc1 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	wc2 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	wc3 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	defer wc1.Close()
	defer wc2.Close()
	defer wc3.Close()
}

// TestHubStopRaceCondition verifies that attempts to use the hub after it has shutdown does not
// block the caller indefinitely.
func TestHubStopRaceCondition(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.Service.Store.Close()
	// We do not call TearDown because th.TearDown shuts down the hub again. And hub close is not idempotent.
	// Making it idempotent is not really important to the server because close only happens once.
	// So we just use this quick hack for the test.
	s := httptest.NewServer(dummyWebsocketHandler(t))

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	err = th.Service.Start(nil)
	require.NoError(t, err)
	wc1 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	defer wc1.Close()

	hub := th.Service.hubs[0]
	th.Service.HubStop()

	done := make(chan bool)
	go func() {
		wc4 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
		wc5 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
		require.NoError(t, hub.Register(wc4))
		require.NoError(t, hub.Register(wc5))

		hub.UpdateActivity("userId", "sessionToken", 0)

		for i := 0; i <= broadcastQueueSize; i++ {
			hub.Broadcast(model.NewWebSocketEvent("", "", "", "", nil, ""))
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

func TestHubSessionRevokeRace(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	// This needs to be false for the condition to trigger
	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ExtendSessionLengthWithActivity = false
	})

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: model.NewId(),
	})
	require.NoError(t, err)

	wc1 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	hub := th.Service.GetHubForUserId(wc1.UserId)

	done := make(chan bool)

	time.Sleep(2 * time.Second)
	// We override the LastActivityAt which happens in NewWebConn.
	// This is needed to call RevokeSessionById which triggers the race.

	err = th.Service.AddSessionToCache(session)
	require.NoError(t, err)

	go func() {
		for i := 0; i <= broadcastQueueSize; i++ {
			hub.Broadcast(model.NewWebSocketEvent("", "teamID", "", "", nil, ""))
		}
		close(done)
	}()

	// This call should happen _after_ !wc.IsAuthenticated() and _before_wc.isMemberOfTeam().
	// There's no guarantee this will happen. But that's our best bet to trigger this race.
	wc1.InvalidateCache()

	for i := 0; i < 10; i++ {
		// If broadcast buffer has not emptied,
		// we sleep for a second and check again
		if len(hub.broadcast) > 0 {
			time.Sleep(time.Second)
			continue
		}
	}
	if len(hub.broadcast) > 0 {
		require.Fail(t, "hub is deadlocked")
	}
}

func TestHubConnIndex(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, err := th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   th.BasicChannel.Id,
		UserId:      th.BasicUser.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: th.BasicUser.IsGuest(),
		SchemeUser:  !th.BasicUser.IsGuest(),
	})
	require.NoError(t, err)
	_, err = th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   th.BasicChannel.Id,
		UserId:      th.BasicUser2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: th.BasicUser2.IsGuest(),
		SchemeUser:  !th.BasicUser2.IsGuest(),
	})
	require.NoError(t, err)

	for _, fastIterate := range []bool{true, false} {
		t.Run(fmt.Sprintf("fastIterate=%t", fastIterate), func(t *testing.T) {
			t.Run("Basic", func(t *testing.T) {
				connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, fastIterate)

				// User1
				wc1 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   model.NewId(),
				}
				wc1.SetConnectionID(model.NewId())
				wc1.SetSession(&model.Session{})

				// User2
				wc2 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   model.NewId(),
				}
				wc2.SetConnectionID(model.NewId())
				wc2.SetSession(&model.Session{})

				wc3 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   wc2.UserId,
				}
				wc3.SetConnectionID(model.NewId())
				wc3.SetSession(&model.Session{})

				wc4 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   wc2.UserId,
				}
				wc4.SetConnectionID(model.NewId())
				wc4.SetSession(&model.Session{})

				errAdd := connIndex.Add(wc1)
				require.NoError(t, errAdd)
				err = connIndex.Add(wc2)
				require.NoError(t, err)
				err = connIndex.Add(wc3)
				require.NoError(t, err)
				err = connIndex.Add(wc4)
				require.NoError(t, err)

				t.Run("Basic", func(t *testing.T) {
					assert.True(t, connIndex.Has(wc1))
					assert.True(t, connIndex.Has(wc2))

					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc2.UserId)), []*WebConn{wc2, wc3, wc4})
					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc1.UserId)), []*WebConn{wc1})
					assert.True(t, connIndex.Has(wc2))
					assert.True(t, connIndex.Has(wc1))
					assert.Len(t, connIndex.All(), 4)
				})

				t.Run("RemoveMiddleUser2", func(t *testing.T) {
					connIndex.Remove(wc3) // Remove from middle from user2

					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc2.UserId)), []*WebConn{wc2, wc4})
					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc1.UserId)), []*WebConn{wc1})
					assert.True(t, connIndex.Has(wc2))
					assert.False(t, connIndex.Has(wc3))
					assert.True(t, connIndex.Has(wc4))
					assert.Len(t, connIndex.All(), 3)
				})

				t.Run("RemoveUser1", func(t *testing.T) {
					connIndex.Remove(wc1) // Remove sole connection from user1

					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc2.UserId)), []*WebConn{wc2, wc4})
					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc1.UserId)), []*WebConn{})
					assert.Len(t, slices.Collect(connIndex.ForUser(wc1.UserId)), 0)
					assert.Len(t, connIndex.All(), 2)
					assert.False(t, connIndex.Has(wc1))
					assert.True(t, connIndex.Has(wc2))
				})

				t.Run("RemoveEndUser2", func(t *testing.T) {
					connIndex.Remove(wc4) // Remove from end from user2

					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc2.UserId)), []*WebConn{wc2})
					assert.ElementsMatch(t, slices.Collect(connIndex.ForUser(wc1.UserId)), []*WebConn{})
					assert.True(t, connIndex.Has(wc2))
					assert.False(t, connIndex.Has(wc3))
					assert.False(t, connIndex.Has(wc4))
					assert.Len(t, connIndex.All(), 1)
				})
			})

			t.Run("ByConnectionId", func(t *testing.T) {
				connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, fastIterate)

				// User1
				wc1ID := model.NewId()
				wc1 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   th.BasicUser.Id,
				}
				wc1.SetConnectionID(wc1ID)
				wc1.SetSession(&model.Session{})

				// User2
				wc2ID := model.NewId()
				wc2 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   th.BasicUser2.Id,
				}
				wc2.SetConnectionID(wc2ID)
				wc2.SetSession(&model.Session{})

				wc3ID := model.NewId()
				wc3 := &WebConn{
					Platform: th.Service,
					Suite:    th.Suite,
					UserId:   wc2.UserId,
				}
				wc3.SetConnectionID(wc3ID)
				wc3.SetSession(&model.Session{})

				t.Run("no connections", func(t *testing.T) {
					assert.False(t, connIndex.Has(wc1))
					assert.False(t, connIndex.Has(wc2))
					assert.False(t, connIndex.Has(wc3))
					assert.Empty(t, connIndex.byConnectionId)
				})

				t.Run("adding", func(t *testing.T) {
					err = connIndex.Add(wc1)
					require.NoError(t, err)
					err = connIndex.Add(wc3)
					require.NoError(t, err)

					assert.Len(t, connIndex.byConnectionId, 2)
					assert.Equal(t, wc1, connIndex.ForConnection(wc1ID))
					assert.Equal(t, wc3, connIndex.ForConnection(wc3ID))
					assert.Equal(t, (*WebConn)(nil), connIndex.ForConnection(wc2ID))
				})

				t.Run("removing", func(t *testing.T) {
					connIndex.Remove(wc3)

					assert.Len(t, connIndex.byConnectionId, 1)
					assert.Equal(t, wc1, connIndex.ForConnection(wc1ID))
					assert.Equal(t, (*WebConn)(nil), connIndex.ForConnection(wc3ID))
					assert.Equal(t, (*WebConn)(nil), connIndex.ForConnection(wc2ID))
				})
			})
		})
	}

	t.Run("ByChannelId", func(t *testing.T) {
		connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, true)

		// User1
		wc1ID := model.NewId()
		wc1 := &WebConn{
			Platform: th.Service,
			Suite:    th.Suite,
			UserId:   th.BasicUser.Id,
		}
		wc1.SetConnectionID(wc1ID)
		wc1.SetSession(&model.Session{})

		// User2
		wc2ID := model.NewId()
		wc2 := &WebConn{
			Platform: th.Service,
			Suite:    th.Suite,
			UserId:   th.BasicUser2.Id,
		}
		wc2.SetConnectionID(wc2ID)
		wc2.SetSession(&model.Session{})

		wc3ID := model.NewId()
		wc3 := &WebConn{
			Platform: th.Service,
			Suite:    th.Suite,
			UserId:   wc2.UserId,
		}
		wc3.SetConnectionID(wc3ID)
		wc3.SetSession(&model.Session{})

		err = connIndex.Add(wc1)
		require.NoError(t, err)
		err = connIndex.Add(wc2)
		require.NoError(t, err)
		err = connIndex.Add(wc3)
		require.NoError(t, err)

		t.Run("ForChannel", func(t *testing.T) {
			require.Len(t, connIndex.byChannelID, 1)
			ids := make([]string, 0)
			for c := range connIndex.ForChannel(th.BasicChannel.Id) {
				ids = append(ids, c.GetConnectionID())
			}
			require.ElementsMatch(t, []string{wc1ID, wc2ID, wc3ID}, ids)
			require.Len(t, slices.Collect(connIndex.ForChannel("notexist")), 0)
		})

		ch := th.CreateChannel(th.BasicTeam)
		_, err = th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   ch.Id,
			UserId:      th.BasicUser2.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeGuest: th.BasicUser2.IsGuest(),
			SchemeUser:  !th.BasicUser2.IsGuest(),
		})
		require.NoError(t, err)

		t.Run("InvalidateCMCacheForUser", func(t *testing.T) {
			require.NoError(t, connIndex.InvalidateCMCacheForUser(th.BasicUser2.Id))
			require.Len(t, connIndex.byChannelID, 2)
			require.Len(t, slices.Collect(connIndex.ForChannel(th.BasicChannel.Id)), 3)
			require.Len(t, slices.Collect(connIndex.ForChannel(ch.Id)), 2)
		})

		t.Run("Remove", func(t *testing.T) {
			connIndex.Remove(wc3)
			require.Len(t, connIndex.byChannelID, 2)
			require.Len(t, slices.Collect(connIndex.ForChannel(th.BasicChannel.Id)), 2)
		})
	})
}

func TestHubConnIndexIncorrectRemoval(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)

	// User2
	wc2 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   model.NewId(),
	}
	wc2.SetConnectionID("first")
	wc2.SetSession(&model.Session{})

	wc3 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   wc2.UserId,
	}
	wc3.SetConnectionID("myID")
	wc3.SetSession(&model.Session{})

	wc4 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   wc2.UserId,
	}
	wc4.SetConnectionID("last")
	wc4.SetSession(&model.Session{})

	err := connIndex.Add(wc2)
	require.NoError(t, err)
	err = connIndex.Add(wc3)
	require.NoError(t, err)
	err = connIndex.Add(wc4)
	require.NoError(t, err)

	for wc := range connIndex.ForUser(wc2.UserId) {
		if !connIndex.Has(wc) {
			require.Failf(t, "Failed to find connection", "connection: %v", wc)
			continue
		}

		if connIndex.ForConnection("myID") != nil {
			connIndex.Remove(wc)
		}
	}
}

func TestHubConnIndexInactive(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	connIndex := newHubConnectionIndex(2*time.Second, th.Service.Store, th.Service.logger, false)

	// User1
	wc1 := &WebConn{
		Platform: th.Service,
		UserId:   model.NewId(),
	}
	wc1.Active.Store(true)
	wc1.SetConnectionID("conn1")
	wc1.SetSession(&model.Session{})

	// User2
	wc2 := &WebConn{
		Platform: th.Service,
		UserId:   model.NewId(),
	}
	wc2.Active.Store(true)
	wc2.SetConnectionID("conn2")
	wc2.SetSession(&model.Session{})

	wc3 := &WebConn{
		Platform: th.Service,
		UserId:   wc2.UserId,
	}
	wc3.Active.Store(false)
	wc3.SetConnectionID("conn3")
	wc3.SetSession(&model.Session{})

	err := connIndex.Add(wc1)
	require.NoError(t, err)
	err = connIndex.Add(wc2)
	require.NoError(t, err)
	err = connIndex.Add(wc3)
	require.NoError(t, err)

	assert.Nil(t, connIndex.RemoveInactiveByConnectionID(wc2.UserId, "conn2"))
	assert.Equal(t, connIndex.ForUserActiveCount(wc2.UserId), 1)
	assert.NotNil(t, connIndex.RemoveInactiveByConnectionID(wc2.UserId, "conn3"))
	assert.Equal(t, connIndex.ForUserActiveCount(wc2.UserId), 1)
	assert.Nil(t, connIndex.RemoveInactiveByConnectionID(wc1.UserId, "conn3"))
	assert.False(t, connIndex.Has(wc3))
	assert.Len(t, slices.Collect(connIndex.ForUser(wc2.UserId)), 1)

	wc3.lastUserActivityAt = model.GetMillis()
	err = connIndex.Add(wc3)
	require.NoError(t, err)
	connIndex.RemoveInactiveConnections()
	assert.True(t, connIndex.Has(wc3))
	assert.Len(t, slices.Collect(connIndex.ForUser(wc2.UserId)), 2)
	assert.Equal(t, connIndex.ForUserActiveCount(wc2.UserId), 1)
	assert.Len(t, connIndex.All(), 3)

	wc3.lastUserActivityAt = model.GetMillis() - (time.Minute).Milliseconds()
	connIndex.RemoveInactiveConnections()
	assert.False(t, connIndex.Has(wc3))
	assert.Len(t, slices.Collect(connIndex.ForUser(wc2.UserId)), 1)
	assert.Equal(t, connIndex.ForUserActiveCount(wc2.UserId), 1)
	assert.Len(t, connIndex.All(), 2)
}

func TestReliableWebSocketSend(t *testing.T) {
	testCluster := &testlib.FakeClusterInterface{}

	th := SetupWithCluster(t, testCluster)
	defer th.TearDown()

	ev := model.NewWebSocketEvent("test_unreliable_event", "", "", "", nil, "")
	ev = ev.SetBroadcast(&model.WebsocketBroadcast{})
	th.Service.Publish(ev)
	ev2 := model.NewWebSocketEvent("test_reliable_event", "", "", "", nil, "")

	ev2 = ev2.SetBroadcast(&model.WebsocketBroadcast{
		ReliableClusterSend: true,
	})
	th.Service.Publish(ev2)

	messages := testCluster.GetMessages()

	evJSON, err := ev.ToJSON()
	require.NoError(t, err)
	ev2JSON, err := ev2.ToJSON()
	require.NoError(t, err)

	require.Contains(t, messages, &model.ClusterMessage{
		Event:    model.ClusterEventPublish,
		Data:     evJSON,
		SendType: model.ClusterSendBestEffort,
	})
	require.Contains(t, messages, &model.ClusterMessage{
		Event:    model.ClusterEventPublish,
		Data:     ev2JSON,
		SendType: model.ClusterSendReliable,
	})
}

func TestHubIsRegistered(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	mockSuite := &platform_mocks.SuiteIFace{}
	mockSuite.On("GetSession", session.Token).Return(session, nil)
	th.Suite = mockSuite

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	err = th.Service.Start(nil)
	require.NoError(t, err)
	wc1 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	wc2 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	wc3 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	defer wc1.Close()
	defer wc2.Close()
	defer wc3.Close()

	assert.True(t, th.Service.SessionIsRegistered(*wc1.session.Load()))
	assert.True(t, th.Service.SessionIsRegistered(*wc2.session.Load()))
	assert.True(t, th.Service.SessionIsRegistered(*wc3.session.Load()))

	session4, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser2.Id,
	})
	require.NoError(t, err)
	assert.False(t, th.Service.SessionIsRegistered(*session4))
}

func TestHubWebConnCount(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	session, err := th.Service.CreateSession(th.Context, &model.Session{
		UserId: th.BasicUser.Id,
	})
	require.NoError(t, err)

	mockSuite := &platform_mocks.SuiteIFace{}
	mockSuite.On("GetSession", session.Token).Return(session, nil)
	th.Suite = mockSuite

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	err = th.Service.Start(nil)
	require.NoError(t, err)
	wc1 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	wc2 := registerDummyWebConn(t, th, s.Listener.Addr(), session)
	defer wc1.Close()

	assert.Equal(t, 2, th.Service.WebConnCountForUser(th.BasicUser.Id))

	wc2.Close()

	assert.Equal(t, 1, th.Service.WebConnCountForUser(th.BasicUser.Id))
	assert.Equal(t, 0, th.Service.WebConnCountForUser("none"))
}

var globalIter iter.Seq[*WebConn]

func BenchmarkHubConnIndexIteratorForUser(b *testing.B) {
	th := Setup(b)
	defer th.TearDown()

	connIndex := newHubConnectionIndex(2*time.Second, th.Service.Store, th.Service.logger, false)

	// User1
	wc1 := &WebConn{
		Platform: th.Service,
		UserId:   model.NewId(),
	}
	wc1.Active.Store(true)
	wc1.SetConnectionID("conn1")
	wc1.SetSession(&model.Session{})

	// User2
	wc2 := &WebConn{
		Platform: th.Service,
		UserId:   model.NewId(),
	}
	wc2.Active.Store(true)
	wc2.SetConnectionID("conn2")
	wc2.SetSession(&model.Session{})

	wc3 := &WebConn{
		Platform: th.Service,
		UserId:   wc2.UserId,
	}
	wc3.Active.Store(false)
	wc3.SetConnectionID("conn3")
	wc3.SetSession(&model.Session{})

	require.NoError(b, connIndex.Add(wc1))
	require.NoError(b, connIndex.Add(wc2))
	require.NoError(b, connIndex.Add(wc3))

	b.ResetTimer()
	b.Run("2 users", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			globalIter = connIndex.ForUser(wc2.UserId)
		}
	})

	wc4 := &WebConn{
		Platform: th.Service,
		UserId:   wc2.UserId,
	}
	wc4.Active.Store(false)
	wc4.SetConnectionID("conn4")
	wc4.SetSession(&model.Session{})

	require.NoError(b, connIndex.Add(wc4))
	b.ResetTimer()
	b.Run("3 users", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			globalIter = connIndex.ForUser(wc2.UserId)
		}
	})

	wc5 := &WebConn{
		Platform: th.Service,
		UserId:   wc2.UserId,
	}
	wc5.Active.Store(false)
	wc5.SetConnectionID("conn5")
	wc5.SetSession(&model.Session{})

	require.NoError(b, connIndex.Add(wc5))
	b.ResetTimer()
	b.Run("4 users", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			globalIter = connIndex.ForUser(wc2.UserId)
		}
	})
}

func BenchmarkHubConnIndexIteratorForChannel(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	_, err := th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   th.BasicChannel.Id,
		UserId:      th.BasicUser.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: th.BasicUser.IsGuest(),
		SchemeUser:  !th.BasicUser.IsGuest(),
	})
	require.NoError(b, err)
	_, err = th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   th.BasicChannel.Id,
		UserId:      th.BasicUser2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeGuest: th.BasicUser2.IsGuest(),
		SchemeUser:  !th.BasicUser2.IsGuest(),
	})
	require.NoError(b, err)

	connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, true)

	// User1
	wc1ID := model.NewId()
	wc1 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   th.BasicUser.Id,
	}
	wc1.SetConnectionID(wc1ID)
	wc1.SetSession(&model.Session{})

	// User2
	wc2ID := model.NewId()
	wc2 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   th.BasicUser2.Id,
	}
	wc2.SetConnectionID(wc2ID)
	wc2.SetSession(&model.Session{})

	wc3ID := model.NewId()
	wc3 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   wc2.UserId,
	}
	wc3.SetConnectionID(wc3ID)
	wc3.SetSession(&model.Session{})

	require.NoError(b, connIndex.Add(wc1))
	require.NoError(b, connIndex.Add(wc2))
	require.NoError(b, connIndex.Add(wc3))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		globalIter = connIndex.ForChannel(th.BasicChannel.Id)
	}
}

// Always run this with -benchtime=0.1s
// See: https://github.com/golang/go/issues/27217.
func BenchmarkHubConnIndex(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()
	connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)

	// User1
	wc1 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   model.NewId(),
	}

	// User2
	wc2 := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
		UserId:   model.NewId(),
	}
	b.ResetTimer()
	b.Run("Add", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			err := connIndex.Add(wc1)
			require.NoError(b, err)
			err = connIndex.Add(wc2)
			require.NoError(b, err)

			b.StopTimer()
			connIndex.Remove(wc1)
			connIndex.Remove(wc2)
			b.StartTimer()
		}
	})

	b.Run("Remove", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			b.StopTimer()
			err := connIndex.Add(wc1)
			require.NoError(b, err)
			err = connIndex.Add(wc2)
			require.NoError(b, err)
			b.Error(err)
			b.StartTimer()

			connIndex.Remove(wc1)
			connIndex.Remove(wc2)
		}
	})
}

func TestHubConnIndexRemoveMemLeak(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	connIndex := newHubConnectionIndex(1*time.Second, th.Service.Store, th.Service.logger, false)

	wc := &WebConn{
		Platform: th.Service,
		Suite:    th.Suite,
	}
	wc.SetConnectionID(model.NewId())
	wc.SetSession(&model.Session{})

	ch := make(chan struct{})

	runtime.SetFinalizer(wc, func(*WebConn) {
		close(ch)
	})

	err := connIndex.Add(wc)
	require.NoError(t, err)
	connIndex.Remove(wc)

	runtime.GC()

	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()

	select {
	case <-ch:
	case <-timer.C:
		require.Fail(t, "timeout waiting for collection of wc")
	}

	assert.Len(t, connIndex.byConnection, 0)
}

var hubSink *Hub

func BenchmarkGetHubForUserId(b *testing.B) {
	th := Setup(b).InitBasic()
	defer th.TearDown()

	err := th.Service.Start(nil)
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		hubSink = th.Service.GetHubForUserId(th.BasicUser.Id)
	}
}

func TestClusterBroadcast(t *testing.T) {
	testCluster := &testlib.FakeClusterInterface{}

	th := SetupWithCluster(t, testCluster)
	defer th.TearDown()

	ev := model.NewWebSocketEvent("test_event", "", "", "", nil, "")
	broadcast := &model.WebsocketBroadcast{
		ContainsSanitizedData: true,
		ContainsSensitiveData: true,
	}
	ev = ev.SetBroadcast(broadcast)
	th.Service.Publish(ev)

	messages := testCluster.GetMessages()

	var clusterEvent struct {
		Event     string                    `json:"event"`
		Data      map[string]any            `json:"data"`
		Broadcast *model.WebsocketBroadcast `json:"broadcast"`
		Sequence  int64                     `json:"seq"`
	}

	err := json.Unmarshal(messages[0].Data, &clusterEvent)
	require.NoError(t, err)
	require.Equal(t, clusterEvent.Broadcast, broadcast)
}

func TestClusterBroadcastHooks(t *testing.T) {
	t.Run("should send broadcast hook information across cluster", func(t *testing.T) {
		testCluster := &testlib.FakeClusterInterface{}

		th := SetupWithCluster(t, testCluster)
		defer th.TearDown()

		hookID := broadcastTest
		hookArgs := map[string]any{
			"makes_changes": true,
		}

		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		event.GetBroadcast().AddHook(hookID, hookArgs)

		th.Service.Publish(event)

		received, err := model.WebSocketEventFromJSON(bytes.NewReader(testCluster.GetMessages()[0].Data))

		require.NoError(t, err)
		assert.Equal(t, []string{hookID}, received.GetBroadcast().BroadcastHooks)
		assert.Equal(t, []map[string]any{hookArgs}, received.GetBroadcast().BroadcastHookArgs)
	})

	t.Run("should not preserve type information for args", func(t *testing.T) {
		// This behaviour isn't ideal, but this test confirms that it hasn't changed
		testCluster := &testlib.FakeClusterInterface{}

		th := SetupWithCluster(t, testCluster)
		defer th.TearDown()

		hookID := "test_broadcast_hook_with_args"
		hookArgs := map[string]any{
			"user":  &model.User{Id: "user1"},
			"array": []string{"a", "b", "c"},
		}

		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		event.GetBroadcast().AddHook(hookID, hookArgs)

		th.Service.Publish(event)

		received, err := model.WebSocketEventFromJSON(bytes.NewReader(testCluster.GetMessages()[0].Data))

		require.NoError(t, err)
		assert.Equal(t, []string{hookID}, received.GetBroadcast().BroadcastHooks)
		assert.IsType(t, map[string]any{}, received.GetBroadcast().BroadcastHookArgs[0]["user"])
		assert.IsType(t, []any{}, received.GetBroadcast().BroadcastHookArgs[0]["array"])
	})
}
