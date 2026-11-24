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
	"github.com/mattermost/mattermost/server/public/shared/request"
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
		mockServer.On("GetCluster").Return(nil)
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

		scs.doSync(nil)

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
// records NotifySyncFailed calls. By default its SendMsg simulates an unreachable remote
// (delivery failure reported via the callback); set cbResp/cbErr to instead deliver a
// specific response envelope (e.g. an unparseable or empty payload with no transport error).
type mockRCSForSync struct {
	mu          sync.Mutex
	notifyCalls []string

	cbConfigured bool
	cbResp       *remotecluster.Response
	cbErr        error

	enqueueErr error // when set, SendMsg returns this WITHOUT invoking the callback

	sent []model.RemoteClusterMsg
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
	m.mu.Lock()
	m.sent = append(m.sent, msg)
	m.mu.Unlock()
	// Simulate an enqueue failure (e.g. BufferFullError): the callback never runs.
	if m.enqueueErr != nil {
		return m.enqueueErr
	}
	// The enqueue succeeds (return nil); the outcome is reported asynchronously via the
	// callback, mirroring how remotecluster.Service.sendMsg surfaces a send result.
	if f != nil {
		if m.cbConfigured {
			f(msg, rc, m.cbResp, m.cbErr)
		} else {
			// Default: simulate an unreachable remote (transport error).
			f(msg, rc, &remotecluster.Response{Err: "remote unreachable"}, errors.New("remote unreachable"))
		}
	}
	return nil
}
func (m *mockRCSForSync) SendFile(_ context.Context, _ *model.UploadSession, _ *model.FileInfo, _ *model.RemoteCluster, _ remotecluster.ReaderProvider, _ remotecluster.SendFileResultFunc) error {
	return errors.New("remote unreachable")
}
func (m *mockRCSForSync) SendProfileImage(_ context.Context, _ string, _ *model.RemoteCluster, _ remotecluster.ProfileImageProvider, _ remotecluster.SendProfileImageResultFunc) error {
	return errors.New("remote unreachable")
}
func (m *mockRCSForSync) AcceptInvitation(_ *model.RemoteClusterInvite, _, _, _, _, _ string) (*model.RemoteCluster, *model.AppError) {
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
	mockServer.On("GetCluster").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(nil) // nil rcs causes syncForRemote to fail immediately

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	task := newSyncTask(channelID, "", remoteID, nil, nil)
	scs.addTask(task)

	before := time.Now()
	scs.doSync(nil)

	scs.mux.RLock()
	tasksCopy := make(map[string]syncTask, len(scs.tasks))
	maps.Copy(tasksCopy, scs.tasks)
	scs.mux.RUnlock()

	require.Len(t, tasksCopy, 1, "failed task should be re-enqueued for retry")
	for _, retried := range tasksCopy {
		assert.Equal(t, 1, retried.retryCount, "retry count should be 1 after first failure")
		assert.True(t, retried.schedule.After(before.Add(SyncRetryDelay)),
			"re-enqueued task schedule should be at least SyncRetryDelay in the future (got %s, want after %s)",
			retried.schedule, before.Add(SyncRetryDelay))
	}
}

// TestProcessTask_FanOutRetryPerRemote verifies that when a task with no specific remote
// fans out to several remotes and each fails, every remote keeps its own retry task (rather
// than all but one being discarded by addTask's merge on the shared task id).
func TestProcessTask_FanOutRetryPerRemote(t *testing.T) {
	channelID := model.NewId()
	rcA := &model.RemoteCluster{RemoteId: model.NewId(), DisplayName: "remote-A"}
	rcB := &model.RemoteCluster{RemoteId: model.NewId(), DisplayName: "remote-B"}

	rcStoreMock := &mocks.RemoteClusterStore{}
	// Both the in-channel and auto-invited lookups return the two remotes; remotesMap dedups.
	rcStoreMock.On("GetAll", 0, 999999, mock.Anything).Return([]*model.RemoteCluster{rcA, rcB}, nil)

	mockStore := &mocks.Store{}
	mockStore.On("RemoteCluster").Return(rcStoreMock)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("GetCluster").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(nil) // nil rcs makes syncForRemote fail for each remote

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	// Fan-out task: empty remoteID.
	scs.addTask(newSyncTask(channelID, "", "", nil, nil))

	scs.doSync(nil)

	scs.mux.RLock()
	tasksCopy := make(map[string]syncTask, len(scs.tasks))
	maps.Copy(tasksCopy, scs.tasks)
	scs.mux.RUnlock()

	require.Len(t, tasksCopy, 2, "each failed remote should retain its own retry task")
	gotRemotes := make(map[string]bool)
	for _, retried := range tasksCopy {
		assert.Equal(t, 1, retried.retryCount, "retry count should be 1 after first failure")
		gotRemotes[retried.remoteID] = true
	}
	assert.True(t, gotRemotes[rcA.RemoteId], "remote A should have its own retry task")
	assert.True(t, gotRemotes[rcB.RemoteId], "remote B should have its own retry task")
}

