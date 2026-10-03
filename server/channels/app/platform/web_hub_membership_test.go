// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"fmt"
	"hash/maphash"
	"maps"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// membershipInterceptingStore serves Channel() from a membershipInterceptingChannelStore.
type membershipInterceptingStore struct {
	store.Store
	channel *membershipInterceptingChannelStore
}

func (s *membershipInterceptingStore) Channel() store.ChannelStore {
	return s.channel
}

// membershipInterceptingChannelStore passes every call through to the real store and overrides only
// GetAllChannelMembersForUser: to count it, fail it, answer it from memory, or pause it.
type membershipInterceptingChannelStore struct {
	store.ChannelStore
	numCalls                atomic.Int64
	simulateDatabaseFailure atomic.Bool

	mu      sync.Mutex
	members map[string]map[string]string
	pause   *loadPause
	loads   [][]string
}

// loadPause freezes one membership load right after it has read its answer. The load signals on paused
// and waits; the test changes whatever it needs to, then closes resume to let the load finish.
type loadPause struct {
	paused chan struct{}
	resume chan struct{}
}

func (s *membershipInterceptingChannelStore) GetAllChannelMembersForUser(rctx request.CTX, userID string, allowFromCache bool, includeDeleted bool) (map[string]string, error) {
	s.numCalls.Add(1)

	if s.simulateDatabaseFailure.Load() {
		return nil, fmt.Errorf("simulated database failure")
	}

	s.mu.Lock()
	pause := s.pause
	s.pause = nil
	fromMemory := s.members != nil
	var result map[string]string
	if fromMemory {
		result = s.members[userID]
		s.loads = append(s.loads, slices.Sorted(maps.Keys(result)))
	}
	s.mu.Unlock()

	if !fromMemory {
		var err error
		if result, err = s.ChannelStore.GetAllChannelMembersForUser(rctx, userID, allowFromCache, includeDeleted); err != nil {
			return nil, err
		}
	}
	if pause != nil {
		pause.paused <- struct{}{}
		<-pause.resume
	}
	return result, nil
}

// setMembers swaps in a new map for userID; maps already handed out by a load are never modified.
func (s *membershipInterceptingChannelStore) setMembers(userID string, channelIDs ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.members == nil {
		s.members = map[string]map[string]string{}
	}
	m := make(map[string]string, len(channelIDs))
	for _, chID := range channelIDs {
		m[chID] = ""
	}
	s.members[userID] = m
}

// pauseNextLoad arranges for the next load to pause once it has its answer.
func (s *membershipInterceptingChannelStore) pauseNextLoad() *loadPause {
	pause := &loadPause{paused: make(chan struct{}, 1), resume: make(chan struct{})}
	s.mu.Lock()
	s.pause = pause
	s.mu.Unlock()
	return pause
}

func (s *membershipInterceptingChannelStore) loadedLists() [][]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.loads)
}

// newMembershipTestPlatform returns a PlatformService with started hubs and the store that intercepts its membership loads.
func newMembershipTestPlatform(t *testing.T, th *TestHelper, channelIteration bool) (*PlatformService, *membershipInterceptingChannelStore) {
	t.Helper()
	channelStore := &membershipInterceptingChannelStore{ChannelStore: th.Service.Store.Channel()}
	ps := newBroadcastBenchPlatform(t, th.Service.logger, &membershipInterceptingStore{Store: th.Service.Store, channel: channelStore}, channelIteration)
	return ps, channelStore
}

// channelEvent returns a posted event scoped to channelID.
func channelEvent(channelID string) *model.WebSocketEvent {
	return model.NewWebSocketEvent(model.WebsocketEventPosted, "", channelID, "", nil, "")
}

// startGoroutine runs f on a new goroutine and returns a channel that is closed when f returns.
func startGoroutine(f func()) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		f()
	}()
	return done
}

// waitForEvent receives one event from the connection's send queue.
func waitForEvent(t *testing.T, wc *WebConn) *model.WebSocketEvent {
	t.Helper()
	select {
	case msg := <-wc.send:
		ev, ok := msg.(*model.WebSocketEvent)
		require.True(t, ok, "expected a *model.WebSocketEvent, got %T", msg)
		return ev
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for an event on the connection")
		return nil
	}
}

// fenceEvent follows the events under test; the hub handles broadcasts in order, so an event that has not arrived before its fence was not delivered.
const fenceEvent model.WebsocketEventType = "test_fence"

// requireDelivery publishes a channel event and requires that it reaches receivers and not others.
func requireDelivery(t *testing.T, ps *PlatformService, channelID string, receivers, others []*WebConn) {
	t.Helper()
	ps.PublishSkipClusterSend(channelEvent(channelID))
	conns := append(slices.Clone(receivers), others...)
	for _, wc := range conns {
		fence := model.NewWebSocketEvent(fenceEvent, "", "", "", nil, "")
		fence.GetBroadcast().ConnectionId = wc.GetConnectionID()
		ps.PublishSkipClusterSend(fence)
	}
	for _, wc := range receivers {
		ev := waitForEvent(t, wc)
		require.Equal(t, model.WebsocketEventPosted, ev.EventType(), "the channel event did not arrive before the fence")
		require.Equal(t, channelID, ev.GetBroadcast().ChannelId)
	}
	for _, wc := range conns {
		require.Equal(t, fenceEvent, waitForEvent(t, wc).EventType(), "an unexpected event arrived before the fence")
	}
}

