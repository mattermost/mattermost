// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"context"
	"maps"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// fakeAuditStorage records every MarkBulk row and can be told to fail a set
// number of leading calls to exercise the discard-on-failure path.
type fakeAuditStorage struct {
	mu        sync.Mutex
	rows      map[model.AuditDeliveryRecord]int // row -> times persisted
	calls     int
	failFirst int // number of leading MarkBulk calls to fail
}

func newFakeAuditStorage() *fakeAuditStorage {
	return &fakeAuditStorage{rows: make(map[model.AuditDeliveryRecord]int)}
}

func (f *fakeAuditStorage) MarkBulk(_ context.Context, records []model.AuditDeliveryRecord) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.failFirst > 0 {
		f.failFirst--
		return context.DeadlineExceeded
	}
	for _, r := range records {
		f.rows[r]++
	}
	return nil
}

func (f *fakeAuditStorage) snapshot() (map[model.AuditDeliveryRecord]int, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[model.AuditDeliveryRecord]int, len(f.rows))
	maps.Copy(out, f.rows)
	return out, f.calls
}

// unused AuditStorageStore methods.
func (f *fakeAuditStorage) Mark(context.Context, string, string, int16) error { return nil }
func (f *fakeAuditStorage) MarkBulkSameUser(context.Context, string, []string, int16) error {
	return nil
}
func (f *fakeAuditStorage) MarkBulkSamePost(context.Context, []string, string, int16) error {
	return nil
}
func (f *fakeAuditStorage) HasRead(context.Context, string, string) (bool, error) {
	return false, nil
}

func metaFields(meta map[string]any) []mlog.Field {
	return []mlog.Field{mlog.Any(model.AuditKeyMeta, meta)}
}

func newTestTarget(t *testing.T, s store.AuditStorageStore) *ShardedDeliveryDBTarget {
	t.Helper()
	tgt := NewShardedDeliveryDBTarget(s, nil)
	tgt.flushInterval = 10 * time.Millisecond
	require.NoError(t, tgt.Init())
	return tgt
}

// routeMeta mirrors the Write path: parse the meta map and route rows to
// their shards directly, without going through the public LogRec API.
func routeMeta(tgt *ShardedDeliveryDBTarget, meta map[string]any) {
	tgt.route(metaFields(meta))
}

func rec(userID, entityID string, mech int16) model.AuditDeliveryRecord {
	return model.AuditDeliveryRecord{UserID: userID, EntityID: entityID, Mechanism: mech}
}

func TestShardedDeliveryDBTarget_WritesAndDedups(t *testing.T) {
	fake := newFakeAuditStorage()
	tgt := newTestTarget(t, fake)

	// Same row three times must collapse to a single persisted row.
	for range 3 {
		routeMeta(tgt, map[string]any{"user_id": "user1", "entity_id": "post1", "mechanism": model.AuditMechWebsocketBroadcast})
	}
	// A distinct row.
	routeMeta(tgt, map[string]any{"user_id": "user2", "entity_id": "post1", "mechanism": model.AuditMechWebsocketBroadcast})

	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 2)
	require.Equal(t, 1, rows[rec("user1", "post1", model.AuditMechWebsocketBroadcast)])
	require.Equal(t, 1, rows[rec("user2", "post1", model.AuditMechWebsocketBroadcast)])
}

func TestShardedDeliveryDBTarget_FanOutArray(t *testing.T) {
	fake := newFakeAuditStorage()
	tgt := newTestTarget(t, fake)

	routeMeta(tgt, map[string]any{
		"user_ids":  []string{"u1", "u2", "u3", ""}, // empty filtered out
		"entity_id": "post9",
		"mechanism": model.AuditMechWebsocketBroadcast,
	})
	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 3)
	for _, u := range []string{"u1", "u2", "u3"} {
		require.Equal(t, 1, rows[rec(u, "post9", model.AuditMechWebsocketBroadcast)])
	}
}