// TestSendSyncMsgToRemote_NotifiesOnDeliveryFailure guards the offline-recovery fix: when a
// send fails asynchronously (remote unreachable), sendSyncMsgToRemote does NOT surface an
// error to the caller — the send is fire-and-forget and the cursor is left un-advanced — but
// it signals the remote cluster service via NotifySyncFailed so the next successful ping
// drives a ForceSyncForRemote recovery.
func TestSendSyncMsgToRemote_NotifiesOnDeliveryFailure(t *testing.T) {
	mockRCS := &mockRCSForSync{}

	mockServer := &MockServerIface{}
	mockServer.On("GetRemoteClusterService").Return(mockRCS)
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

	scs := &Service{
		server:       mockServer,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}

	remoteID := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteID, Name: "test-remote", SiteURL: "http://example.invalid"}
	msg := model.NewSyncMsg(model.NewId())

	var callbackInvoked bool
	err := scs.sendSyncMsgToRemote(msg, rc, func(model.SyncResponse, error) { callbackInvoked = true })

	require.NoError(t, err, "a delivery failure must not be surfaced as an error; the send is fire-and-forget")
	assert.False(t, callbackInvoked, "the result callback must not run on a delivery failure, so the cursor stays un-advanced")

	mockRCS.mu.Lock()
	notifyCalls := mockRCS.notifyCalls
	mockRCS.mu.Unlock()
	require.Len(t, notifyCalls, 1, "NotifySyncFailed should be called once on delivery failure")
	assert.Equal(t, remoteID, notifyCalls[0])
}

// TestSendSyncMsgToRemote_NotifiesOnUnconfirmedResponse covers the case where the send
// succeeds at the transport level (no errResp) but the response envelope can't be treated
// as a confirmed sync: an unparseable payload, or an empty payload (the receive side always
// sets a SyncResponse payload on success). In both cases sendSyncMsgToRemote must not error,
// must not advance the cursor, and must signal NotifySyncFailed for a ping-driven resync.
func TestSendSyncMsgToRemote_NotifiesOnUnconfirmedResponse(t *testing.T) {
	cases := []struct {
		name string
		resp *remotecluster.Response
	}{
		{name: "unparseable payload", resp: &remotecluster.Response{Status: model.StatusOk, Payload: []byte("not json")}},
		{name: "empty payload", resp: &remotecluster.Response{Status: model.StatusOk}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mockRCS := &mockRCSForSync{cbConfigured: true, cbResp: tc.resp, cbErr: nil}

			mockServer := &MockServerIface{}
			mockServer.On("GetRemoteClusterService").Return(mockRCS)
			mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

			scs := &Service{
				server:       mockServer,
				changeSignal: make(chan struct{}, 1),
				tasks:        make(map[string]syncTask),
			}

			remoteID := model.NewId()
			rc := &model.RemoteCluster{RemoteId: remoteID, Name: "test-remote", SiteURL: "http://example.invalid"}
			msg := model.NewSyncMsg(model.NewId())

			var callbackInvoked bool
			err := scs.sendSyncMsgToRemote(msg, rc, func(model.SyncResponse, error) { callbackInvoked = true })

			require.NoError(t, err, "an unconfirmed response must not be surfaced as an error")
			assert.False(t, callbackInvoked, "the result callback must not run for an unconfirmed response, so the cursor stays un-advanced")

			mockRCS.mu.Lock()
			notifyCalls := mockRCS.notifyCalls
			mockRCS.mu.Unlock()
			require.Len(t, notifyCalls, 1, "NotifySyncFailed should be called once for an unconfirmed response")
			assert.Equal(t, remoteID, notifyCalls[0])
		})
	}
}

