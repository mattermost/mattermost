// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"errors"
	"maps"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

type clusterTestNode struct {
	scs      *Service
	isLeader *atomic.Bool
	store    *mocks.Store
	rcStore  *mocks.RemoteClusterStore
	scStore  *mocks.SharedChannelStore
	rcs      *mockRCSForSync

	mu   sync.Mutex
	sent []*model.ClusterMessage
}

func (n *clusterTestNode) sentMessages() []*model.ClusterMessage {
	n.mu.Lock()
	defer n.mu.Unlock()
	return slices.Clone(n.sent)
}

func (n *clusterTestNode) sentTasks(t *testing.T) []clusterSyncTask {
	t.Helper()
	var tasks []clusterSyncTask
	for _, msg := range n.sentMessages() {
		assert.Equal(t, model.ClusterEventSharedChannelSyncTask, msg.Event)
		assert.Equal(t, model.ClusterSendReliable, msg.SendType)
		var data clusterSyncTask
		require.NoError(t, json.Unmarshal(msg.Data, &data))
		tasks = append(tasks, data)
	}
	return tasks
}

func (n *clusterTestNode) queued() map[string]syncTask {
	n.scs.mux.RLock()
	defer n.scs.mux.RUnlock()
	return maps.Clone(n.scs.tasks)
}

func (n *clusterTestNode) held() map[string]syncTask {
	n.scs.mux.RLock()
	defer n.scs.mux.RUnlock()
	return maps.Clone(n.scs.handoffTasks)
}

func (n *clusterTestNode) makeDue() {
	n.scs.mux.Lock()
	defer n.scs.mux.Unlock()
	for id, task := range n.scs.tasks {
		task.schedule = time.Now()
		n.scs.tasks[id] = task
	}
}

func newClusterTestNode(t *testing.T, leader bool) *clusterTestNode {
	t.Helper()
	cfg := &model.Config{}
	cfg.SetDefaults()

	node := &clusterTestNode{
		isLeader: &atomic.Bool{},
		store:    &mocks.Store{},
		rcStore:  &mocks.RemoteClusterStore{},
		scStore:  &mocks.SharedChannelStore{},
		rcs:      &mockRCSForSync{},
	}
	node.isLeader.Store(leader)

	node.store.On("RemoteCluster").Return(node.rcStore)
	node.store.On("SharedChannel").Return(node.scStore)

	cluster := &einterfacesmocks.ClusterInterface{}
	cluster.On("SendClusterMessage", mock.Anything).Run(func(args mock.Arguments) {
		node.mu.Lock()
		defer node.mu.Unlock()
		node.sent = append(node.sent, args.Get(0).(*model.ClusterMessage))
	})

	mockServer := &MockServerIface{}
	mockServer.On("Config").Return(cfg)
	mockServer.On("GetStore").Return(node.store)
	mockServer.On("GetRemoteClusterService").Return(node.rcs)
	mockServer.On("GetCluster").Return(cluster)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("IsLeader").Return(node.isLeader.Load)
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
	mockServer.On("AddClusterLeaderChangedListener", mock.Anything).Return(model.NewId())
	mockServer.On("RemoveClusterLeaderChangedListener", mock.Anything)

	node.scs = newTestService()
	node.scs.server = mockServer
	return node
}

// offlineRemote makes processTask fail for the remote, so the task is retried later instead of synced.
func (n *clusterTestNode) offlineRemote(remoteID string) *mock.Call {
	return n.rcStore.On("Get", remoteID, false).Return(&model.RemoteCluster{RemoteId: remoteID, DisplayName: "remote"}, nil)
}

func clusterTaskMessage(t *testing.T, data clusterSyncTask) *model.ClusterMessage {
	t.Helper()
	b, err := json.Marshal(data)
	require.NoError(t, err)
	return &model.ClusterMessage{Event: model.ClusterEventSharedChannelSyncTask, SendType: model.ClusterSendReliable, Data: b}
}

func TestDoSync_LeaderProcessesTask(t *testing.T) {
	leader := newClusterTestNode(t, true)
	remoteID := model.NewId()
	leader.offlineRemote(remoteID)

	leader.scs.addTask(newSyncTask(model.NewId(), "", remoteID, nil, nil))
	leader.scs.doSync(nil)

	leader.rcStore.AssertNumberOfCalls(t, "Get", 1)
	assert.Empty(t, leader.sentMessages())
}

