// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// captureClusterMock records every SendClusterMessage call made during a test
// so the test can assert what was broadcast.
type captureClusterMock struct {
	mu       sync.Mutex
	captured []*model.ClusterMessage
}

func (c *captureClusterMock) SendClusterMessage(msg *model.ClusterMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.captured = append(c.captured, msg)
}

func (c *captureClusterMock) SendClusterMessageToNode(nodeID string, msg *model.ClusterMessage) error {
	return nil
}

func (c *captureClusterMock) snapshot() []*model.ClusterMessage {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]*model.ClusterMessage, len(c.captured))
	copy(out, c.captured)
	return out
}

// reset drops everything captured so far. Call this after TestHelper setup
// completes so the test only sees messages produced by the code under test
// (TestHelper init produces ~1000 unrelated cluster messages).
func (c *captureClusterMock) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.captured = nil
}

func (c *captureClusterMock) StartInterNodeCommunication() {}
func (c *captureClusterMock) StopInterNodeCommunication()  {}
func (c *captureClusterMock) RegisterClusterMessageHandler(event model.ClusterEvent, crm einterfaces.ClusterMessageHandler) {
}
func (c *captureClusterMock) GetClusterId() string                           { return "capture_cluster_mock" }
func (c *captureClusterMock) IsLeader() bool                                 { return false }
func (c *captureClusterMock) GetMyClusterInfo() *model.ClusterInfo           { return nil }
func (c *captureClusterMock) GetClusterInfos() ([]*model.ClusterInfo, error) { return nil, nil }
func (c *captureClusterMock) NotifyMsg(buf []byte)                           {}
func (c *captureClusterMock) GetClusterStats(rctx request.CTX) ([]*model.ClusterStats, *model.AppError) {
	return nil, nil
}
func (c *captureClusterMock) GetLogs(rctx request.CTX, page, perPage int) ([]string, *model.AppError) {
	return nil, nil
}
func (c *captureClusterMock) QueryLogs(rctx request.CTX, page, perPage int) (map[string][]string, *model.AppError) {
	return nil, nil
}
func (c *captureClusterMock) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) (map[string][]model.FileData, error) {
	return nil, nil
}
func (c *captureClusterMock) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	return nil, nil
}
func (c *captureClusterMock) ConfigChanged(previousConfig *model.Config, newConfig *model.Config, sendToOtherServer bool) *model.AppError {
	return nil
}
func (c *captureClusterMock) HealthScore() int { return 0 }
func (c *captureClusterMock) WebConnCountForUser(userID string) (int, *model.AppError) {
	return 0, nil
}
func (c *captureClusterMock) GetWSQueues(userID, connectionID string, seqNum int64) (map[string]*model.WSQueues, error) {
	return nil, nil
}

func TestChannelGuardCacheBroadcastShape(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &captureClusterMock{}
	th := SetupWithClusterMock(t, cluster)
	cluster.reset() // drop init-time noise; only inspect messages from code under test

	th.App.Channels().broadcastChannelGuardInvalidation()

	captured := cluster.snapshot()
	require.Len(t, captured, 1)
	msg := captured[0]
	assert.Equal(t, clusterEventInvalidateChannelGuardCache, msg.Event)
	assert.Equal(t, model.ClusterSendReliable, msg.SendType)
	assert.Empty(t, msg.Data, "broadcast payload should be empty (D9: receiver does a full reload)")
	assert.True(t, msg.WaitForAllToSend, "guard invalidation must wait for cluster ack (matches access_control precedent)")
}

func TestChannelGuardRegisterTriggersBroadcast(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &captureClusterMock{}
	th := SetupWithClusterMock(t, cluster)
	cluster.reset() // drop init-time noise; only inspect messages from code under test

	channelID := model.NewId()
	pluginID := "com.example.register-broadcast"
	rctx := request.EmptyContext(th.App.Srv().Log())
	require.Nil(t, th.App.RegisterChannelGuard(rctx, channelID, pluginID))

	guardEvents := filterGuardCacheEvents(cluster.snapshot())
	require.Len(t, guardEvents, 1, "Register must produce exactly one guard-cache invalidation")
}

func filterGuardCacheEvents(msgs []*model.ClusterMessage) []*model.ClusterMessage {
	out := []*model.ClusterMessage{}
	for _, m := range msgs {
		if m.Event == clusterEventInvalidateChannelGuardCache {
			out = append(out, m)
		}
	}
	return out
}

func TestChannelGuardUnregisterTriggersBroadcast(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &captureClusterMock{}
	th := SetupWithClusterMock(t, cluster)

	channelID := model.NewId()
	pluginID := "com.example.unregister-broadcast"
	rctx := request.EmptyContext(th.App.Srv().Log())
	// Register first (this also broadcasts), then drop captured noise so we
	// only see the Unregister-side broadcast.
	require.Nil(t, th.App.RegisterChannelGuard(rctx, channelID, pluginID))
	cluster.reset()

	require.Nil(t, th.App.UnregisterChannelGuard(rctx, channelID, pluginID))

	guardEvents := filterGuardCacheEvents(cluster.snapshot())
	require.Len(t, guardEvents, 1, "Unregister must produce exactly one guard-cache invalidation")
}