// TestSendSyncMsgToRemote_EnqueueErrorDoesNotHang verifies that when SendMsg fails to enqueue
// (e.g. BufferFullError) — so the result callback never runs — sendSyncMsgToRemote returns the
// error instead of blocking forever on the callback's WaitGroup, which would freeze the single
// doSync goroutine and stall all shared-channel sync.
func TestSendSyncMsgToRemote_EnqueueErrorDoesNotHang(t *testing.T) {
	mockRCS := &mockRCSForSync{enqueueErr: errors.New("buffer full")}

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

	// Guard with a timeout so a regression (hang on wg.Wait) fails fast instead of blocking
	// the whole suite until the test binary times out.
	done := make(chan error, 1)
	go func() { done <- scs.sendSyncMsgToRemote(msg, rc, nil) }()

	select {
	case err := <-done:
		require.Error(t, err, "an enqueue failure must be returned to the caller")
		assert.ErrorContains(t, err, "buffer full")
	case <-time.After(5 * time.Second):
		require.Fail(t, "sendSyncMsgToRemote hung on wg.Wait() after an enqueue failure")
	}

	// The send never left the queue, so there is no delivery outcome to notify about; that
	// path is the caller's retry (the returned error), not a ping-driven resync.
	mockRCS.mu.Lock()
	notifyCount := len(mockRCS.notifyCalls)
	mockRCS.mu.Unlock()
	assert.Zero(t, notifyCount, "no sync-failed notification should fire when the enqueue itself failed")
}

func TestRemoveOldestTask_CatchUpYieldsToLiveTasks(t *testing.T) {
	t.Run("ready live task is processed before older catch-up tasks", func(t *testing.T) {
		scs := newTestService()
		for _, channelID := range []string{"catchup-1", "catchup-2"} {
			task := newSyncTask(channelID, "", "remote-1", nil, nil)
			task.catchUp = true
			scs.addTask(task)
		}
		time.Sleep(time.Millisecond)
		scs.addTask(newSyncTask("live", "", "remote-1", nil, nil))

		var order []string
		for {
			task, ok, _ := scs.removeOldestTask()
			if !ok {
				break
			}
			order = append(order, task.channelID)
		}

		require.Len(t, order, 3)
		assert.Equal(t, "live", order[0])
		assert.ElementsMatch(t, []string{"catchup-1", "catchup-2"}, order[1:])
	})

	t.Run("catch-up task is processed when no live task is ready", func(t *testing.T) {
		scs := newTestService()
		catchUp := newSyncTask("catchup", "", "remote-1", nil, nil)
		catchUp.catchUp = true
		scs.addTask(catchUp)
		live := newSyncTask("live", "", "remote-1", nil, nil)
		live.schedule = time.Now().Add(time.Hour)
		scs.addTask(live)

		task, ok, wait := scs.removeOldestTask()

		require.True(t, ok)
		assert.Equal(t, "catchup", task.channelID)
		assert.Positive(t, wait, "the delayed live task should still be reported as pending")
	})
}

func TestAddTask_MergeCatchUpFlag(t *testing.T) {
	tests := []struct {
		name          string
		queuedCatchUp bool
		addedCatchUp  bool
		expected      bool
	}{
		{name: "live task merged into catch-up task clears the flag", queuedCatchUp: true, addedCatchUp: false, expected: false},
		{name: "catch-up task merged into live task does not set the flag", queuedCatchUp: false, addedCatchUp: true, expected: false},
		{name: "catch-up task merged into catch-up task keeps the flag", queuedCatchUp: true, addedCatchUp: true, expected: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scs := newTestService()

			queued := newSyncTask("channel-1", "", "remote-1", nil, nil)
			queued.catchUp = tc.queuedCatchUp
			scs.addTask(queued)

			added := newSyncTask("channel-1", "", "remote-1", nil, nil)
			added.catchUp = tc.addedCatchUp
			scs.addTask(added)

			require.Len(t, scs.tasks, 1)
			assert.Equal(t, tc.expected, scs.tasks[queued.id].catchUp)
		})
	}
}