func TestDoSync_FollowerForwardsTask(t *testing.T) {
	follower := newClusterTestNode(t, false)
	channelID := model.NewId()
	remoteID := model.NewId()

	status := &model.Status{UserId: model.NewId(), Status: model.StatusDnd, Manual: true}
	statusTask := newSyncTask(channelID, status.UserId, remoteID, &model.SyncMsg{Statuses: []*model.Status{status}}, nil)
	statusTask.originRemoteID = model.NewId()

	retryMsg := model.NewSyncMsg(channelID)
	retryMsg.Posts = []*model.Post{{Id: model.NewId(), ChannelId: channelID, Message: "retry me"}}
	retryTask := newSyncTask(channelID, "", remoteID, nil, retryMsg)
	retryTask.retryCount = 2
	retryTask.catchUp = true

	follower.scs.addTask(statusTask)
	follower.scs.addTask(retryTask)
	follower.scs.doSync(nil)

	follower.rcStore.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)
	assert.Empty(t, follower.queued())

	sent := follower.sentTasks(t)
	require.Len(t, sent, 2)
	byID := map[string]clusterSyncTask{}
	for _, data := range sent {
		assert.False(t, data.Handoff)
		byID[data.ID] = data
	}

	gotStatus, ok := byID[statusTask.id]
	require.True(t, ok)
	assert.Equal(t, channelID, gotStatus.ChannelID)
	assert.Equal(t, status.UserId, gotStatus.UserID)
	assert.Equal(t, remoteID, gotStatus.RemoteID)
	assert.Equal(t, statusTask.originRemoteID, gotStatus.OriginRemoteID)
	require.NotNil(t, gotStatus.ExistingMsg)
	require.Len(t, gotStatus.ExistingMsg.Statuses, 1)
	assert.Equal(t, status, gotStatus.ExistingMsg.Statuses[0])

	gotRetry, ok := byID[retryTask.id]
	require.True(t, ok, "the retry task must keep its id")
	assert.Equal(t, 2, gotRetry.RetryCount)
	assert.True(t, gotRetry.CatchUp)
	require.NotNil(t, gotRetry.RetryMsg)
	require.Len(t, gotRetry.RetryMsg.Posts, 1)
	assert.Equal(t, retryMsg.Posts[0].Id, gotRetry.RetryMsg.Posts[0].Id)

	leader := newClusterTestNode(t, true)
	for _, msg := range follower.sentMessages() {
		leader.scs.HandleClusterSyncTask(msg)
	}
	queued := leader.queued()
	require.Len(t, queued, 2)
	assert.Equal(t, statusTask.originRemoteID, queued[statusTask.id].originRemoteID)
	assert.Equal(t, status, queued[statusTask.id].existingMsg.Statuses[0])
	assert.Equal(t, 2, queued[retryTask.id].retryCount)
	assert.True(t, queued[retryTask.id].catchUp)
	assert.Equal(t, retryMsg.Posts[0].Id, queued[retryTask.id].retryMsg.Posts[0].Id)
}

func TestDoSync_FollowerDebouncesBeforeForwarding(t *testing.T) {
	follower := newClusterTestNode(t, false)
	channelID := model.NewId()
	remoteID := model.NewId()
	userID := model.NewId()
	follower.scStore.On("GetUsersForUser", userID).Return([]*model.SharedChannelUser{
		{UserId: userID, RemoteId: remoteID, ChannelId: channelID},
	}, nil)

	follower.scs.NotifyUserStatusChanged(&model.Status{UserId: userID, Status: model.StatusAway})
	follower.scs.NotifyUserStatusChanged(&model.Status{UserId: userID, Status: model.StatusDnd})

	follower.scs.doSync(nil)
	assert.Empty(t, follower.sentMessages(), "tasks wait for NotifyMinimumDelay before they are forwarded")
	require.Len(t, follower.queued(), 1)

	follower.makeDue()
	follower.scs.doSync(nil)

	sent := follower.sentTasks(t)
	require.Len(t, sent, 1)
	require.NotNil(t, sent[0].ExistingMsg)
	assert.Equal(t, model.StatusDnd, sent[0].ExistingMsg.Statuses[0].Status)
}

