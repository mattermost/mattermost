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

func TestReconcileUnknownTransitions(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(1_000_000)

	testCases := []struct {
		name          string
		initialState  State
		resultState   State
		expectedState State
	}{
		{
			name:          "firing to unknown",
			initialState:  StateFiring,
			resultState:   StateUnknown,
			expectedState: StateUnknown,
		},
		{
			name:          "resolved to unknown",
			initialState:  StateResolved,
			resultState:   StateUnknown,
			expectedState: StateUnknown,
		},
		{
			name:          "unknown to firing",
			initialState:  StateUnknown,
			resultState:   StateFiring,
			expectedState: StateFiring,
		},
		{
			name:          "unknown to resolved",
			initialState:  StateUnknown,
			resultState:   StateResolved,
			expectedState: StateResolved,
		},
		{
			name:          "unknown does not resolve firing",
			initialState:  StateFiring,
			resultState:   StateUnknown,
			expectedState: StateUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			store := NewMemoryStore()
			registry := testRegistry(testRule("CHECK_A", VolatilityStable))
			subject := "cluster"
			scope := ""
			fp := Fingerprint("CHECK_A", subject, scope)

			initial := testPersistedFinding("CHECK_A", subject, scope, tc.initialState, baseTime.Add(-time.Hour).UnixMilli(), baseTime.Add(-time.Hour).UnixMilli())
			require.NoError(t, store.Upsert([]*model.HealthFinding{initial}))

			reconciler := NewReconciler(ReconcilerOpts{
				Store:    store,
				Registry: registry,
				Now:      func() time.Time { return baseTime },
			})

			eval := testEvaluation("CHECK_A", subject, scope, tc.resultState, baseTime)
			transitions, err := reconciler.Reconcile([]Evaluation{eval})
			require.NoError(t, err)
			require.Len(t, transitions, 1)
			require.Equal(t, tc.initialState, transitions[0].From)
			require.Equal(t, tc.expectedState, transitions[0].To)

			updated, err := store.GetByFingerprints([]string{fp})
			require.NoError(t, err)
			require.Len(t, updated, 1)
			require.Equal(t, string(tc.expectedState), updated[0].State)
			require.Equal(t, baseTime.UnixMilli(), updated[0].StateSince)
		})
	}
}

func TestReconcileSuppressesDependentUnknowns(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(2_000_000)
	store := NewMemoryStore()
	registry := testRegistry(
		testRule("CHECK_NODE_DOWN", VolatilityTopology),
		testRule("CHECK_NODE_RESOURCE", VolatilityStable),
	)
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	nodeDown := testEvaluation("CHECK_NODE_DOWN", "cluster", "", StateFiring, baseTime)
	nodeDown.Result = nodeDown.Result.WithDetail(detailKeyUnreachableNode, "node-3")

	unknownNode3 := testEvaluation("CHECK_NODE_RESOURCE", "disk", "node-3", StateUnknown, baseTime)

	transitions, err := reconciler.Reconcile([]Evaluation{nodeDown, unknownNode3})
	require.NoError(t, err)
	require.Len(t, transitions, 1)

	fpNode3 := Fingerprint("CHECK_NODE_RESOURCE", "disk", "node-3")
	gotNode3, err := store.GetByFingerprints([]string{fpNode3})
	require.NoError(t, err)
	require.Len(t, gotNode3, 0)
}

func TestReconcileDoesNotAgeDependentsOfUnreachableNode(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(2_500_000)
	staleLastSeen := baseTime.Add(-3 * time.Hour).UnixMilli()

	store := NewMemoryStore()
	registry := testRegistry(
		testRule("CHECK_NODE_DOWN", VolatilityTopology),
		testRule("CHECK_NODE_RESOURCE", VolatilityStable),
	)

	// The dependent finding predates the outage and is already past its UnknownAfter window, so
	// step 4 would age it if the unreachable scope did not exempt it.
	dependent := testPersistedFinding("CHECK_NODE_RESOURCE", "disk", "node-3", StateFiring, staleLastSeen, staleLastSeen)
	require.NoError(t, store.Upsert([]*model.HealthFinding{dependent}))

	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	nodeDown := testEvaluation("CHECK_NODE_DOWN", "cluster", "", StateFiring, baseTime)
	nodeDown.Result = nodeDown.Result.WithDetail(detailKeyUnreachableNode, "node-3")

	// The node-scoped check emits nothing while node-3 is unreachable; only the node-down eval arrives.
	transitions, err := reconciler.Reconcile([]Evaluation{nodeDown})
	require.NoError(t, err)
	require.Len(t, transitions, 1)
	require.Equal(t, "CHECK_NODE_DOWN", transitions[0].Finding.Code)

	fpDependent := Fingerprint("CHECK_NODE_RESOURCE", "disk", "node-3")
	got, err := store.GetByFingerprints([]string{fpDependent})
	require.NoError(t, err)
	require.Len(t, got, 1)
	require.Equal(t, string(StateFiring), got[0].State)
	require.Equal(t, staleLastSeen, got[0].StateSince)
}