func TestDoSync_CatchUpRetryKeepsFlag(t *testing.T) {
	remoteID := model.NewId()
	rc := &model.RemoteCluster{RemoteId: remoteID, LastPingAt: model.GetMillis()}

	rcStoreMock := &mocks.RemoteClusterStore{}
	rcStoreMock.On("Get", remoteID, false).Return(rc, nil)
	mockStore := &mocks.Store{}
	mockStore.On("RemoteCluster").Return(rcStoreMock)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("GetCluster").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(nil) // nil rcs causes syncForRemote to fail

	scs := newTestService()
	scs.server = mockServer

	task := newSyncTask(model.NewId(), "", remoteID, nil, nil)
	task.catchUp = true
	scs.addTask(task)

	scs.doSync(nil)

	require.Len(t, scs.tasks, 1, "failed task should be re-enqueued for retry")
	for _, retried := range scs.tasks {
		assert.Equal(t, 1, retried.retryCount)
		assert.True(t, retried.catchUp, "retry of a catch-up task should stay a catch-up task")
	}
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

// TestUpdateCursorForRemote_KeepsCursorSetDuringBatch covers a cursor set with
// UpdateSharedChannelCursor while a batch is in flight: the batch's write-back must not
// overwrite it.
func TestUpdateCursorForRemote_KeepsCursorSetDuringBatch(t *testing.T) {
	channelID := model.NewId()
	rc := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		DisplayName: "plugin-remote",
		PluginID:    "com.example.plugin",
		LastPingAt:  model.GetMillis(),
	}
	start := model.GetPostsSinceForSyncCursor{
		LastPostCreateAt: 1000, LastPostCreateID: model.NewId(),
		LastPostUpdateAt: 2000, LastPostUpdateID: model.NewId(),
	}
	next := model.GetPostsSinceForSyncCursor{
		LastPostCreateAt: 3000, LastPostCreateID: model.NewId(),
		LastPostUpdateAt: 4000, LastPostUpdateID: model.NewId(),
	}
	rewind := model.GetPostsSinceForSyncCursor{LastPostCreateAt: 1, LastPostUpdateAt: 1}

	newScr := func() *model.SharedChannelRemote {
		return &model.SharedChannelRemote{
			Id:               model.NewId(),
			ChannelId:        channelID,
			RemoteId:         rc.RemoteId,
			LastPostCreateAt: start.LastPostCreateAt,
			LastPostCreateID: start.LastPostCreateID,
			LastPostUpdateAt: start.LastPostUpdateAt,
			LastPostUpdateID: start.LastPostUpdateID,
			UpdateAt:         1,
		}
	}

	// The stored row is kept in memory; the conditional update mirrors the store's WHERE clause.
	newService := func(t *testing.T, scr *model.SharedChannelRemote, rewindTo *model.GetPostsSinceForSyncCursor) (*Service, func() model.GetPostsSinceForSyncCursor) {
		t.Helper()

		var mu sync.Mutex
		stored := start
		storedUpdateAt := scr.UpdateAt

		scStore := &mocks.SharedChannelStore{}
		scStore.On("GetRemoteByIdsFromMaster", channelID, rc.RemoteId).Return(scr, nil)
		scStore.On("UpdateRemoteCursor", scr.Id, mock.Anything).Return(func(_ string, cursor model.GetPostsSinceForSyncCursor) error {
			mu.Lock()
			defer mu.Unlock()
			stored = cursor
			storedUpdateAt++
			return nil
		})
		scStore.On("UpdateRemoteCursorIfUnchanged", scr.Id, mock.Anything, mock.Anything).Return(
			func(_ string, expectedUpdateAt int64, cursor model.GetPostsSinceForSyncCursor) (bool, error) {
				mu.Lock()
				defer mu.Unlock()
				if storedUpdateAt != expectedUpdateAt {
					return false, nil
				}
				stored = cursor
				storedUpdateAt++
				return true, nil
			})

		mockStore := &mocks.Store{}
		mockStore.On("SharedChannel").Return(scStore)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetMetrics").Return(nil)
		mockServer.On("GetRemoteClusterService").Return(&mockRCSForSync{})
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

		mockApp := &MockAppIface{}
		mockApp.On("OnSharedChannelsSyncMsg", mock.Anything, rc).Run(func(mock.Arguments) {
			if rewindTo != nil {
				require.NoError(t, scStore.UpdateRemoteCursor(scr.Id, *rewindTo))
			}
		}).Return(model.SyncResponse{}, nil)

		scs := &Service{
			server:       mockServer,
			app:          mockApp,
			changeSignal: make(chan struct{}, 1),
			tasks:        make(map[string]syncTask),
		}
		return scs, func() model.GetPostsSinceForSyncCursor {
			mu.Lock()
			defer mu.Unlock()
			return stored
		}
	}

	newBatch := func(scr *model.SharedChannelRemote) *syncData {
		sd := newSyncData(newSyncTask(channelID, "", rc.RemoteId, nil, nil), rc, scr)
		sd.posts = []*model.Post{{Id: model.NewId(), ChannelId: channelID, Message: "hello"}}
		sd.resultNextCursor = next
		return sd
	}

	t.Run("batch advances the cursor when it was not changed", func(t *testing.T) {
		scr := newScr()
		scs, stored := newService(t, scr, nil)

		require.NoError(t, scs.sendSyncData(newBatch(scr)))
		assert.Equal(t, next, stored())
	})

	t.Run("rewind made by the plugin hook survives the batch write-back", func(t *testing.T) {
		scr := newScr()
		scs, stored := newService(t, scr, &rewind)

		require.NoError(t, scs.sendSyncData(newBatch(scr)))
		assert.Equal(t, rewind, stored())
	})

	t.Run("rewind to the batch's starting cursor survives the write-back", func(t *testing.T) {
		scr := newScr()
		scs, stored := newService(t, scr, &start)

		require.NoError(t, scs.sendSyncData(newBatch(scr)))
		assert.Equal(t, start, stored())
	})

	t.Run("rewind made before a batch with no posts survives the write-back", func(t *testing.T) {
		scr := newScr()
		scs, stored := newService(t, scr, nil)
		sd := newBatch(scr)
		sd.posts = nil

		require.NoError(t, scs.server.GetStore().SharedChannel().UpdateRemoteCursor(scr.Id, rewind))
		require.NoError(t, scs.sendSyncData(sd))
		assert.Equal(t, rewind, stored())
	})

	t.Run("rewind made during a post retry survives the write-back", func(t *testing.T) {
		scr := newScr()
		scs, stored := newService(t, scr, &rewind)
		retryMsg := model.NewSyncMsg(channelID)
		retryMsg.Posts = []*model.Post{{Id: model.NewId(), ChannelId: channelID, Message: "hello"}}

		require.NoError(t, scs.syncForRemote(newSyncTask(channelID, "", rc.RemoteId, nil, retryMsg), rc))
		assert.Equal(t, rewind, stored())
	})
}