func TestHandleClusterSyncTask(t *testing.T) {
	channelID := model.NewId()
	task := clusterSyncTask{ID: channelID, ChannelID: channelID}

	t.Run("leader queues a received task", func(t *testing.T) {
		leader := newClusterTestNode(t, true)

		leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, task))

		queued := leader.queued()
		require.Len(t, queued, 1)
		assert.Equal(t, channelID, queued[channelID].channelID)
		assert.Empty(t, leader.sentMessages())
	})

	t.Run("received task merges with a task the leader already queued", func(t *testing.T) {
		leader := newClusterTestNode(t, true)
		leader.scs.NotifyMembershipChanged(channelID, "")

		withOrigin := task
		withOrigin.OriginRemoteID = model.NewId()
		leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, withOrigin))

		queued := leader.queued()
		require.Len(t, queued, 1)
		assert.Empty(t, queued[channelID].originRemoteID, "local and remote origins merged, so the sync must fan out to all remotes")
	})

	t.Run("non-leader neither queues nor forwards a received task", func(t *testing.T) {
		follower := newClusterTestNode(t, false)

		follower.scs.HandleClusterSyncTask(clusterTaskMessage(t, task))
		follower.makeDue()
		follower.scs.doSync(nil)

		assert.Empty(t, follower.queued())
		assert.Empty(t, follower.held(), "only handoff tasks are held")
		assert.Empty(t, follower.sentMessages(), "a received task must never be forwarded again")
	})

	t.Run("invalid tasks are dropped", func(t *testing.T) {
		leader := newClusterTestNode(t, true)

		leader.scs.HandleClusterSyncTask(&model.ClusterMessage{Event: model.ClusterEventSharedChannelSyncTask, Data: []byte("{not json")})
		for _, invalid := range []clusterSyncTask{
			{ChannelID: channelID},
			{ID: "id"},
			{ID: "id", ChannelID: "not-an-id"},
			{ID: "id", RemoteID: "not-an-id"},
			{ID: "id", ChannelID: channelID, OriginRemoteID: "not-an-id"},
			{ID: "id", ChannelID: channelID, RetryCount: MaxRetries + 1},
			{ID: "id", ChannelID: channelID, RetryCount: -1},
		} {
			leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, invalid))
		}

		assert.Empty(t, leader.queued())
	})

	t.Run("global user sync task without a channel is accepted", func(t *testing.T) {
		leader := newClusterTestNode(t, true)
		remoteID := model.NewId()

		leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, clusterSyncTask{ID: "1700000000000" + remoteID, UserID: "1700000000000", RemoteID: remoteID}))

		require.Len(t, leader.queued(), 1)
	})
}

func TestHandleClusterSyncTask_Handoff(t *testing.T) {
	channelID := model.NewId()
	handoff := clusterSyncTask{ID: channelID, ChannelID: channelID, Handoff: true}

	t.Run("non-leader holds a handoff task and queues it when it becomes leader", func(t *testing.T) {
		next := newClusterTestNode(t, false)

		next.scs.HandleClusterSyncTask(clusterTaskMessage(t, handoff))
		assert.Empty(t, next.queued())
		require.Len(t, next.held(), 1)

		next.rcStore.On("GetAll", 0, 999999, mock.Anything).Return(nil, nil)
		next.isLeader.Store(true)
		next.scs.onClusterLeaderChange()
		t.Cleanup(next.scs.pause)

		assert.Len(t, next.queued(), 1)
		assert.Empty(t, next.held())
	})

	t.Run("non-leader drops held tasks when another node becomes leader", func(t *testing.T) {
		follower := newClusterTestNode(t, false)

		follower.scs.HandleClusterSyncTask(clusterTaskMessage(t, handoff))
		require.Len(t, follower.held(), 1)

		follower.scs.onClusterLeaderChange()

		assert.Empty(t, follower.held())
		assert.Empty(t, follower.queued())
	})

	t.Run("expired held tasks are not queued and are pruned", func(t *testing.T) {
		next := newClusterTestNode(t, false)

		next.scs.HandleClusterSyncTask(clusterTaskMessage(t, handoff))
		next.scs.mux.Lock()
		for id, task := range next.scs.handoffTasks {
			task.AddedAt = time.Now().Add(-HandoffTaskTimeout - time.Second)
			next.scs.handoffTasks[id] = task
		}
		next.scs.mux.Unlock()

		other := handoff
		other.ID = model.NewId()
		other.ChannelID = other.ID
		next.scs.HandleClusterSyncTask(clusterTaskMessage(t, other))
		held := next.held()
		require.Len(t, held, 1)
		_, ok := held[other.ID]
		assert.True(t, ok)

		next.scs.mux.Lock()
		for id, task := range next.scs.handoffTasks {
			task.AddedAt = time.Now().Add(-HandoffTaskTimeout - time.Second)
			next.scs.handoffTasks[id] = task
		}
		next.scs.mux.Unlock()

		next.rcStore.On("GetAll", 0, 999999, mock.Anything).Return(nil, nil)
		next.isLeader.Store(true)
		next.scs.onClusterLeaderChange()
		t.Cleanup(next.scs.pause)

		assert.Empty(t, next.queued())
	})
}