func TestShardedDeliveryDBTarget_RetriesBatchOnFailure(t *testing.T) {
	fake := newFakeAuditStorage()
	fake.failFirst = 2 // first two flush attempts fail; the row must survive and persist on retry
	tgt := newTestTarget(t, fake)

	routeMeta(tgt, map[string]any{"user_id": "user1", "entity_id": "post1", "mechanism": model.AuditMechChannelView})

	// The 10ms ticker plus the 3-attempt shutdown loop give the row several
	// flush chances; once failFirst drains to 0, MarkBulk succeeds and the
	// row is persisted. A failed flush must NOT silently drop records.
	require.Eventually(t, func() bool {
		rows, _ := fake.snapshot()
		return len(rows) == 1 && rows[rec("user1", "post1", model.AuditMechChannelView)] == 1
	}, time.Second, 5*time.Millisecond, "row should persist once transient flush failures clear")

	require.NoError(t, tgt.Shutdown())
}

func TestShardedDeliveryDBTarget_BlocksWhenShardFull(t *testing.T) {
	// Build a 1-slot shard channel and skip Init so no worker drains it: the
	// first enqueue fills the channel, the second must block (the lossless
	// back-pressure contract) and bump blockedCount.
	tgt := NewShardedDeliveryDBTarget(newFakeAuditStorage(), nil)
	tgt.shardQueue = 1
	tgt.shards = make([]chan auditDeliveryItem, tgt.numShards)
	for i := range tgt.shards {
		tgt.shards[i] = make(chan auditDeliveryItem, tgt.shardQueue)
	}

	item1 := auditDeliveryItem{userID: "u", entityID: "e1", mechanism: 1}
	item2 := auditDeliveryItem{userID: "u", entityID: "e2", mechanism: 1}
	tgt.enqueue(item1) // fills the shard slot
	require.Equal(t, int64(0), tgt.blockedCount.Load())

	done := make(chan struct{})
	go func() {
		tgt.enqueue(item2) // must block until something drains the slot
		close(done)
	}()

	select {
	case <-done:
		t.Fatal("enqueue returned even though the shard channel was full; expected back-pressure")
	case <-time.After(50 * time.Millisecond):
	}
	require.Greater(t, tgt.blockedCount.Load(), int64(0), "blockedCount should record the stall")

	// Drain the slot; the blocked enqueue now completes.
	<-tgt.shards[shardFor("u", tgt.numShards)]
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("enqueue did not unblock after the shard slot was drained")
	}
}

func TestShardedDeliveryDBTarget_RouteShapes(t *testing.T) {
	t.Run("single", func(t *testing.T) {
		fake := newFakeAuditStorage()
		tgt := newTestTarget(t, fake)
		routeMeta(tgt, map[string]any{"user_id": "u", "entity_id": "e", "mechanism": int16(9)})
		require.NoError(t, tgt.Shutdown())
		rows, _ := fake.snapshot()
		require.Equal(t, 1, rows[rec("u", "e", 9)])
	})
	t.Run("fan-in (one user, many posts)", func(t *testing.T) {
		fake := newFakeAuditStorage()
		tgt := newTestTarget(t, fake)
		routeMeta(tgt, map[string]any{"user_id": "u", "entity_ids": []string{"a", "b"}, "mechanism": int16(1)})
		require.NoError(t, tgt.Shutdown())
		rows, _ := fake.snapshot()
		require.Equal(t, 1, rows[rec("u", "a", 1)])
		require.Equal(t, 1, rows[rec("u", "b", 1)])
	})
	t.Run("missing ids", func(t *testing.T) {
		fake := newFakeAuditStorage()
		tgt := newTestTarget(t, fake)
		routeMeta(tgt, map[string]any{"user_id": "u"})
		require.NoError(t, tgt.Shutdown())
		rows, _ := fake.snapshot()
		require.Empty(t, rows)
	})
}

func TestShardedDeliveryDBTarget_NilStoreIsNoop(t *testing.T) {
	tgt := NewShardedDeliveryDBTarget(nil, nil)
	require.NoError(t, tgt.Init())
	require.NoError(t, tgt.Shutdown())
}

func TestShardForIsStable(t *testing.T) {
	// Same key always lands on the same shard: the conflict-free guarantee.
	for _, id := range []string{"post1", "abcdefghijklmnopqrstuvwxyz", ""} {
		require.Equal(t, shardFor(id, 8), shardFor(id, 8))
		require.Less(t, shardFor(id, 8), 8)
		require.GreaterOrEqual(t, shardFor(id, 8), 0)
	}
}