func TestFilterPostsForSync(t *testing.T) {
	mockServer := &MockServerIface{}
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
	scs := &Service{server: mockServer}

	rc := &model.RemoteCluster{RemoteId: model.NewId()}
	scr := &model.SharedChannelRemote{LastPostUpdateAt: 1000}
	sd := newSyncData(syncTask{channelID: model.NewId()}, rc, scr)

	editedID := model.NewId()
	newID := model.NewId()
	sd.posts = []*model.Post{
		{Id: editedID, Message: "edited", CreateAt: 100, EditAt: 500, UpdateAt: 2000},
		{Id: model.NewId(), Message: "original", CreateAt: 100, UpdateAt: 500, DeleteAt: 500, OriginalId: editedID},
		{Id: newID, Message: "new", CreateAt: 1500, UpdateAt: 1500},
		{Id: model.NewId(), Message: "from remote", CreateAt: 1500, UpdateAt: 1500, RemoteId: model.NewPointer(rc.RemoteId)},
	}

	scs.filterPostsForSync(sd)

	ids := make([]string, 0, len(sd.posts))
	for _, p := range sd.posts {
		ids = append(ids, p.Id)
	}
	assert.Equal(t, []string{editedID, newID}, ids)
}

func TestFetchReactionsAndAcknowledgementsForSync(t *testing.T) {
	remoteID := model.NewId()
	postID := model.NewId()

	reactions := []*model.Reaction{
		{UserId: model.NewId(), PostId: postID, EmojiName: "smile", CreateAt: 100, UpdateAt: 100},
		{UserId: model.NewId(), PostId: postID, EmojiName: "sad", CreateAt: 200, UpdateAt: 300, DeleteAt: 300},
	}
	acks := []*model.PostAcknowledgement{
		{UserId: model.NewId(), PostId: postID, AcknowledgedAt: 100},
		{UserId: model.NewId(), PostId: postID, AcknowledgedAt: 0},
	}

	mockReactionStore := &mocks.ReactionStore{}
	mockReactionStore.On("GetForPostSince", postID, int64(0), remoteID, true).Return(reactions, nil)
	mockAckStore := &mocks.PostAcknowledgementStore{}
	mockAckStore.On("GetForPostSince", postID, int64(0), remoteID, true).Return(acks, nil)

	mockStore := &mocks.Store{}
	mockStore.On("Reaction").Return(mockReactionStore)
	mockStore.On("PostAcknowledgement").Return(mockAckStore)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	scs := &Service{server: mockServer}

	rc := &model.RemoteCluster{RemoteId: remoteID}
	scr := &model.SharedChannelRemote{LastPostUpdateAt: 5000}
	sd := newSyncData(syncTask{channelID: model.NewId()}, rc, scr)
	sd.posts = []*model.Post{{Id: postID, CreateAt: 50, UpdateAt: 6000}}

	require.NoError(t, scs.fetchReactionsForSync(sd))
	require.NoError(t, scs.fetchAcknowledgementsForSync(sd))

	assert.Equal(t, reactions, sd.reactions)
	assert.Equal(t, acks, sd.acknowledgements)
	mockReactionStore.AssertExpectations(t)
	mockAckStore.AssertExpectations(t)
}

