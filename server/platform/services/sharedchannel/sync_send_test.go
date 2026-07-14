// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"maps"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func newTestService() *Service {
	return &Service{
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
}

func TestProcessTask_RemoteClusterLookup(t *testing.T) {
	// Mirror how the store wraps the not-found case for a soft-deleted/missing remote.
	notFound := fmt.Errorf("failed to find RemoteCluster: %w", sql.ErrNoRows)

	newService := func(t *testing.T, remoteID string, rc *model.RemoteCluster, getErr error) (*Service, *mocks.SharedChannelStore) {
		t.Helper()

		mockRemoteClusterStore := &mocks.RemoteClusterStore{}
		mockRemoteClusterStore.On("Get", remoteID, false).Return(rc, getErr)

		mockSharedChannelStore := &mocks.SharedChannelStore{}

		mockStore := &mocks.Store{}
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetMetrics").Return(nil)
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

		return &Service{
			server:       mockServer,
			changeSignal: make(chan struct{}, 1),
			tasks:        make(map[string]syncTask),
		}, mockSharedChannelStore
	}

	t.Run("orphaned remote self-heals by soft-deleting the live SCR row", func(t *testing.T) {
		channelID := model.NewId()
		remoteID := model.NewId()
		scr := &model.SharedChannelRemote{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID, DeleteAt: 0}

		scs, scStore := newService(t, remoteID, nil, notFound)
		scStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil)
		scStore.On("DeleteRemote", scr.Id).Return(true, nil)

		err := scs.processTask(newSyncTask(channelID, "", remoteID, nil, nil))

		require.NoError(t, err, "an orphaned remote should be skipped, not surfaced as an error")
		scStore.AssertNumberOfCalls(t, "DeleteRemote", 1)
		scStore.AssertCalled(t, "DeleteRemote", scr.Id)
	})

	t.Run("self-healed orphan is drained from the sync queue and not retried", func(t *testing.T) {
		channelID := model.NewId()
		remoteID := model.NewId()
		scr := &model.SharedChannelRemote{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID, DeleteAt: 0}

		scs, scStore := newService(t, remoteID, nil, notFound)
		scStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil)
		scStore.On("DeleteRemote", scr.Id).Return(true, nil)

		task := newSyncTask(channelID, "", remoteID, nil, nil)
		scs.addTask(task)

		scs.doSync()

		assert.Empty(t, scs.tasks, "the orphaned task must be drained, not re-enqueued for retry")
		scStore.AssertNumberOfCalls(t, "DeleteRemote", 1)
	})

	t.Run("already soft-deleted SCR row is not deleted again", func(t *testing.T) {
		channelID := model.NewId()
		remoteID := model.NewId()
		scr := &model.SharedChannelRemote{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID, DeleteAt: model.GetMillis()}

		scs, scStore := newService(t, remoteID, nil, notFound)
		scStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil)

		err := scs.processTask(newSyncTask(channelID, "", remoteID, nil, nil))

		require.NoError(t, err)
		scStore.AssertNotCalled(t, "DeleteRemote", mock.Anything)
	})

	t.Run("missing SCR row is skipped without error or delete", func(t *testing.T) {
		channelID := model.NewId()
		remoteID := model.NewId()

		scs, scStore := newService(t, remoteID, nil, notFound)
		scStore.On("GetRemoteByIds", channelID, remoteID).Return(nil, store.NewErrNotFound("SharedChannelRemote", "missing"))

		err := scs.processTask(newSyncTask(channelID, "", remoteID, nil, nil))

		require.NoError(t, err)
		scStore.AssertNotCalled(t, "DeleteRemote", mock.Anything)
	})

	t.Run("failure to soft-delete the orphan is swallowed without retry", func(t *testing.T) {
		channelID := model.NewId()
		remoteID := model.NewId()
		scr := &model.SharedChannelRemote{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID, DeleteAt: 0}

		scs, scStore := newService(t, remoteID, nil, notFound)
		scStore.On("GetRemoteByIds", channelID, remoteID).Return(scr, nil)
		scStore.On("DeleteRemote", scr.Id).Return(false, errors.New("db is down"))

		err := scs.processTask(newSyncTask(channelID, "", remoteID, nil, nil))

		require.NoError(t, err, "a self-heal delete failure must not surface as a sync error or trigger a retry")
		scStore.AssertCalled(t, "DeleteRemote", scr.Id)
	})

	t.Run("transient error is propagated for retry", func(t *testing.T) {
		remoteID := model.NewId()
		dbErr := errors.New("write tcp: connection reset by peer")
		scs, scStore := newService(t, remoteID, nil, dbErr)

		err := scs.processTask(newSyncTask("channel-1", "", remoteID, nil, nil))

		require.Error(t, err, "a transient lookup error must still be returned so the task retries")
		assert.ErrorContains(t, err, "connection reset by peer")
		scStore.AssertNotCalled(t, "GetRemoteByIds", mock.Anything, mock.Anything)
		scStore.AssertNotCalled(t, "DeleteRemote", mock.Anything)
	})
}