func TestChannelGuardCacheMultiChannelRefetch(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &captureClusterMock{}
	th := SetupWithClusterMock(t, cluster)

	channelA := model.NewId()
	channelB := model.NewId()
	pluginA := "com.example.multi-a"
	pluginB := "com.example.multi-b"

	rctx := request.EmptyContext(th.App.Srv().Log())
	require.NoError(t, th.App.Srv().Store().ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelA, PluginId: pluginA, CreatedAt: 1}))
	require.NoError(t, th.App.Srv().Store().ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelA, PluginId: pluginB, CreatedAt: 2}))
	require.NoError(t, th.App.Srv().Store().ChannelGuard().Save(rctx, &store.ChannelGuard{ChannelId: channelB, PluginId: pluginA, CreatedAt: 3}))

	// Force the cache to be empty (simulate a node that just started or had its cache cleared).
	th.App.Channels().guardCache.Store(&sync.Map{})

	th.App.Channels().clusterInvalidateGuardCacheHandler(&model.ClusterMessage{
		Event: clusterEventInvalidateChannelGuardCache,
	})

	gotA := th.App.Channels().getGuardsForChannel(channelA)
	gotB := th.App.Channels().getGuardsForChannel(channelB)
	assert.Len(t, gotA, 2, "channel A should have two claims after refetch")
	assert.Len(t, gotB, 1, "channel B should have one claim after refetch")
}

// TestChannelGuardRegisterUnregisterNilClusterIsSafe verifies that the
// App-level Register/Unregister methods don't panic when Cluster() is nil.
// They reach broadcastChannelGuardInvalidation, so this also covers the nil
// guard inside that helper.
func TestChannelGuardRegisterUnregisterNilClusterIsSafe(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	require.Nil(t, th.App.Srv().platform.Cluster(), "expected nil cluster in a single-node test setup")

	channelID := th.BasicChannel.Id
	pluginID := "com.example.nil-cluster-rt"

	rctx := request.EmptyContext(th.App.Srv().Log())
	require.Nil(t, th.App.RegisterChannelGuard(rctx, channelID, pluginID))
	got := th.App.Channels().getGuardsForChannel(channelID)
	require.Len(t, got, 1)
	assert.Equal(t, pluginID, got[0].PluginId)

	require.Nil(t, th.App.UnregisterChannelGuard(rctx, channelID, pluginID))
	assert.Empty(t, th.App.Channels().getGuardsForChannel(channelID))
}

func TestChannelGuardLowercaseNormalization(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelID := th.BasicChannel.Id
	mixedCaseID := "MixedCase.Plugin.ID"
	expectedID := "mixedcase.plugin.id"

	// Build a PluginAPI directly with a mixed-case manifest. This bypasses the
	// real plugin activation path (which we don't need for the lowercasing
	// check) and exercises only the api.id -> App.RegisterChannelGuard handoff.
	rctx := request.EmptyContext(th.App.Srv().Log())
	api := &PluginAPI{
		id:  mixedCaseID,
		app: th.App,
		ctx: rctx,
	}

	require.Nil(t, api.RegisterChannelGuard(channelID))
	guards, err := th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 1)
	assert.Equal(t, expectedID, guards[0].PluginId, "PluginId must be normalized to lowercase before reaching the store")

	require.Nil(t, api.UnregisterChannelGuard(channelID))
	guards, err = th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	assert.Empty(t, guards, "Unregister with the same mixed-case id must hit the lowercased row")
}

func TestChannelGuardEmptyChannelIDRejected(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	rctx := request.EmptyContext(th.App.Srv().Log())
	appErr := th.App.RegisterChannelGuard(rctx, "", "com.example.plugin")
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel_guard.register.empty_channel.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)

	appErr = th.App.UnregisterChannelGuard(rctx, "", "com.example.plugin")
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel_guard.unregister.empty_channel.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)
}

// TestUnregisterChannelGuardWarnsOnNoMatchingRow verifies that calling UnregisterChannelGuard with
// a pluginID that has no claim on the channel returns nil (no error) and leaves the existing guard
// row untouched. The Warn log emitted when rowsAffected==0 is operator-facing and is not asserted
// here; the behavioral contract (nil return + row unchanged) is the check.
func TestUnregisterChannelGuardWarnsOnNoMatchingRow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelID := th.BasicChannel.Id
	pluginA := "com.example.plugin-a"
	pluginB := "com.example.plugin-b"

	rctx := request.EmptyContext(th.App.Srv().Log())

	// Register pluginA's guard on the channel.
	require.Nil(t, th.App.RegisterChannelGuard(rctx, channelID, pluginA))

	// Unregister with a different pluginID — must return nil (no-op).
	appErr := th.App.UnregisterChannelGuard(rctx, channelID, pluginB)
	require.Nil(t, appErr, "cross-plugin Unregister must return nil")

	// pluginA's guard row must be untouched.
	guards, err := th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 1, "pluginA guard row must remain after cross-plugin Unregister")
	assert.Equal(t, pluginA, guards[0].PluginId)
}

