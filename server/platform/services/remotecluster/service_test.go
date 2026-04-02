// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

func TestService_AddTopicListener(t *testing.T) {
	var count atomic.Int32

	l1 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		count.Add(1)
		return nil
	}
	l2 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		count.Add(1)
		return nil
	}
	l3 := func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *Response) error {
		count.Add(1)
		return nil
	}

	mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, "", false))
	mockApp := newMockApp(t, nil)

	service, err := NewRemoteClusterService(mockServer, mockApp)
	require.NoError(t, err)

	l1id := service.AddTopicListener("test", l1)
	l2id := service.AddTopicListener("test", l2)
	l3id := service.AddTopicListener("different", l3)

	listeners := service.getTopicListeners("test")
	assert.Len(t, listeners, 2)

	rc := &model.RemoteCluster{}
	msg1 := model.RemoteClusterMsg{Topic: "test"}
	msg2 := model.RemoteClusterMsg{Topic: "different"}

	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(2), count.Load())

	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(3), count.Load())

	service.RemoveTopicListener(l1id)
	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(4), count.Load())

	service.RemoveTopicListener(l2id)
	service.ReceiveIncomingMsg(rc, msg1)
	assert.Equal(t, int32(4), count.Load())

	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(5), count.Load())

	service.RemoveTopicListener(l3id)
	service.ReceiveIncomingMsg(rc, msg1)
	service.ReceiveIncomingMsg(rc, msg2)
	assert.Equal(t, int32(5), count.Load())

	listeners = service.getTopicListeners("test")
	assert.Empty(t, listeners)
}

// leaderAwareMockServer is a mock server that supports toggling leader state
// and firing leader-change listeners, allowing lifecycle tests to simulate
// HA cluster leader transitions.
type leaderAwareMockServer struct {
	remotes  []*model.RemoteCluster
	logger   *mlog.Logger
	isLeader atomic.Bool

	mux       sync.Mutex
	listeners map[string]func()
}

func newLeaderAwareMockServer(t *testing.T, remotes []*model.RemoteCluster, leader bool) *leaderAwareMockServer {
	ms := &leaderAwareMockServer{
		remotes:   remotes,
		logger:    mlog.CreateConsoleTestLogger(t),
		listeners: make(map[string]func()),
	}
	ms.isLeader.Store(leader)
	return ms
}

func (ms *leaderAwareMockServer) Config() *model.Config                    { return nil }
func (ms *leaderAwareMockServer) GetMetrics() einterfaces.MetricsInterface { return nil }
func (ms *leaderAwareMockServer) IsLeader() bool                           { return ms.isLeader.Load() }
func (ms *leaderAwareMockServer) Log() *mlog.Logger                        { return ms.logger }

func (ms *leaderAwareMockServer) AddClusterLeaderChangedListener(listener func()) string {
	ms.mux.Lock()
	defer ms.mux.Unlock()
	id := model.NewId()
	ms.listeners[id] = listener
	return id
}

func (ms *leaderAwareMockServer) RemoveClusterLeaderChangedListener(id string) {
	ms.mux.Lock()
	defer ms.mux.Unlock()
	delete(ms.listeners, id)
}

// setLeader changes leader status and fires all registered listeners.
func (ms *leaderAwareMockServer) setLeader(leader bool) {
	ms.isLeader.Store(leader)
	ms.mux.Lock()
	listeners := make([]func(), 0, len(ms.listeners))
	for _, l := range ms.listeners {
		listeners = append(listeners, l)
	}
	ms.mux.Unlock()
	for _, l := range listeners {
		l()
	}
}

func (ms *leaderAwareMockServer) GetStore() store.Store {
	anyQueryFilter := mock.MatchedBy(func(filter model.RemoteClusterQueryFilter) bool {
		return true
	})
	anyId := mock.AnythingOfType("string")

	remoteClusterStoreMock := &mocks.RemoteClusterStore{}
	remoteClusterStoreMock.On("GetByTopic", "share").Return(ms.remotes, nil)
	remoteClusterStoreMock.On("GetAll", 0, 999999, anyQueryFilter).Return(ms.remotes, nil)
	remoteClusterStoreMock.On("SetLastPingAt", anyId).Return(nil)

	storeMock := &mocks.Store{}
	storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)
	return storeMock
}

func TestServiceLifecycle(t *testing.T) {
	t.Run("Active after Start, inactive after Shutdown", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		assert.False(t, service.Active(), "service should not be active before Start")

		err = service.Start()
		require.NoError(t, err)

		assert.True(t, service.Active(), "service should be active after Start")

		err = service.Shutdown()
		require.NoError(t, err)

		assert.False(t, service.Active(), "service should not be active after Shutdown")
	})

	t.Run("Double Start is idempotent", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)

		firstDone := service.done

		// Second Start should be a no-op
		err = service.Start()
		require.NoError(t, err)

		assert.Equal(t, firstDone, service.done, "second Start should not replace done channel")

		require.NoError(t, service.Shutdown())
	})

	t.Run("Shutdown before Start does not panic", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Shutdown()
		require.NoError(t, err)
	})

	t.Run("Active on non-leader node", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		assert.True(t, service.Active(), "service should be active on non-leader node")
	})
}