func TestDoSync_StopsProcessingWhenLeadershipIsLost(t *testing.T) {
	node := newClusterTestNode(t, true)
	remoteID := model.NewId()
	node.offlineRemote(remoteID).Run(func(mock.Arguments) {
		node.isLeader.Store(false)
	})

	first := newSyncTask(model.NewId(), "", remoteID, nil, nil)
	second := newSyncTask(model.NewId(), "", remoteID, nil, nil)
	node.scs.addTask(first)
	time.Sleep(time.Millisecond)
	node.scs.addTask(second)

	node.scs.doSync(nil)

	node.rcStore.AssertNumberOfCalls(t, "Get", 1)
	sent := node.sentTasks(t)
	require.Len(t, sent, 1, "the remaining backlog must be sent to the new leader")
	assert.Equal(t, second.id, sent[0].ID)

	queued := node.queued()
	require.Len(t, queued, 1, "the failed task is queued for retry")
	retry, ok := queued[first.id]
	require.True(t, ok)
	assert.Equal(t, 1, retry.retryCount)

	node.makeDue()
	node.scs.doSync(nil)
	node.rcStore.AssertNumberOfCalls(t, "Get", 1)
	sent = node.sentTasks(t)
	require.Len(t, sent, 2, "a retry queued by the last task processed as leader is forwarded too")
	assert.Equal(t, first.id, sent[1].ID)
	assert.Equal(t, 1, sent[1].RetryCount)
	assert.Empty(t, node.queued())
}

func TestSyncLoop_FollowerSendsContentChangeToLeader(t *testing.T) {
	follower := newClusterTestNode(t, false)

	require.NoError(t, follower.scs.Start())
	assert.False(t, follower.scs.Active())

	channelID := model.NewId()
	follower.scs.NotifyChannelChanged(channelID)

	require.Eventually(t, func() bool { return len(follower.sentMessages()) == 1 }, 5*time.Second, 20*time.Millisecond)
	sent := follower.sentTasks(t)
	assert.Equal(t, channelID, sent[0].ChannelID)
	assert.False(t, sent[0].Handoff)

	require.NoError(t, follower.scs.Shutdown())
}

func TestShutdown_HandsOffQueuedTasks(t *testing.T) {
	for name, leader := range map[string]bool{"follower": false, "leader": true} {
		t.Run(name, func(t *testing.T) {
			node := newClusterTestNode(t, leader)
			node.rcStore.On("GetAll", 0, 999999, mock.Anything).Return(nil, nil)
			require.NoError(t, node.scs.Start())

			retryMsg := model.NewSyncMsg(model.NewId())
			retryMsg.Posts = []*model.Post{{Id: model.NewId(), ChannelId: retryMsg.ChannelId}}
			retry := newSyncTask(retryMsg.ChannelId, "", model.NewId(), nil, retryMsg)
			retry.retryCount = 1
			retry.schedule = time.Now().Add(SyncRetryDelay)
			node.scs.addTask(retry)
			node.scs.NotifyChannelChanged(model.NewId())

			require.NoError(t, node.scs.Shutdown())

			assert.Empty(t, node.queued())
			sent := node.sentTasks(t)
			require.Len(t, sent, 2)
			for _, data := range sent {
				assert.True(t, data.Handoff)
				if data.ID == retry.id {
					assert.Equal(t, 1, data.RetryCount)
					require.NotNil(t, data.RetryMsg)
				}
			}
		})
	}
}

func TestDoSync_StopsWhenDoneIsClosed(t *testing.T) {
	node := newClusterTestNode(t, true)
	remoteID := model.NewId()
	done := make(chan struct{})
	node.offlineRemote(remoteID).Run(func(mock.Arguments) {
		close(done)
	})

	first := newSyncTask(model.NewId(), "", remoteID, nil, nil)
	second := newSyncTask(model.NewId(), "", remoteID, nil, nil)
	node.scs.addTask(first)
	time.Sleep(time.Millisecond)
	node.scs.addTask(second)

	node.scs.doSync(done)

	node.rcStore.AssertNumberOfCalls(t, "Get", 1)
	queued := node.queued()
	assert.Len(t, queued, 2, "the unprocessed task stays queued, next to the retry of the processed one")
	_, ok := queued[second.id]
	assert.True(t, ok)
	assert.Empty(t, node.sentMessages())
}

