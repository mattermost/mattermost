// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

const (
	Recent = 60000
)

func TestPing(t *testing.T) {
	t.Run("No error", func(t *testing.T) {
		merr := merror.New()

		var remotes []*model.RemoteCluster
		pingsReceived := make(map[string]struct{})
		var mux sync.Mutex

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer w.WriteHeader(200)

			var frame model.RemoteClusterFrame
			err := json.NewDecoder(r.Body).Decode(&frame)
			if err != nil {
				merr.Append(err)
				return
			}
			if len(frame.Msg.Payload) == 0 {
				merr.Append(fmt.Errorf("Payload should not be empty; remote_id=%s", frame.RemoteId))
				return
			}

			// Make sure ping is from a remote that was added for this test.
			if !hasRemoteID(frame.RemoteId, remotes) {
				merr.Append(fmt.Errorf("RemoteID not in list of remotes for this test; remote_id=%s", frame.RemoteId))
				return
			}

			var ping model.RemoteClusterPing
			err = json.Unmarshal(frame.Msg.Payload, &ping)
			if err != nil {
				merr.Append(err)
				return
			}

			if !checkRecent(ping.SentAt, Recent) {
				merr.Append(fmt.Errorf("timestamp out of range, got %d", ping.SentAt))
				return
			}
			if ping.RecvAt != 0 {
				merr.Append(fmt.Errorf("timestamp should be 0, got %d", ping.RecvAt))
				return
			}

			mux.Lock()
			defer mux.Unlock()
			pingsReceived[frame.RemoteId] = struct{}{}
		}))
		defer ts.Close()

		remotes = makeRemoteClusters(NumRemotes, ts.URL, false)
		mockServer := newMockServer(t, remotes)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		// wait up to 10 seconds for all remotes to get pinged. This will normally take less than 1 second
		// unless the server is very busy.
		assert.Eventually(t, func() bool {
			mux.Lock()
			defer mux.Unlock()
			return len(pingsReceived) == NumRemotes
		}, time.Second*10, time.Millisecond*50, "all remotes must get pinged")

		assert.NoError(t, merr.ErrorOrNil())
	})

	t.Run("HTTP errors", func(t *testing.T) {
		merr := merror.New()

		var remotes []*model.RemoteCluster
		pingsReceived := make(map[string]struct{})
		var mux sync.Mutex

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var frame model.RemoteClusterFrame
			err := json.NewDecoder(r.Body).Decode(&frame)
			if err != nil {
				merr.Append(err)
			}

			// Make sure ping is from a remote that was added for this test.
			if !hasRemoteID(frame.RemoteId, remotes) {
				merr.Append(fmt.Errorf("RemoteID not in list of remotes for this test; remote_id=%s", frame.RemoteId))
				return
			}

			var ping model.RemoteClusterPing
			err = json.Unmarshal(frame.Msg.Payload, &ping)
			if err != nil {
				merr.Append(err)
			}
			if !checkRecent(ping.SentAt, Recent) {
				merr.Append(fmt.Errorf("timestamp out of range, got %d", ping.SentAt))
			}
			if ping.RecvAt != 0 {
				merr.Append(fmt.Errorf("timestamp should be 0, got %d", ping.RecvAt))
			}

			w.WriteHeader(500)

			mux.Lock()
			defer mux.Unlock()
			pingsReceived[frame.RemoteId] = struct{}{}
		}))
		defer ts.Close()

		remotes = makeRemoteClusters(NumRemotes, ts.URL, false)
		mockServer := newMockServer(t, remotes)
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		// wait up to 10 seconds for all remotes to get pinged. This will normally take less than 1 second
		// until the server is very busy.
		assert.Eventually(t, func() bool {
			mux.Lock()
			defer mux.Unlock()
			return len(pingsReceived) == NumRemotes
		}, time.Second*10, time.Millisecond*50, "all remotes must get pinged")

		assert.NoError(t, merr.ErrorOrNil())
	})

	t.Run("Plugin ping", func(t *testing.T) {
		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, model.NewId(), true))
		offline := []string{mockServer.remotes[0].PluginID, mockServer.remotes[1].PluginID}

		mockApp := newMockApp(t, offline)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		// high ping frequency so we don't delay unit tests.
		service.SetPingFreq(time.Millisecond * 50)

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		checkPingCount := func() bool {
			return mockApp.GetTotalPingCount() >= NumRemotes
		}

		checkErrorCount := func() bool {
			return mockApp.GetTotalPingErrorCount() >= 2
		}

		assert.Eventually(t, checkPingCount, time.Second*5, 10*time.Millisecond)
		assert.Eventually(t, checkErrorCount, time.Second*5, 10*time.Millisecond)
	})
}

