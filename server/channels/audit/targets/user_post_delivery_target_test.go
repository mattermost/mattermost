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

// fakeUserPostDeliveryStore records every MarkBulk row and can be told to fail a
// set number of leading calls to exercise the retry / back-pressure paths.
type fakeUserPostDeliveryStore struct {
	mu        sync.Mutex
	rows      map[model.UserPostDelivery]int // row -> times persisted
	calls     int
	failFirst int // number of leading MarkBulk calls to fail
}

func newFakeUserPostDeliveryStore() *fakeUserPostDeliveryStore {
	return &fakeUserPostDeliveryStore{rows: make(map[model.UserPostDelivery]int)}
}

func (f *fakeUserPostDeliveryStore) MarkBulk(_ context.Context, records []model.UserPostDelivery) error {
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

func (f *fakeUserPostDeliveryStore) DeleteByPost(context.Context, string) error { return nil }

func (f *fakeUserPostDeliveryStore) snapshot() (map[model.UserPostDelivery]int, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make(map[model.UserPostDelivery]int, len(f.rows))
	maps.Copy(out, f.rows)
	return out, f.calls
}

func metaFields(meta map[string]any) []mlog.Field {
	return []mlog.Field{mlog.Any(model.AuditKeyMeta, meta)}
}

func newTestTarget(t *testing.T, s store.UserPostDeliveryStore) *UserPostDeliveryTarget {
	t.Helper()
	tgt := NewUserPostDeliveryTarget(s, nil)
	tgt.flushInterval = 10 * time.Millisecond
	require.NoError(t, tgt.Init())
	return tgt
}

// enqueueMeta mirrors the Write path: extract rows from a meta map and route
// them to the shards.
func enqueueMeta(t *testing.T, tgt *UserPostDeliveryTarget, meta map[string]any) {
	t.Helper()
	items, ok := tgt.extractItems(metaFields(meta))
	require.True(t, ok)
	tgt.enqueue(items)
}

func rec(postID, targetID, targetType string, mech int16) model.UserPostDelivery {
	return model.UserPostDelivery{PostID: postID, TargetID: targetID, TargetType: targetType, Mechanism: mech}
}

func TestUserPostDeliveryTarget_WritesAndDedups(t *testing.T) {
	fake := newFakeUserPostDeliveryStore()
	tgt := newTestTarget(t, fake)

	// Same row three times must collapse to a single persisted row.
	for range 3 {
		enqueueMeta(t, tgt, map[string]any{"post_id": "post1", "target_id": "user1", "target_type": model.DeliveryTargetUser, "mechanism": model.DeliveryMechanismProduct})
	}
	// A distinct row.
	enqueueMeta(t, tgt, map[string]any{"post_id": "post1", "target_id": "user2", "target_type": model.DeliveryTargetUser, "mechanism": model.DeliveryMechanismProduct})

	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 2)
	require.Equal(t, 1, rows[rec("post1", "user1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)])
	require.Equal(t, 1, rows[rec("post1", "user2", model.DeliveryTargetUser, model.DeliveryMechanismProduct)])
}

func TestUserPostDeliveryTarget_FanOutArray(t *testing.T) {
	fake := newFakeUserPostDeliveryStore()
	tgt := newTestTarget(t, fake)

	enqueueMeta(t, tgt, map[string]any{
		"target_ids":  []string{"u1", "u2", "u3", ""}, // empty filtered out
		"target_type": model.DeliveryTargetUser,
		"post_id":     "post9",
		"mechanism":   model.DeliveryMechanismProduct,
	})
	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 3)
	for _, u := range []string{"u1", "u2", "u3"} {
		require.Equal(t, 1, rows[rec("post9", u, model.DeliveryTargetUser, model.DeliveryMechanismProduct)])
	}
}

func TestUserPostDeliveryTarget_FanInArray(t *testing.T) {
	fake := newFakeUserPostDeliveryStore()
	tgt := newTestTarget(t, fake)

	enqueueMeta(t, tgt, map[string]any{
		"target_id": "u1",
		"post_ids":  []string{"p1", "p2", ""}, // empty filtered out
		"mechanism": model.DeliveryMechanismProduct,
	})
	require.NoError(t, tgt.Shutdown())

	rows, _ := fake.snapshot()
	require.Len(t, rows, 2)
	// target_type omitted -> defaults to "user".
	for _, p := range []string{"p1", "p2"} {
		require.Equal(t, 1, rows[rec(p, "u1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)])
	}
}

func TestUserPostDeliveryTarget_RetriesOnFailureNoDrop(t *testing.T) {
	fake := newFakeUserPostDeliveryStore()
	fake.failFirst = 2 // first two flushes fail; the row must survive and be retried
	tgt := newTestTarget(t, fake)

	enqueueMeta(t, tgt, map[string]any{"post_id": "post1", "target_id": "user1", "target_type": model.DeliveryTargetUser, "mechanism": model.DeliveryMechanismProduct})
	require.NoError(t, tgt.Shutdown())

	rows, calls := fake.snapshot()
	require.Greater(t, calls, 2, "should have retried past the failing calls")
	require.Equal(t, 1, rows[rec("post1", "user1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)])
}

func TestUserPostDeliveryTarget_ExtractShapes(t *testing.T) {
	tgt := NewUserPostDeliveryTarget(newFakeUserPostDeliveryStore(), nil)

	t.Run("single", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"post_id": "e", "target_id": "t", "target_type": model.DeliveryTargetWebhook, "mechanism": model.DeliveryMechanismOutgoingWebhook}))
		require.True(t, ok)
		require.Equal(t, []deliveryItem{{postID: "e", targetID: "t", targetType: model.DeliveryTargetWebhook, mechanism: model.DeliveryMechanismOutgoingWebhook}}, items)
	})
	t.Run("single defaults target_type to user", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"post_id": "e", "target_id": "t", "mechanism": model.DeliveryMechanismProduct}))
		require.True(t, ok)
		require.Equal(t, []deliveryItem{{postID: "e", targetID: "t", targetType: model.DeliveryTargetUser, mechanism: model.DeliveryMechanismProduct}}, items)
	})
	t.Run("fan-in (one target, many posts)", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"target_id": "u", "post_ids": []string{"a", "b"}, "mechanism": model.DeliveryMechanismProduct}))
		require.True(t, ok)
		require.ElementsMatch(t, []deliveryItem{{"a", "u", model.DeliveryTargetUser, model.DeliveryMechanismProduct}, {"b", "u", model.DeliveryTargetUser, model.DeliveryMechanismProduct}}, items)
	})
	t.Run("fan-out (one post, many targets)", func(t *testing.T) {
		items, ok := tgt.extractItems(metaFields(map[string]any{"post_id": "p", "target_ids": []string{"a", "b"}, "mechanism": model.DeliveryMechanismProduct}))
		require.True(t, ok)
		require.ElementsMatch(t, []deliveryItem{{"p", "a", model.DeliveryTargetUser, model.DeliveryMechanismProduct}, {"p", "b", model.DeliveryTargetUser, model.DeliveryMechanismProduct}}, items)
	})
	t.Run("missing ids", func(t *testing.T) {
		_, ok := tgt.extractItems(metaFields(map[string]any{"target_id": "u"}))
		require.False(t, ok)
	})
	t.Run("no meta field", func(t *testing.T) {
		_, ok := tgt.extractItems([]mlog.Field{mlog.String("other", "x")})
		require.False(t, ok)
	})
}

func TestUserPostDeliveryTarget_NilStoreIsNoop(t *testing.T) {
	tgt := NewUserPostDeliveryTarget(nil, nil)
	require.NoError(t, tgt.Init())
	require.NoError(t, tgt.Shutdown())
}

func TestShardForIsStable(t *testing.T) {
	// Same target always lands on the same shard: the conflict-free guarantee.
	for _, id := range []string{"user1", "abcdefghijklmnopqrstuvwxyz", ""} {
		require.Equal(t, shardFor(id, 8), shardFor(id, 8))
		require.Less(t, shardFor(id, 8), 8)
		require.GreaterOrEqual(t, shardFor(id, 8), 0)
	}
}