func TestAddTask_OriginRemoteIDMerge(t *testing.T) {
	tests := []struct {
		name           string
		firstOrigin    string
		secondOrigin   string
		expectedOrigin string
	}{
		{
			name:           "same remote origin is preserved",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-A",
			expectedOrigin: "remote-A",
		},
		{
			name:           "local then remote clears origin",
			firstOrigin:    "",
			secondOrigin:   "remote-A",
			expectedOrigin: "",
		},
		{
			name:           "remote then local clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "",
			expectedOrigin: "",
		},
		{
			name:           "different remotes clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-B",
			expectedOrigin: "",
		},
		{
			name:           "both local stays empty",
			firstOrigin:    "",
			secondOrigin:   "",
			expectedOrigin: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scs := newTestService()
			channelID := "channel-1"

			first := newSyncTask(channelID, "", "", nil, nil)
			first.originRemoteID = tc.firstOrigin
			scs.addTask(first)

			second := newSyncTask(channelID, "", "", nil, nil)
			second.originRemoteID = tc.secondOrigin
			scs.addTask(second)

			merged, ok := scs.tasks[first.id]
			require.True(t, ok, "task should exist")
			assert.Equal(t, tc.expectedOrigin, merged.originRemoteID)
		})
	}
}

// mockRCSForSync is a minimal no-op implementation of RemoteClusterServiceIFace that
// records NotifySyncFailed calls for testing retry-exhaustion behaviour.
type mockRCSForSync struct {
	mu          sync.Mutex
	notifyCalls []string
}

func (m *mockRCSForSync) NotifySyncFailed(remoteId string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.notifyCalls = append(m.notifyCalls, remoteId)
}
func (m *mockRCSForSync) Shutdown() error { return nil }
func (m *mockRCSForSync) Start() error    { return nil }
func (m *mockRCSForSync) Active() bool    { return true }
func (m *mockRCSForSync) AddTopicListener(topic string, listener remotecluster.TopicListener) string {
	return ""
}
func (m *mockRCSForSync) RemoveTopicListener(listenerId string) {}
func (m *mockRCSForSync) AddConnectionStateListener(listener remotecluster.ConnectionStateListener) string {
	return ""
}
func (m *mockRCSForSync) RemoveConnectionStateListener(listenerId string) {}
func (m *mockRCSForSync) SendMsg(_ context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, f remotecluster.SendMsgResultFunc) error {
	// Simulate an unreachable remote: the enqueue succeeds (return nil) but the
	// delivery fails and is reported asynchronously via the callback, mirroring how
	// remotecluster.Service.sendMsg surfaces a failed HTTP send.
	if f != nil {
		f(msg, rc, &remotecluster.Response{Err: "remote unreachable"}, errors.New("remote unreachable"))
	}
	return nil
}
func (m *mockRCSForSync) SendFile(_ context.Context, _ *model.UploadSession, _ *model.FileInfo, _ *model.RemoteCluster, _ remotecluster.ReaderProvider, _ remotecluster.SendFileResultFunc) error {
	return errors.New("remote unreachable")
}
func (m *mockRCSForSync) SendProfileImage(_ context.Context, _ string, _ *model.RemoteCluster, _ remotecluster.ProfileImageProvider, _ remotecluster.SendProfileImageResultFunc) error {
	return errors.New("remote unreachable")
}
func (m *mockRCSForSync) AcceptInvitation(_ *model.RemoteClusterInvite, _, _, _, _, _ string) (*model.RemoteCluster, error) {
	return nil, nil
}
func (m *mockRCSForSync) ReceiveIncomingMsg(_ *model.RemoteCluster, _ model.RemoteClusterMsg) remotecluster.Response {
	return remotecluster.Response{}
}
func (m *mockRCSForSync) ReceiveInviteConfirmation(_ model.RemoteClusterInvite) (*model.RemoteCluster, error) {
	return nil, nil
}
func (m *mockRCSForSync) PingNow(_ *model.RemoteCluster) {}

var _ remotecluster.RemoteClusterServiceIFace = (*mockRCSForSync)(nil)