// TestPingNow_SyncFailureRecovery verifies that PingNow fires a connection-state-change
// event when a sync failure was recorded since the last ping, even if the remote never
// appeared offline (LastPingAt stayed within the 5-minute window).
func TestPingNow_SyncFailureRecovery(t *testing.T) {
	var listenerCalls int
	var listenerOnline bool
	var listenerMu sync.Mutex

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pong, _ := json.Marshal(model.RemoteClusterPing{SentAt: model.GetMillis(), RecvAt: model.GetMillis()})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(pong)
	}))
	defer ts.Close()

	anyId := mock.AnythingOfType("string")
	rcStoreMock := &mocks.RemoteClusterStore{}
	rcStoreMock.On("SetLastPingAt", anyId).Return(nil)
	storeMock := &mocks.Store{}
	storeMock.On("RemoteCluster").Return(rcStoreMock)

	mockServer := newMockServerWithStore(t, storeMock)
	mockApp := newMockApp(t, nil)

	service, err := NewRemoteClusterService(mockServer, mockApp)
	require.NoError(t, err)

	listenerId := service.AddConnectionStateListener(func(rc *model.RemoteCluster, online bool) {
		listenerMu.Lock()
		defer listenerMu.Unlock()
		listenerCalls++
		listenerOnline = online
	})
	defer service.RemoveConnectionStateListener(listenerId)

	rc := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		DisplayName: "test-remote",
		SiteURL:     ts.URL,
		Token:       model.NewId(),
		RemoteToken: model.NewId(),
		LastPingAt:  model.GetMillis(), // already online — IsOnline() won't flip
	}

	// Simulate a sync failure that occurred since the last ping.
	service.syncFailedSinceLastPing.Store(rc.RemoteId, true)

	service.PingNow(rc)

	listenerMu.Lock()
	calls := listenerCalls
	wasOnline := listenerOnline
	listenerMu.Unlock()

	assert.Equal(t, 1, calls, "connection state listener should fire exactly once on sync failure recovery")
	assert.True(t, wasOnline, "listener should report online=true")

	// Flag must be cleared after a successful ping so subsequent pings don't re-fire.
	val, _ := service.syncFailedSinceLastPing.Load(rc.RemoteId)
	b, _ := val.(bool)
	assert.False(t, b, "syncFailedSinceLastPing should be cleared after successful ping")
}

// TestPingNow_NoSpuriousFire verifies that PingNow does NOT fire a connection-state-change
// event when the remote stays online and no sync failure flag is set.
func TestPingNow_NoSpuriousFire(t *testing.T) {
	var listenerCalls int
	var listenerMu sync.Mutex

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pong, _ := json.Marshal(model.RemoteClusterPing{SentAt: model.GetMillis(), RecvAt: model.GetMillis()})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(pong)
	}))
	defer ts.Close()

	anyId := mock.AnythingOfType("string")
	rcStoreMock := &mocks.RemoteClusterStore{}
	rcStoreMock.On("SetLastPingAt", anyId).Return(nil)
	storeMock := &mocks.Store{}
	storeMock.On("RemoteCluster").Return(rcStoreMock)

	mockServer := newMockServerWithStore(t, storeMock)
	mockApp := newMockApp(t, nil)

	service, err := NewRemoteClusterService(mockServer, mockApp)
	require.NoError(t, err)

	listenerId := service.AddConnectionStateListener(func(rc *model.RemoteCluster, online bool) {
		listenerMu.Lock()
		defer listenerMu.Unlock()
		listenerCalls++
	})
	defer service.RemoveConnectionStateListener(listenerId)

	rc := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		DisplayName: "test-remote",
		SiteURL:     ts.URL,
		Token:       model.NewId(),
		RemoteToken: model.NewId(),
		LastPingAt:  model.GetMillis(), // already online, no sync failure flag set
	}

	service.PingNow(rc)

	listenerMu.Lock()
	calls := listenerCalls
	listenerMu.Unlock()

	assert.Equal(t, 0, calls, "listener must not fire when remote stays online and no sync failure flag is set")
}

func checkRecent(millis int64, within int64) bool {
	now := model.GetMillis()
	return millis > now-within && millis < now+within
}

func hasRemoteID(remoteID string, remotes []*model.RemoteCluster) bool {
	for _, r := range remotes {
		if r.RemoteId == remoteID {
			return true
		}
	}
	return false
}
