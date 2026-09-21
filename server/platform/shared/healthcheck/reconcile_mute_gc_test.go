// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestReconcileMuteFingerprintScope(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(6_000_000)
	store := NewMemoryStore()
	registry := testRegistry(
		testRule("PUSH_EMPTY_URL", VolatilityStable),
		testRule("PUSH_BAD_SCHEME", VolatilityStable),
	)
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	emptyURL := testEvaluation("PUSH_EMPTY_URL", "config.push_notification_server", "", StateFiring, baseTime)
	_, err := reconciler.Reconcile([]Evaluation{emptyURL})
	require.NoError(t, err)
	require.NoError(t, store.Mute(emptyURL.Fingerprint, "admin-user", baseTime.UnixMilli()))

	httpURL := testEvaluation("PUSH_BAD_SCHEME", "config.push_notification_server", "", StateFiring, baseTime.Add(time.Minute))
	_, err = reconciler.Reconcile([]Evaluation{httpURL})
	require.NoError(t, err)

	visible, err := store.List(model.HealthFindingFilter{})
	require.NoError(t, err)
	require.Len(t, visible, 1)
	require.Equal(t, httpURL.Fingerprint, visible[0].Fingerprint)

	muted, err := store.List(model.HealthFindingFilter{Muted: model.MutedOnly})
	require.NoError(t, err)
	require.Len(t, muted, 1)
	require.Equal(t, emptyURL.Fingerprint, muted[0].Fingerprint)
	require.True(t, muted[0].IsMuted())
}

func TestReconcileMuteNodeSeparation(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(7_000_000)
	store := NewMemoryStore()
	registry := testRegistry(testRule("DISK_LOW", VolatilityThreshold))
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	node3 := testEvaluation("DISK_LOW", "disk_free_percent", "node-3", StateFiring, baseTime)
	node5 := testEvaluation("DISK_LOW", "disk_free_percent", "node-5", StateFiring, baseTime)
	_, err := reconciler.Reconcile([]Evaluation{node3, node5})
	require.NoError(t, err)
	require.NoError(t, store.Mute(node3.Fingerprint, "admin-user", baseTime.UnixMilli()))

	visible, err := store.List(model.HealthFindingFilter{})
	require.NoError(t, err)
	require.Len(t, visible, 1)
	require.Equal(t, node5.Fingerprint, visible[0].Fingerprint)
}

func TestReconcileMutedFindingsStillEvaluate(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(8_000_000)
	store := NewMemoryStore()
	registry := testRegistry(testRule("DISK_LOW", VolatilityThreshold))
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	eval := testEvaluation("DISK_LOW", "disk_free_percent", "node-3", StateFiring, baseTime)
	_, err := reconciler.Reconcile([]Evaluation{eval})
	require.NoError(t, err)
	require.NoError(t, store.Mute(eval.Fingerprint, "admin-user", baseTime.UnixMilli()))

	resolvedEval := testEvaluation("DISK_LOW", "disk_free_percent", "node-3", StateResolved, baseTime.Add(time.Hour))
	_, err = reconciler.Reconcile([]Evaluation{resolvedEval})
	require.NoError(t, err)

	stored, err := store.GetByFingerprints([]string{eval.Fingerprint})
	require.NoError(t, err)
	require.Len(t, stored, 1)
	require.True(t, stored[0].IsMuted())
	require.Equal(t, string(StateResolved), stored[0].State)

	require.NoError(t, store.Unmute(eval.Fingerprint))
	unmuted, err := store.List(model.HealthFindingFilter{})
	require.NoError(t, err)
	require.Len(t, unmuted, 1)
	require.Equal(t, eval.Fingerprint, unmuted[0].Fingerprint)
	require.Equal(t, string(StateResolved), unmuted[0].State)
}

func TestReconcilerGCFindingsBoundary(t *testing.T) {
	t.Parallel()

	now := time.UnixMilli(2_000_000_000_000)
	store := NewMemoryStore()
	reconciler := NewReconciler(ReconcilerOpts{
		Store: store,
		Now:   func() time.Time { return now },
	})

	survivor := testPersistedFinding("CHECK_A", "cluster", "", StateFiring, now.Add(-29*24*time.Hour).UnixMilli(), now.Add(-29*24*time.Hour).UnixMilli())
	evicted := testPersistedFinding("CHECK_B", "cluster", "", StateFiring, now.Add(-31*24*time.Hour).UnixMilli(), now.Add(-31*24*time.Hour).UnixMilli())
	require.NoError(t, store.Upsert([]*model.HealthFinding{survivor, evicted}))
	require.NoError(t, store.Mute(survivor.Fingerprint, "admin-user", now.UnixMilli()))
	require.NoError(t, store.Mute(evicted.Fingerprint, "admin-user", now.UnixMilli()))

	deleted, err := reconciler.GCFindings(DefaultMuteRetention)
	require.NoError(t, err)
	require.Equal(t, int64(1), deleted)

	remaining, err := store.GetByFingerprints([]string{survivor.Fingerprint, evicted.Fingerprint})
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	require.Equal(t, survivor.Fingerprint, remaining[0].Fingerprint)
	assert.True(t, remaining[0].IsMuted())
}

func TestReconcilerGCFindingsPreservesActiveMutedFinding(t *testing.T) {
	t.Parallel()

	now := time.UnixMilli(2_000_000_000_000)
	store := NewMemoryStore()
	registry := testRegistry(testRule("DISK_LOW", VolatilityThreshold))
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return now },
	})

	fp := Fingerprint("DISK_LOW", "disk_free_percent", "node-3")
	old := testPersistedFinding("DISK_LOW", "disk_free_percent", "node-3", StateFiring, now.Add(-45*24*time.Hour).UnixMilli(), now.Add(-45*24*time.Hour).UnixMilli())
	require.NoError(t, store.Upsert([]*model.HealthFinding{old}))
	require.NoError(t, store.Mute(fp, "admin-user", now.Add(-45*24*time.Hour).UnixMilli()))

	active := testEvaluation("DISK_LOW", "disk_free_percent", "node-3", StateFiring, now)
	_, err := reconciler.Reconcile([]Evaluation{active})
	require.NoError(t, err)

	deleted, err := reconciler.GCFindings(DefaultMuteRetention)
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)

	remaining, err := store.GetByFingerprints([]string{fp})
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	require.True(t, remaining[0].IsMuted())
	require.Equal(t, now.UnixMilli(), remaining[0].LastSeenAt)
}