func TestReconcileStateSinceUnchangedOnSameState(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(3_000_000)
	previousStateSince := baseTime.Add(-2 * time.Hour).UnixMilli()
	previousLastSeen := baseTime.Add(-time.Hour).UnixMilli()

	store := NewMemoryStore()
	registry := testRegistry(testRule("CHECK_A", VolatilityStable))
	initial := testPersistedFinding("CHECK_A", "cluster", "", StateFiring, previousLastSeen, previousStateSince)
	require.NoError(t, store.Upsert([]*model.HealthFinding{initial}))

	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})
	transitions, err := reconciler.Reconcile([]Evaluation{
		testEvaluation("CHECK_A", "cluster", "", StateFiring, baseTime),
	})
	require.NoError(t, err)
	require.Len(t, transitions, 0)

	fp := Fingerprint("CHECK_A", "cluster", "")
	updated, err := store.GetByFingerprints([]string{fp})
	require.NoError(t, err)
	require.Len(t, updated, 1)
	require.Equal(t, previousStateSince, updated[0].StateSince)
	require.Equal(t, baseTime.UnixMilli(), updated[0].LastSeenAt)
}

func TestReconcileAgesAbsentFindingsToUnknown(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(4_000_000)
	store := NewMemoryStore()
	registry := testRegistry(
		testRule("CHECK_PRESENT", VolatilityStable),
		testRule("CHECK_ABSENT", VolatilityStable),
	)

	present := testPersistedFinding("CHECK_PRESENT", "cluster", "", StateFiring, baseTime.Add(-2*time.Hour).UnixMilli(), baseTime.Add(-2*time.Hour).UnixMilli())
	absent := testPersistedFinding("CHECK_ABSENT", "cluster", "", StateFiring, baseTime.Add(-2*time.Hour).UnixMilli(), baseTime.Add(-2*time.Hour).UnixMilli())
	require.NoError(t, store.Upsert([]*model.HealthFinding{present, absent}))

	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})

	transitions, err := reconciler.Reconcile([]Evaluation{
		testEvaluation("CHECK_PRESENT", "cluster", "", StateFiring, baseTime),
	})
	require.NoError(t, err)
	require.Len(t, transitions, 1)
	require.Equal(t, StateFiring, transitions[0].From)
	require.Equal(t, StateUnknown, transitions[0].To)

	absentFingerprint := Fingerprint("CHECK_ABSENT", "cluster", "")
	updated, err := store.GetByFingerprints([]string{absentFingerprint})
	require.NoError(t, err)
	require.Len(t, updated, 1)
	require.Equal(t, string(StateUnknown), updated[0].State)
	require.Equal(t, baseTime.UnixMilli(), updated[0].StateSince)
	require.Equal(t, baseTime.Add(-2*time.Hour).UnixMilli(), updated[0].LastSeenAt)
}

func TestReconcileRestartDurability(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(5_000_000)
	store := NewMemoryStore()
	registry := testRegistry(testRule("CHECK_A", VolatilityStable))

	first := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime },
	})
	eval := testEvaluation("CHECK_A", "cluster", "", StateFiring, baseTime)
	transitions, err := first.Reconcile([]Evaluation{eval})
	require.NoError(t, err)
	require.Len(t, transitions, 1)

	second := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime.Add(time.Minute) },
	})
	transitions, err = second.Reconcile([]Evaluation{eval})
	require.NoError(t, err)
	require.Len(t, transitions, 0)
}

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

	deleted, err := reconciler.GCFindings(DefaultFindingRetention)
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

	deleted, err := reconciler.GCFindings(DefaultFindingRetention)
	require.NoError(t, err)
	require.Equal(t, int64(0), deleted)

	remaining, err := store.GetByFingerprints([]string{fp})
	require.NoError(t, err)
	require.Len(t, remaining, 1)
	require.True(t, remaining[0].IsMuted())
	require.Equal(t, now.UnixMilli(), remaining[0].LastSeenAt)
}

func testRegistry(rules ...Rule) *Registry {
	registry := NewRegistry()
	registry.Register(rules...)
	return registry
}

func testRule(code string, volatility Volatility) Rule {
	return Rule{
		Code:       code,
		Area:       model.AreaCluster,
		Severity:   SeverityWarning,
		Surface:    SurfaceProduct,
		Volatility: volatility,
		Subject:    "cluster",
	}
}

func testEvaluation(code, subject, scope string, state State, evaluatedAt time.Time) Evaluation {
	result := Result{
		State:   state,
		Subject: subject,
		Scope:   scope,
	}
	return Evaluation{
		Code:        code,
		Result:      result,
		Fingerprint: Fingerprint(code, subject, scope),
		EvaluatedAt: evaluatedAt,
	}
}

func testPersistedFinding(code, subject, scope string, state State, lastSeenAt, stateSince int64) *model.HealthFinding {
	return &model.HealthFinding{
		Fingerprint: Fingerprint(code, subject, scope),
		Code:        code,
		Subject:     subject,
		Scope:       scope,
		Severity:    string(SeverityWarning),
		State:       string(state),
		Area:        model.AreaCluster,
		Surface:     string(SurfaceProduct),
		FirstSeenAt: lastSeenAt,
		LastSeenAt:  lastSeenAt,
		StateSince:  stateSince,
	}
}