func TestFetchPostsForSync_Repeat(t *testing.T) {
	const maxPosts = 10

	makePosts := func(n int) []*model.Post {
		posts := make([]*model.Post, n)
		for i := range posts {
			posts[i] = &model.Post{Id: model.NewId(), CreateAt: int64(1000 + i), UpdateAt: int64(1000 + i)}
		}
		return posts
	}
	newPosts := makePosts(3)
	updatedPosts := makePosts(5)
	burst := makePosts(6)

	tests := []struct {
		name       string
		newPosts   []*model.Post
		updated    []*model.Post // nil when the updated-posts query must not run
		wantPosts  int
		wantRepeat bool
	}{
		{
			// The updated-posts query also returns posts created after the cursor.
			name:       "full updated page that repeats new posts",
			newPosts:   newPosts,
			updated:    append([]*model.Post{newPosts[0], newPosts[1]}, updatedPosts...),
			wantPosts:  len(newPosts) + len(updatedPosts),
			wantRepeat: true,
		},
		{
			name:       "partial updated page",
			newPosts:   newPosts,
			updated:    updatedPosts[:4],
			wantPosts:  len(newPosts) + 4,
			wantRepeat: false,
		},
		{
			name:       "full updated page of only new posts",
			newPosts:   burst,
			updated:    burst[:maxPosts-len(burst)],
			wantPosts:  len(burst),
			wantRepeat: true,
		},
		{
			name:       "full new page",
			newPosts:   makePosts(maxPosts),
			wantPosts:  maxPosts,
			wantRepeat: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			last := tt.newPosts[len(tt.newPosts)-1]
			createdCursor := model.GetPostsSinceForSyncCursor{LastPostCreateAt: last.CreateAt, LastPostCreateID: last.Id}
			wantCursor := createdCursor

			mockPostStore := &mocks.PostStore{}
			mockPostStore.On("GetPostsSinceForSync",
				mock.MatchedBy(func(o model.GetPostsSinceForSyncOptions) bool { return o.SinceCreateAt }),
				mock.Anything, maxPosts).Return(tt.newPosts, createdCursor, nil)
			if tt.updated != nil {
				updatedCursor := createdCursor
				updatedCursor.LastPostUpdateAt = 2000
				updatedCursor.LastPostUpdateID = model.NewId()
				mockPostStore.On("GetPostsSinceForSync",
					mock.MatchedBy(func(o model.GetPostsSinceForSyncOptions) bool { return !o.SinceCreateAt }),
					createdCursor, maxPosts-len(tt.newPosts)).Return(tt.updated, updatedCursor, nil)
				wantCursor = updatedCursor
			}

			mockStore := &mocks.Store{}
			mockStore.On("Post").Return(mockPostStore)

			cfg := &model.Config{}
			cfg.SetDefaults()
			cfg.ConnectedWorkspacesSettings.MaxPostsPerSync = model.NewPointer(maxPosts)

			mockServer := &MockServerIface{}
			mockServer.On("GetStore").Return(mockStore)
			mockServer.On("GetMetrics").Return(nil)
			mockServer.On("Config").Return(cfg)
			mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

			mockApp := &MockAppIface{}
			mockApp.On("PreparePostForClient", mock.Anything, mock.Anything, mock.Anything).
				Return(func(_ request.CTX, p *model.Post, _ *model.PreparePostForClientOpts) *model.Post { return p })

			scs := &Service{server: mockServer, app: mockApp}
			sd := newSyncData(syncTask{channelID: model.NewId()}, &model.RemoteCluster{RemoteId: model.NewId()}, &model.SharedChannelRemote{})

			require.NoError(t, scs.fetchPostsForSync(sd))

			assert.Len(t, sd.posts, tt.wantPosts)
			assert.Equal(t, tt.wantRepeat, sd.resultRepeat)
			assert.Equal(t, wantCursor, sd.resultNextCursor)
			mockPostStore.AssertExpectations(t)
		})
	}
}