// TestProcessTask_RetryDelay verifies that a failed per-remote sync re-enqueues the task
// with a schedule at least SyncRetryDelay in the future.
func TestProcessTask_RetryDelay(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()

	rc := &model.RemoteCluster{
		RemoteId:    remoteID,
		DisplayName: "test-remote",
		LastPingAt:  model.GetMillis(), // online
	}

	rcStoreMock := &mocks.RemoteClusterStore{}
	rcStoreMock.On("Get", remoteID, false).Return(rc, nil)

	mockStore := &mocks.Store{}
	mockStore.On("RemoteCluster").Return(rcStoreMock)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(nil) // nil rcs causes syncForRemote to fail immediately

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	task := newSyncTask(channelID, "", remoteID, nil, nil)
	scs.addTask(task)

	before := time.Now()
	scs.doSync()

	scs.mux.RLock()
	tasksCopy := make(map[string]syncTask, len(scs.tasks))
	maps.Copy(tasksCopy, scs.tasks)
	scs.mux.RUnlock()

	require.Len(t, tasksCopy, 1, "failed task should be re-enqueued for retry")
	for _, retried := range tasksCopy {
		assert.Equal(t, 1, retried.retryCount, "retry count should be 1 after first failure")
		assert.True(t, retried.schedule.After(before.Add(SyncRetryDelay-time.Second)),
			"re-enqueued task schedule should be at least SyncRetryDelay in the future (got %s, want after %s)",
			retried.schedule, before.Add(SyncRetryDelay))
	}
}

// TestProcessTask_NotifySyncFailedOnRetryExhaustion verifies that when per-remote retries
// are exhausted, NotifySyncFailed is called on the remote cluster service.
func TestProcessTask_NotifySyncFailedOnRetryExhaustion(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()

	rc := &model.RemoteCluster{
		RemoteId:    remoteID,
		DisplayName: "test-remote",
		LastPingAt:  model.GetMillis(), // online
	}

	mockRCS := &mockRCSForSync{}

	rcStoreMock := &mocks.RemoteClusterStore{}
	rcStoreMock.On("Get", remoteID, false).Return(rc, nil)

	scStoreMock := &mocks.SharedChannelStore{}
	scStoreMock.On("GetRemoteByIds", channelID, remoteID).Return(nil, errors.New("db error"))

	mockStore := &mocks.Store{}
	mockStore.On("RemoteCluster").Return(rcStoreMock)
	mockStore.On("SharedChannel").Return(scStoreMock)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(mockRCS)
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	task := newSyncTask(channelID, "", remoteID, nil, nil)
	task.retryCount = MaxRetries // next incRetry() returns false → exhaustion path
	scs.addTask(task)

	scs.doSync()

	// Task must be drained (not re-enqueued) after retry exhaustion.
	scs.mux.RLock()
	taskCount := len(scs.tasks)
	scs.mux.RUnlock()
	assert.Equal(t, 0, taskCount, "exhausted task should not be re-enqueued")

	// NotifySyncFailed must have been called exactly once with the correct remoteId so
	// the next successful ping triggers a full ForceSyncForRemote recovery.
	mockRCS.mu.Lock()
	notifyCalls := mockRCS.notifyCalls
	mockRCS.mu.Unlock()
	require.Len(t, notifyCalls, 1, "NotifySyncFailed should be called exactly once")
	assert.Equal(t, remoteID, notifyCalls[0])
}

// TestSendSyncMsgToRemote_PropagatesDeliveryFailure guards the fix for the offline-recovery
// bug: a send that fails asynchronously (remote unreachable) is reported via the callback and
// must propagate out of sendSyncMsgToRemote so the caller retries and, on exhaustion, calls
// NotifySyncFailed. Before the fix the callback error was silently discarded and the send
// appeared to succeed.
func TestSendSyncMsgToRemote_PropagatesDeliveryFailure(t *testing.T) {
	mockRCS := &mockRCSForSync{}

	mockServer := &MockServerIface{}
	mockServer.On("GetRemoteClusterService").Return(mockRCS)
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	rc := &model.RemoteCluster{RemoteId: model.NewId(), Name: "test-remote", SiteURL: "http://example.invalid"}
	msg := model.NewSyncMsg(model.NewId())

	err := scs.sendSyncMsgToRemote(msg, rc, nil)

	require.Error(t, err, "a delivery failure reported via the callback must propagate to the caller")
	assert.ErrorContains(t, err, "remote unreachable")
}

func TestStripSharedChannelStatePostsForSync(t *testing.T) {
	sd := &syncData{
		posts: []*model.Post{
			{Id: "state-1", Type: model.PostTypeSharedChannelState, ChannelId: "ch1", Message: "ignored"},
			{Id: "user-1", Type: model.PostTypeDefault, ChannelId: "ch1", Message: "hello"},
		},
	}

	stripSharedChannelStatePostsForSync(sd)

	require.Len(t, sd.posts, 1)
	assert.Equal(t, "user-1", sd.posts[0].Id)
	assert.Equal(t, model.PostTypeDefault, sd.posts[0].Type)
}