// failingGuardStore wraps a real ChannelGuardStore but forces GetAll to error,
// so tests can exercise reload-failure branches deterministically.
type failingGuardStore struct {
	store.ChannelGuardStore
	err error
}

func (f *failingGuardStore) GetAll(rctx request.CTX) ([]*store.ChannelGuard, error) {
	return nil, f.err
}

// guardFailingStoreWrapper decorates a real Store, swapping ChannelGuard() for
// a failing implementation. All other store calls pass through to the embedded
// Store so the rest of the app stays functional.
type guardFailingStoreWrapper struct {
	store.Store
	failing *failingGuardStore
}

func (w *guardFailingStoreWrapper) ChannelGuard() store.ChannelGuardStore {
	return w.failing
}

func TestChannelGuardCacheClusterInvalidationHandlesStoreFailure(t *testing.T) {
	// No t.Parallel(): mutates package-level guardCacheRetryInitialDelay.
	originalInitial := guardCacheRetryInitialDelay
	guardCacheRetryInitialDelay = 30 * time.Second
	t.Cleanup(func() { guardCacheRetryInitialDelay = originalInitial })

	th := Setup(t)
	ch := th.App.Channels()

	// Pre-populate the cache with a known row by writing through the real store
	// then doing a successful reload.
	channelID := model.NewId()
	pluginID := "com.example.cluster-fail-test"
	rctx := request.EmptyContext(th.App.Srv().Log())
	require.NoError(t, th.App.Srv().Store().ChannelGuard().Save(rctx, &store.ChannelGuard{
		ChannelId: channelID,
		PluginId:  pluginID,
		CreatedAt: 1,
	}))
	require.NoError(t, ch.reloadGuardCache(rctx, th.App.Srv().Store()))
	require.Len(t, ch.getGuardsForChannel(channelID), 1, "precondition: cache should hold the seeded row")

	// Swap in a wrapped store that fails on GetAll.
	originalStore := th.App.Srv().Store()
	wrapped := &guardFailingStoreWrapper{
		Store:   originalStore,
		failing: &failingGuardStore{ChannelGuardStore: originalStore.ChannelGuard(), err: assert.AnError},
	}
	th.App.Srv().SetStore(wrapped)
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	// Sanity: confirm the wrapped store actually fails, otherwise the test is meaningless.
	_, err := th.App.Srv().Store().ChannelGuard().GetAll(rctx)
	require.Error(t, err, "test wrapper must surface GetAll failure")

	// Calling the handler with a failing store must:
	//   - not panic
	//   - leave the existing cache untouched
	//   - schedule a retry (atomic.Bool flips to true)
	require.NotPanics(t, func() {
		ch.clusterInvalidateGuardCacheHandler(&model.ClusterMessage{
			Event: clusterEventInvalidateChannelGuardCache,
		})
	})

	assert.Len(t, ch.getGuardsForChannel(channelID), 1, "cache must be unchanged when reload fails")
	assert.True(t, ch.guardCacheRetryInFlight.Load(), "failed reload from cluster handler must schedule a retry")
}

// TestScheduleGuardCacheReloadRetrySingleFlight verifies that concurrent calls to
// scheduleGuardCacheReloadRetry collapse to a single in-flight retry goroutine. The retry goroutine
// is parked in its initial timer wait by shrinking nothing — instead we override the initial delay
// to a very long value so the test window stays inside the timer wait, then verify the second call
// returns false (no new goroutine scheduled). Test cleanup tears down the server which closes
// interruptQuitChan and lets the parked goroutine exit cleanly. No t.Parallel() because it mutates
// a package-level var.
func TestScheduleGuardCacheReloadRetrySingleFlight(t *testing.T) {
	originalInitial := guardCacheRetryInitialDelay
	guardCacheRetryInitialDelay = 30 * time.Second
	t.Cleanup(func() { guardCacheRetryInitialDelay = originalInitial })

	th := Setup(t)

	ch := th.App.Channels()
	require.True(t, ch.scheduleGuardCacheReloadRetry(), "first call should schedule a retry")
	require.False(t, ch.scheduleGuardCacheReloadRetry(), "second call should be a no-op while one is in flight")
	require.False(t, ch.scheduleGuardCacheReloadRetry(), "additional concurrent calls should also be no-ops")
}

func TestChannelGuardInvalidChannelIDRejected(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	rctx := request.EmptyContext(th.App.Srv().Log())
	appErr := th.App.RegisterChannelGuard(rctx, "not-a-real-id", "com.example.plugin")
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel_guard.invalid_channel.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)

	appErr = th.App.UnregisterChannelGuard(rctx, "not-a-real-id", "com.example.plugin")
	require.NotNil(t, appErr)
	assert.Equal(t, "app.channel_guard.invalid_channel.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)
}
