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
// number of leading calls to exercise the retry / back-pressure paths.
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

// enqueueMeta mirrors the Write path: extract rows from a meta map and route
// them to the shards.
func enqueueMeta(t *testing.T, tgt *ShardedDeliveryDBTarget, meta map[string]any) {
	t.Helper()
	items, ok := tgt.extractItems(metaFields(meta))
	require.True(t, ok)
	tgt.enqueue(items)
}

func rec(userID, entityID string, mech int16) model.AuditDeliveryRecord {
	return model.AuditDeliveryRecord{UserID: userID, EntityID: entityID, Mechanism: mech}
}

func TestShardedDeliveryDBTarget_WritesAndDedups(t *testing.T) {
	fake := newFakeAuditStorage()
	tgt := newTestTarget(t, fake)

	// Same row three times must collapse to a single persisted row.
	for range 3 {
		enqueueMeta(t, tgt, map[string]any{"user_id": "user1", "entity_id": "post1", "mechanism": model.AuditMechWebsocketBroadcast})
	}
	// A distinct row.
	enqueueMeta(t, tgt, map[string]any{"user_id": "user2", "entity_id": "post1", "mechanism": model.AuditMechWebsocketBroadcast})

	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 2)
	require.Equal(t, 1, rows[rec("user1", "post1", model.AuditMechWebsocketBroadcast)])
	require.Equal(t, 1, rows[rec("user2", "post1", model.AuditMechWebsocketBroadcast)])
}

func TestShardedDeliveryDBTarget_FanOutArray(t *testing.T) {
	fake := newFakeAuditStorage()
	tgt := newTestTarget(t, fake)

	enqueueMeta(t, tgt, map[string]any{
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

func TestShardedDeliveryDBTarget_RetriesOnFailureNoDrop(t *testing.T) {
	fake := newFakeAuditStorage()
	fake.failFirst = 2 // first two flushes fail; the row must survive and be retried
	tgt := newTestTarget(t, fake)

	enqueueMeta(t, tgt, map[string]any{"user_id": "user1", "entity_id": "post1", "mechanism": model.AuditMechChannelView})
	require.NoError(t, tgt.Shutdown())

	rows, calls := fake.snapshot()
	require.Greater(t, calls, 2, "should have retried past the failing calls")
	require.Equal(t, 1, rows[rec("user1", "post1", model.AuditMechChannelView)])
}

func TestShardedDeliveryDBTarget_ExtractShapes(t *testing.T) {
	tgt := NewShardedDeliveryDBTarget(newFakeAuditStorage(), nil)

	t.Run("single", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"user_id": "u", "entity_id": "e", "mechanism": int16(9)}))
		require.True(t, ok)
		require.Equal(t, []auditDeliveryItem{{userID: "u", entityID: "e", mechanism: 9}}, items)
	})
	t.Run("fan-in (one user, many posts)", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"user_id": "u", "entity_ids": []string{"a", "b"}, "mechanism": int16(1)}))
		require.True(t, ok)
		require.ElementsMatch(t, []auditDeliveryItem{{"u", "a", 1}, {"u", "b", 1}}, items)
	})
	t.Run("missing ids", func(t *testing.T) {
		_, ok := tgt.extractItems(metaFields(map[string]any{"user_id": "u"}))
		require.False(t, ok)
	})
	t.Run("no meta field", func(t *testing.T) {
		_, ok := tgt.extractItems([]mlog.Field{mlog.String("other", "x")})
		require.False(t, ok)
	})
}

func TestShardedDeliveryDBTarget_NilStoreIsNoop(t *testing.T) {
	tgt := NewShardedDeliveryDBTarget(nil, nil)
	require.NoError(t, tgt.Init())
	require.NoError(t, tgt.Shutdown())
}

func TestShardForIsStable(t *testing.T) {
	// Same entity always lands on the same shard: the conflict-free guarantee.
	for _, id := range []string{"post1", "abcdefghijklmnopqrstuvwxyz", ""} {
		require.Equal(t, shardFor(id, 8), shardFor(id, 8))
		require.Less(t, shardFor(id, 8), 8)
		require.GreaterOrEqual(t, shardFor(id, 8), 0)
	}
}