func TestHandleClusterSyncTask_AfterShutdown(t *testing.T) {
	channelID := model.NewId()
	forwarded := clusterSyncTask{ID: channelID, ChannelID: channelID}

	leader := newClusterTestNode(t, true)
	leader.rcStore.On("GetAll", 0, 999999, mock.Anything).Return(nil, nil)
	require.NoError(t, leader.scs.Start())
	require.NoError(t, leader.scs.Shutdown())
	require.Empty(t, leader.sentMessages())

	leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, forwarded))
	sent := leader.sentTasks(t)
	require.Len(t, sent, 1, "a leader that stopped its sync loop hands the task to the next leader")
	assert.Equal(t, channelID, sent[0].ID)
	assert.True(t, sent[0].Handoff)
	assert.Empty(t, leader.queued())

	handoff := forwarded
	handoff.Handoff = true
	leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, handoff))
	assert.Len(t, leader.sentMessages(), 1, "a handoff is never sent again")
	assert.Empty(t, leader.queued())
}

func TestDoSync_LeaderSendsStoredStatus(t *testing.T) {
	channelID := model.NewId()
	remoteID := model.NewId()
	userID := model.NewId()
	online := &model.Status{UserId: userID, Status: model.StatusOnline}
	away := &model.Status{UserId: userID, Status: model.StatusAway}

	newLeader := func(t *testing.T) (*clusterTestNode, *mocks.StatusStore) {
		leader := newClusterTestNode(t, true)
		leader.rcStore.On("Get", remoteID, false).Return(&model.RemoteCluster{RemoteId: remoteID, DisplayName: "remote", LastPingAt: model.GetMillis()}, nil)
		leader.scStore.On("GetRemoteByIds", channelID, remoteID).Return(&model.SharedChannelRemote{Id: model.NewId(), ChannelId: channelID, RemoteId: remoteID}, nil)
		statusStore := &mocks.StatusStore{}
		leader.store.On("Status").Return(statusStore)
		return leader, statusStore
	}

	sentStatuses := func(t *testing.T, leader *clusterTestNode) []*model.Status {
		t.Helper()
		leader.rcs.mu.Lock()
		defer leader.rcs.mu.Unlock()
		require.Len(t, leader.rcs.sent, 1)
		var msg model.SyncMsg
		require.NoError(t, json.Unmarshal(leader.rcs.sent[0].Payload, &msg))
		return msg.Statuses
	}

	t.Run("older status forwarded by a follower does not replace the stored status", func(t *testing.T) {
		leader, statusStore := newLeader(t)
		statusStore.On("Get", userID).Return(online, nil)

		task := newSyncTask(channelID, userID, remoteID, &model.SyncMsg{Statuses: []*model.Status{online}}, nil)
		leader.scs.addTask(task)
		leader.scs.HandleClusterSyncTask(clusterTaskMessage(t, clusterSyncTask{
			ID:          task.id,
			ChannelID:   channelID,
			UserID:      userID,
			RemoteID:    remoteID,
			ExistingMsg: &model.SyncMsg{Statuses: []*model.Status{away}},
		}))
		require.Equal(t, model.StatusAway, leader.queued()[task.id].existingMsg.Statuses[0].Status)

		leader.makeDue()
		leader.scs.doSync(nil)

		statuses := sentStatuses(t, leader)
		require.Len(t, statuses, 1)
		assert.Equal(t, model.StatusOnline, statuses[0].Status)
	})

	t.Run("queued status is sent when the store read fails", func(t *testing.T) {
		leader, statusStore := newLeader(t)
		statusStore.On("Get", userID).Return(nil, errors.New("db down"))

		leader.scs.addTask(newSyncTask(channelID, userID, remoteID, &model.SyncMsg{Statuses: []*model.Status{away}}, nil))
		leader.scs.doSync(nil)

		statuses := sentStatuses(t, leader)
		require.Len(t, statuses, 1)
		assert.Equal(t, model.StatusAway, statuses[0].Status)
	})
}