func TestSendLoopLifecycle(t *testing.T) {
	t.Run("sendLoop runs on non-leader node", func(t *testing.T) {
		var webReqCount atomic.Int32

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			webReqCount.Add(1)
			w.WriteHeader(200)
			resp := Response{}
			b, _ := json.Marshal(&resp)
			_, _ = w.Write(b)
		}))
		defer ts.Close()

		remotes := makeRemoteClusters(3, ts.URL, false)
		mockServer := newLeaderAwareMockServer(t, remotes, false) // non-leader
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)
		service.disablePing = true

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// Verify pings are NOT running (non-leader)
		service.mux.RLock()
		pingRunning := service.pingDone != nil
		service.mux.RUnlock()
		assert.False(t, pingRunning, "pings should not be running on non-leader node")

		// Send a message — sendLoop should process it even on non-leader
		msg := makeRemoteClusterMsg(model.NewId(), NoteContent)
		var callbackCount atomic.Int32
		wg := &sync.WaitGroup{}
		wg.Add(3)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		err = service.BroadcastMsg(ctx, msg, func(msg model.RemoteClusterMsg, remote *model.RemoteCluster, resp *Response, err error) {
			defer wg.Done()
			callbackCount.Add(1)
		})
		require.NoError(t, err)

		wg.Wait()

		assert.Equal(t, int32(3), callbackCount.Load(), "all callbacks should fire on non-leader node")
		assert.Equal(t, int32(3), webReqCount.Load(), "all HTTP requests should be made on non-leader node")
	})

	t.Run("sendLoop survives leader transitions", func(t *testing.T) {
		var webReqCount atomic.Int32

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			webReqCount.Add(1)
			w.WriteHeader(200)
			resp := Response{}
			b, _ := json.Marshal(&resp)
			_, _ = w.Write(b)
		}))
		defer ts.Close()

		remotes := makeRemoteClusters(3, ts.URL, false)
		mockServer := newLeaderAwareMockServer(t, remotes, true) // start as leader
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)
		service.disablePing = true

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// Lose leadership
		mockServer.setLeader(false)

		// Send a message — should still work after losing leadership
		msg := makeRemoteClusterMsg(model.NewId(), NoteContent)
		wg := &sync.WaitGroup{}
		wg.Add(3)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		err = service.BroadcastMsg(ctx, msg, func(msg model.RemoteClusterMsg, remote *model.RemoteCluster, resp *Response, err error) {
			defer wg.Done()
		})
		require.NoError(t, err)

		wg.Wait()

		assert.Equal(t, int32(3), webReqCount.Load(), "sends should work after losing leadership")
	})
}

func TestPingLifecycle(t *testing.T) {
	t.Run("pings start on leader, stop on non-leader", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// Non-leader: pings should not be running
		service.mux.RLock()
		assert.Nil(t, service.pingDone, "pingDone should be nil on non-leader")
		service.mux.RUnlock()

		// Become leader: pings should start
		mockServer.setLeader(true)

		service.mux.RLock()
		assert.NotNil(t, service.pingDone, "pingDone should be set after becoming leader")
		service.mux.RUnlock()

		// Lose leadership: pings should stop
		mockServer.setLeader(false)

		service.mux.RLock()
		assert.Nil(t, service.pingDone, "pingDone should be nil after losing leadership")
		service.mux.RUnlock()
	})

	t.Run("pingStart is idempotent", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, true)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// pingDone should already be set (started as leader)
		service.mux.RLock()
		firstPingDone := service.pingDone
		service.mux.RUnlock()
		require.NotNil(t, firstPingDone)

		// Call pingStart again — should be a no-op, same channel
		service.pingStart()

		service.mux.RLock()
		secondPingDone := service.pingDone
		service.mux.RUnlock()

		assert.Equal(t, firstPingDone, secondPingDone, "pingStart should be idempotent")
	})

	t.Run("pingStop is idempotent", func(t *testing.T) {
		mockServer := newLeaderAwareMockServer(t, nil, false)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// Already non-leader, pingDone is nil
		service.mux.RLock()
		assert.Nil(t, service.pingDone)
		service.mux.RUnlock()

		// Calling pingStop again should not panic
		service.pingStop()

		service.mux.RLock()
		assert.Nil(t, service.pingDone)
		service.mux.RUnlock()
	})

	t.Run("pings fire on leader with real ping loop", func(t *testing.T) {
		var pingCount atomic.Int32

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			pingCount.Add(1)
			w.WriteHeader(200)
			resp := model.RemoteClusterPing{}
			b, _ := json.Marshal(&resp)
			_, _ = w.Write(b)
		}))
		defer ts.Close()

		remotes := makeRemoteClusters(2, ts.URL, false)
		mockServer := newLeaderAwareMockServer(t, remotes, false) // start as non-leader
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)
		service.SetPingFreq(time.Millisecond * 50)

		err = service.Start()
		require.NoError(t, err)
		defer func() { require.NoError(t, service.Shutdown()) }()

		// Non-leader: no pings should be sent
		assert.Never(t, func() bool {
			return pingCount.Load() > 0
		}, time.Millisecond*200, time.Millisecond*50, "no pings should fire on non-leader")

		// Become leader: pings should start firing
		mockServer.setLeader(true)

		assert.Eventually(t, func() bool {
			return pingCount.Load() >= 2
		}, time.Second*5, time.Millisecond*50, "pings should fire after becoming leader")

		// Lose leadership: pings should stop
		mockServer.setLeader(false)

		// Allow in-flight pings to drain, then verify no new pings arrive
		assert.Eventually(t, func() bool {
			snapshot := pingCount.Load()
			time.Sleep(time.Millisecond * 150)
			return pingCount.Load() == snapshot
		}, time.Second*5, time.Millisecond*50, "no new pings should fire after losing leadership")
	})
}