func requireDelivered(t *testing.T, ps *PlatformService, channelID string, conns ...*WebConn) {
	t.Helper()
	requireDelivery(t, ps, channelID, conns, nil)
}

func requireNotDelivered(t *testing.T, ps *PlatformService, channelID string, conns ...*WebConn) {
	t.Helper()
	requireDelivery(t, ps, channelID, nil, conns)
}

func requireDone(t *testing.T, done <-chan struct{}, what string) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for "+what)
	}
}

// membershipLockHeld reports whether userID's membership lock is held.
func membershipLockHeld(ps *PlatformService, userID string) bool {
	mu := ps.GetHubForUserId(userID).membershipLock(userID)
	if mu.TryLock() {
		mu.Unlock()
		return false
	}
	return true
}

func TestHubMembershipLoadedOffHubGoroutine(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	addMember := func(t *testing.T, channelID, userID string) {
		t.Helper()
		_, err := th.Service.Store.Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channelID,
			UserId:      userID,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeUser:  true,
		})
		require.NoError(t, err)
	}
	addMember(t, th.BasicChannel.Id, th.BasicUser.Id)

	t.Run("channel iteration on: one load per register and per invalidate, and the hub delivers meanwhile", func(t *testing.T) {
		ps, channelStore := newMembershipTestPlatform(t, th, true)

		wc1 := newBroadcastBenchConn(ps, th.BasicUser.Id)
		require.NoError(t, ps.HubRegister(wc1))
		require.EqualValues(t, 1, channelStore.numCalls.Load(), "one load per registration")

		// While the second tab's load is paused, the hub must still deliver to the first tab.
		pause := channelStore.pauseNextLoad()
		wc2 := newBroadcastBenchConn(ps, th.BasicUser.Id)
		var regErr error
		registered := startGoroutine(func() { regErr = ps.HubRegister(wc2) })
		requireDone(t, pause.paused, "the second register's load")
		requireDelivered(t, ps, th.BasicChannel.Id, wc1)
		close(pause.resume)
		requireDone(t, registered, "the second register")
		require.NoError(t, regErr)
		require.EqualValues(t, 2, channelStore.numCalls.Load())

		requireDelivered(t, ps, th.BasicChannel.Id, wc1, wc2)

		ch2 := th.CreateChannel(t, th.BasicTeam)
		requireNotDelivered(t, ps, ch2.Id, wc1, wc2)

		// The join's invalidation loads once for both tabs; the hub delivers while that load is paused too.
		addMember(t, ch2.Id, th.BasicUser.Id)
		pause = channelStore.pauseNextLoad()
		invalidated := startGoroutine(func() { ps.InvalidateChannelCacheForUser(th.BasicUser.Id) })
		requireDone(t, pause.paused, "the invalidation's load")
		requireDelivered(t, ps, th.BasicChannel.Id, wc1, wc2)
		close(pause.resume)
		requireDone(t, invalidated, "the invalidation")
		require.EqualValues(t, 3, channelStore.numCalls.Load(), "one load per invalidation")

		requireDelivered(t, ps, ch2.Id, wc1, wc2)

		ps.clusterInvalidateWebConnSessionCacheForUserHandler(&model.ClusterMessage{
			Event: model.ClusterEventInvalidateWebConnCacheForUser,
			Data:  []byte(th.BasicUser.Id),
		})
		require.EqualValues(t, 4, channelStore.numCalls.Load())

		requireDelivered(t, ps, th.BasicChannel.Id, wc1, wc2)
		require.EqualValues(t, 4, channelStore.numCalls.Load())

		ps.HubUnregister(wc1)
		ps.HubUnregister(wc2)
	})

	t.Run("channel iteration on: a failed load fails the registration", func(t *testing.T) {
		ps, channelStore := newMembershipTestPlatform(t, th, true)
		channelStore.simulateDatabaseFailure.Store(true)

		wc := newBroadcastBenchConn(ps, th.BasicUser.Id)
		err := ps.HubRegister(wc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "error getChannelMembersForUser")
		assert.Equal(t, 0, ps.WebConnCountForUser(th.BasicUser.Id))
	})

	t.Run("channel iteration on: a failed load on invalidate drops the user's connections", func(t *testing.T) {
		ps, channelStore := newMembershipTestPlatform(t, th, true)

		wc := newBroadcastBenchConn(ps, th.BasicUser.Id)
		require.NoError(t, ps.HubRegister(wc))
		require.Equal(t, 1, ps.WebConnCountForUser(th.BasicUser.Id))

		channelStore.simulateDatabaseFailure.Store(true)
		ps.InvalidateChannelCacheForUser(th.BasicUser.Id)

		select {
		case _, open := <-wc.send:
			require.False(t, open, "the connection's send queue must be closed")
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for the connection's send queue to close")
		}
		assert.Equal(t, 0, ps.WebConnCountForUser(th.BasicUser.Id))
	})
}

