// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"
	"time"

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