// TestHubMembershipChannelsUnbuffered pins the unbuffered channels that the membership lock relies on for ordering.
func TestHubMembershipChannelsUnbuffered(t *testing.T) {
	hub := newWebHub(&PlatformService{})
	require.Zero(t, cap(hub.register), "a completed send must mean the hub has the registration")
	require.Zero(t, cap(hub.invalidateUser), "a completed send must mean the hub has the invalidation")
}

// TestHubMembershipLockStripesSpread checks that the users of one hub spread over all of its lock stripes.
func TestHubMembershipLockStripesSpread(t *testing.T) {
	ps := &PlatformService{hashSeed: maphash.MakeSeed()}
	for range 16 {
		ps.hubs = append(ps.hubs, newWebHub(ps))
	}
	hub := ps.hubs[0]
	stripes := map[*sync.Mutex]struct{}{}
	for n := 0; n < 10000; {
		userID := model.NewId()
		if ps.GetHubForUserId(userID) != hub {
			continue
		}
		stripes[hub.membershipLock(userID)] = struct{}{}
		n++
	}
	require.Len(t, stripes, webConnMembershipLockStripes, "10000 users of one hub must reach every stripe")
}

// TestHubMembershipLockOrdersRegisterAndInvalidate checks that a register and an invalidation racing for one user end on the newest list.
func TestHubMembershipLockOrdersRegisterAndInvalidate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("register loads first: the invalidation waits and its newer list wins", func(t *testing.T) {
		ps, channelStore := newMembershipTestPlatform(t, th, true)
		userID := model.NewId()
		channelStore.setMembers(userID, "ch1")

		pause := channelStore.pauseNextLoad()
		wc := newBroadcastBenchConn(ps, userID)
		var regErr error
		registered := startGoroutine(func() { regErr = ps.HubRegister(wc) })
		requireDone(t, pause.paused, "the register's load")
		require.True(t, membershipLockHeld(ps, userID), "the register must hold the user's lock while it loads")

		channelStore.setMembers(userID, "ch1", "ch2")
		invalidated := startGoroutine(func() { ps.InvalidateChannelCacheForUser(userID) })

		close(pause.resume)
		requireDone(t, registered, "the register")
		require.NoError(t, regErr)
		requireDone(t, invalidated, "the invalidation")

		assert.Equal(t, [][]string{{"ch1"}, {"ch1", "ch2"}}, channelStore.loadedLists())
		require.Equal(t, 1, ps.WebConnCountForUser(userID))
		requireDelivered(t, ps, "ch2", wc)
		requireDelivered(t, ps, "ch1", wc)

		ps.HubUnregister(wc)
	})

	t.Run("invalidation loads first: the register waits and loads the newer list", func(t *testing.T) {
		ps, channelStore := newMembershipTestPlatform(t, th, true)
		userID := model.NewId()
		channelStore.setMembers(userID, "ch1")

		existing := newBroadcastBenchConn(ps, userID)
		require.NoError(t, ps.HubRegister(existing))
		pause := channelStore.pauseNextLoad()
		invalidated := startGoroutine(func() { ps.InvalidateChannelCacheForUser(userID) })
		requireDone(t, pause.paused, "the invalidation's load")
		require.True(t, membershipLockHeld(ps, userID), "the invalidation must hold the user's lock while it loads")

		channelStore.setMembers(userID, "ch1", "ch2")
		wc := newBroadcastBenchConn(ps, userID)
		var regErr error
		registered := startGoroutine(func() { regErr = ps.HubRegister(wc) })

		close(pause.resume)
		requireDone(t, invalidated, "the invalidation")
		requireDone(t, registered, "the register")
		require.NoError(t, regErr)

		assert.Equal(t, [][]string{{"ch1"}, {"ch1"}, {"ch1", "ch2"}}, channelStore.loadedLists())
		require.Equal(t, 2, ps.WebConnCountForUser(userID))
		requireDelivery(t, ps, "ch2", []*WebConn{wc}, []*WebConn{existing})
		requireDelivered(t, ps, "ch1", wc, existing)

		ps.HubUnregister(wc)
		ps.HubUnregister(existing)
	})
}

// TestHubRegisterOnStoppedHubLoadsNothing checks that a registration on a stopped hub returns before loading membership.
func TestHubRegisterOnStoppedHubLoadsNothing(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	ps, channelStore := newMembershipTestPlatform(t, th, true)
	userID := model.NewId()
	channelStore.setMembers(userID, "ch1")

	ps.HubStop()
	require.NoError(t, ps.HubRegister(newBroadcastBenchConn(ps, userID)))
	require.Zero(t, channelStore.numCalls.Load(), "a stopped hub never adds the connection, so there is nothing to load")
}
