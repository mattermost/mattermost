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
			transitions, err := reconciler.Reconcile([]Evaluation{eval}, nil)
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

	transitions, err := reconciler.Reconcile([]Evaluation{nodeDown, unknownNode3}, []string{"node-3"})
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
	transitions, err := reconciler.Reconcile([]Evaluation{nodeDown}, []string{"node-3"})
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
	}, nil)
	require.NoError(t, err)
	require.Len(t, transitions, 0)

	fp := Fingerprint("CHECK_A", "cluster", "")
	updated, err := store.GetByFingerprints([]string{fp})
	require.NoError(t, err)
	require.Len(t, updated, 1)
	require.Equal(t, previousStateSince, updated[0].StateSince)
	require.Equal(t, baseTime.UnixMilli(), updated[0].LastSeenAt)
}

func TestReconcileSkipsNeverFiredResolved(t *testing.T) {
	t.Parallel()

	baseTime := time.UnixMilli(3_500_000)
	store := NewMemoryStore()
	reconciler := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: testRegistry(testRule("CHECK_PASSING", VolatilityStable), testRule("CHECK_FIRING", VolatilityStable)),
		Now:      func() time.Time { return baseTime },
	})

	firing := testEvaluation("CHECK_FIRING", "cluster", "", StateFiring, baseTime)
	transitions, err := reconciler.Reconcile([]Evaluation{
		testEvaluation("CHECK_PASSING", "cluster", "", StateResolved, baseTime),
		firing,
	}, nil)
	require.NoError(t, err)
	require.Len(t, transitions, 1)
	assert.Equal(t, firing.Fingerprint, transitions[0].Finding.Fingerprint)

	stored, err := store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
	require.NoError(t, err)
	require.Len(t, stored, 1)
	assert.Equal(t, firing.Fingerprint, stored[0].Fingerprint)
	assert.Equal(t, string(StateFiring), stored[0].State)
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
	}, nil)
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
	transitions, err := first.Reconcile([]Evaluation{eval}, nil)
	require.NoError(t, err)
	require.Len(t, transitions, 1)

	second := NewReconciler(ReconcilerOpts{
		Store:    store,
		Registry: registry,
		Now:      func() time.Time { return baseTime.Add(time.Minute) },
	})
	transitions, err = second.Reconcile([]Evaluation{eval}, nil)
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
	_, err := reconciler.Reconcile([]Evaluation{emptyURL}, nil)
	require.NoError(t, err)
	require.NoError(t, store.Mute(emptyURL.Fingerprint, "admin-user", baseTime.UnixMilli()))

	httpURL := testEvaluation("PUSH_BAD_SCHEME", "config.push_notification_server", "", StateFiring, baseTime.Add(time.Minute))
	_, err = reconciler.Reconcile([]Evaluation{httpURL}, nil)
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
	_, err := reconciler.Reconcile([]Evaluation{node3, node5}, []string{"node-3", "node-5"})
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
	_, err := reconciler.Reconcile([]Evaluation{eval}, []string{"node-3"})
	require.NoError(t, err)
	require.NoError(t, store.Mute(eval.Fingerprint, "admin-user", baseTime.UnixMilli()))

	resolvedEval := testEvaluation("DISK_LOW", "disk_free_percent", "node-3", StateResolved, baseTime.Add(time.Hour))
	_, err = reconciler.Reconcile([]Evaluation{resolvedEval}, []string{"node-3"})
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
	_, err := reconciler.Reconcile([]Evaluation{active}, []string{"node-3"})
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

const diskLowMessage = "health.rule.disk_low.message"

var (
	diskLowRule = nodeRule("DISK_LOW", func(n *NodeSnapshot) Result {
		if _, ok := n.Diag(); !ok {
			return Unknown(ReasonDiagnosticsUnavailable)
		}
		return FiringSubject("disk_free_percent", diskLowMessage).WithDetail("free_percent", "3")
	})
	nodeDownRule = nodeRule("NODE_DOWN", func(n *NodeSnapshot) Result {
		if n.CollectErr == nil {
			return Resolved()
		}
		return Firing("health.rule.node_down.message").WithUnreachableNode(n.Hostname)
	})
)

func nodeRule(code string, check func(*NodeSnapshot) Result) Rule {
	rule := testRule(code, VolatilityThreshold)
	rule.EvalNode = SingleNode(func(_ *Snapshot, n *NodeSnapshot) Result { return check(n) })
	return rule
}

func replyingNode(hostname string) *NodeSnapshot {
	return &NodeSnapshot{Hostname: hostname, Diagnostics: &model.NodeDiagnostics{Diagnostics: &model.SupportPacketDiagnostics{}}}
}

// healthRuns drives the engine and reconciler over one store the way a health check job does,
// with a clock tests move between runs.
type healthRuns struct {
	store      FindingStore
	engine     *Engine
	reconciler *Reconciler
	now        time.Time
}

func newHealthRuns(start time.Time, rules ...Rule) *healthRuns {
	h := &healthRuns{store: NewMemoryStore(), now: start}
	registry := testRegistry(rules...)
	clock := func() time.Time { return h.now }
	h.engine = NewEngine(EngineOpts{Registry: registry, Now: clock})
	h.reconciler = NewReconciler(ReconcilerOpts{Store: h.store, Registry: registry, Now: clock})
	return h
}

func (h *healthRuns) run(t *testing.T, at time.Time, nodes ...*NodeSnapshot) []Transition {
	t.Helper()
	h.now = at
	snapshot := NewSnapshot(nodes)
	transitions, err := h.reconciler.Reconcile(h.engine.Evaluate(snapshot), snapshot.Hostnames())
	require.NoError(t, err)
	return transitions
}

func (h *healthRuns) finding(t *testing.T, fingerprint string) *model.HealthFinding {
	t.Helper()
	found, err := h.store.GetByFingerprints([]string{fingerprint})
	require.NoError(t, err)
	require.Len(t, found, 1)
	return found[0]
}

func requireNodeLeft(t *testing.T, finding *model.HealthFinding) {
	t.Helper()
	assert.Equal(t, string(StateResolved), finding.State)
	assert.Equal(t, MessageNodeLeft, finding.MessageID)
	assert.Equal(t, model.HealthFindingResolvedReasonNodeLeft, finding.Details[model.HealthFindingDetailResolvedReason])
}

func transitionFor(transitions []Transition, fingerprint string) *Transition {
	for i := range transitions {
		if transitions[i].Finding.Fingerprint == fingerprint {
			return &transitions[i]
		}
	}
	return nil
}

func TestReconcileRetiresFindingsOfRenamedNode(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(10_000_000)
	h := newHealthRuns(t0, diskLowRule)
	oldHost := Fingerprint("DISK_LOW", "disk_free_percent", "mattermost-7d9f8c6b5-x2k4q")
	newHost := Fingerprint("DISK_LOW", "disk_free_percent", "mattermost-7d9f8c6b5-q8z3m")

	h.run(t, t0, replyingNode("mattermost-7d9f8c6b5-x2k4q"))

	// Well past UnknownAfter, which would otherwise age the old pod's finding to unknown.
	renamedAt := t0.Add(3 * time.Hour)
	transitions := h.run(t, renamedAt, replyingNode("mattermost-7d9f8c6b5-q8z3m"))

	retired := transitionFor(transitions, oldHost)
	require.NotNil(t, retired)
	assert.Equal(t, StateFiring, retired.From)
	assert.Equal(t, StateResolved, retired.To)

	old := h.finding(t, oldHost)
	requireNodeLeft(t, old)
	assert.Equal(t, "3", old.Details["free_percent"])
	assert.Equal(t, renamedAt.UnixMilli(), old.StateSince)
	assert.Equal(t, t0.UnixMilli(), old.LastSeenAt, "retention counts from when the node was last evaluated")
	assert.Equal(t, string(StateFiring), h.finding(t, newHost).State)

	transitions = h.run(t, renamedAt.Add(time.Hour), replyingNode("mattermost-7d9f8c6b5-q8z3m"))
	assert.Nil(t, transitionFor(transitions, oldHost), "a finding already resolved for a node that left does not transition again")
	old = h.finding(t, oldHost)
	requireNodeLeft(t, old)
	assert.Equal(t, renamedAt.UnixMilli(), old.StateSince)
}

func TestReconcileRetiresFindingsOfRemovedClusterNode(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(20_000_000)
	clusterRule := testRule("CLUSTER_CHECK", VolatilityStable)
	h := newHealthRuns(t0, diskLowRule, clusterRule)
	clusterWide := testPersistedFinding("CLUSTER_CHECK", "cluster", "", StateFiring, t0.UnixMilli(), t0.UnixMilli())
	require.NoError(t, h.store.Upsert([]*model.HealthFinding{clusterWide}))

	h.run(t, t0, replyingNode("app-1"), replyingNode("app-2"))
	h.run(t, t0.Add(3*time.Hour), replyingNode("app-1"))

	requireNodeLeft(t, h.finding(t, Fingerprint("DISK_LOW", "disk_free_percent", "app-2")))
	assert.Equal(t, string(StateFiring), h.finding(t, Fingerprint("DISK_LOW", "disk_free_percent", "app-1")).State)

	cluster := h.finding(t, clusterWide.Fingerprint)
	assert.Equal(t, string(StateUnknown), cluster.State, "a cluster-wide finding still ages to unknown")
	assert.Empty(t, cluster.Details[model.HealthFindingDetailResolvedReason])
}

func TestReconcileNodeReturningUnderSameHostnameFiresAgainMuted(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(30_000_000)
	h := newHealthRuns(t0, diskLowRule)
	app2 := Fingerprint("DISK_LOW", "disk_free_percent", "app-2")

	h.run(t, t0, replyingNode("app-1"), replyingNode("app-2"))
	require.NoError(t, h.store.Mute(app2, "admin-user", t0.UnixMilli()))

	h.run(t, t0.Add(time.Hour), replyingNode("app-1"))
	left := h.finding(t, app2)
	requireNodeLeft(t, left)
	assert.True(t, left.IsMuted(), "resolving a finding for a node that left keeps its mute")

	returnedAt := t0.Add(2 * time.Hour)
	transitions := h.run(t, returnedAt, replyingNode("app-1"), replyingNode("app-2"))

	refired := transitionFor(transitions, app2)
	require.NotNil(t, refired)
	assert.Equal(t, StateResolved, refired.From)
	assert.Equal(t, StateFiring, refired.To)

	back := h.finding(t, app2)
	assert.Equal(t, string(StateFiring), back.State)
	assert.Equal(t, diskLowMessage, back.MessageID)
	assert.NotContains(t, back.Details, model.HealthFindingDetailResolvedReason)
	assert.True(t, back.IsMuted())
	assert.Equal(t, returnedAt.UnixMilli(), back.StateSince)
}

func TestReconcileKeepsFindingsOfRegisteredNodeThatDoesNotReply(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(40_000_000)
	app2Disk := Fingerprint("DISK_LOW", "disk_free_percent", "app-2")

	t.Run("listed under its own hostname", func(t *testing.T) {
		t.Parallel()

		h := newHealthRuns(t0, diskLowRule, nodeDownRule)
		h.run(t, t0, replyingNode("app-1"), replyingNode("app-2"))
		h.run(t, t0.Add(3*time.Hour), replyingNode("app-1"), &NodeSnapshot{Hostname: "app-2", CollectErr: ErrNodeNoReply})

		disk := h.finding(t, app2Disk)
		assert.Equal(t, string(StateFiring), disk.State)
		assert.Equal(t, t0.UnixMilli(), disk.StateSince)
		assert.Equal(t, diskLowMessage, disk.MessageID)
		assert.Equal(t, string(StateFiring), h.finding(t, Fingerprint("NODE_DOWN", "cluster", "app-2")).State)
	})

	// Out of the memberlist, a node is known only from its cluster discovery row, by address.
	t.Run("listed under its cluster discovery address", func(t *testing.T) {
		t.Parallel()

		h := newHealthRuns(t0, diskLowRule, nodeDownRule)
		h.run(t, t0, replyingNode("app-1"), replyingNode("app-2"))
		h.run(t, t0.Add(30*time.Minute), replyingNode("app-1"), &NodeSnapshot{Hostname: "10.0.0.5:8075", CollectErr: ErrNodeNoReply})

		disk := h.finding(t, app2Disk)
		assert.Equal(t, string(StateFiring), disk.State)
		assert.Equal(t, t0.UnixMilli(), disk.StateSince)
		assert.NotContains(t, disk.Details, model.HealthFindingDetailResolvedReason)
	})
}

func TestReconcileRetiresUnknownButNotResolvedFindingsOfNodesThatLeft(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(50_000_000)
	h := newHealthRuns(t0, diskLowRule, testRule("MEMORY_LOW", VolatilityThreshold))
	lastSeen := t0.Add(-3 * time.Hour).UnixMilli()
	unknown := testPersistedFinding("DISK_LOW", "disk_free_percent", "gone-host", StateUnknown, lastSeen, lastSeen)
	resolved := testPersistedFinding("MEMORY_LOW", "memory", "gone-host", StateResolved, lastSeen, lastSeen)
	require.NoError(t, h.store.Upsert([]*model.HealthFinding{unknown, resolved}))

	transitions := h.run(t, t0, replyingNode("app-1"))

	retired := transitionFor(transitions, unknown.Fingerprint)
	require.NotNil(t, retired)
	assert.Equal(t, StateUnknown, retired.From)
	retiredFinding := h.finding(t, unknown.Fingerprint)
	requireNodeLeft(t, retiredFinding)
	assert.Equal(t, lastSeen, retiredFinding.LastSeenAt)

	assert.Nil(t, transitionFor(transitions, resolved.Fingerprint))
	stillResolved := h.finding(t, resolved.Fingerprint)
	assert.Equal(t, string(StateResolved), stillResolved.State)
	assert.Equal(t, lastSeen, stillResolved.StateSince)
	assert.Empty(t, stillResolved.MessageID)
}

func TestReconcileRetiresNothingWhenANodeHasNoHostname(t *testing.T) {
	t.Parallel()

	t0 := time.UnixMilli(60_000_000)
	h := newHealthRuns(t0, diskLowRule)
	known := Fingerprint("DISK_LOW", "disk_free_percent", "mm.example.com")

	h.run(t, t0, replyingNode("mm.example.com"))
	transitions := h.run(t, t0.Add(time.Hour), &NodeSnapshot{})

	assert.Nil(t, transitionFor(transitions, known))
	finding := h.finding(t, known)
	assert.Equal(t, string(StateFiring), finding.State)
	assert.Equal(t, diskLowMessage, finding.MessageID)

	h.run(t, t0.Add(3*time.Hour), &NodeSnapshot{})
	assert.Equal(t, string(StateUnknown), h.finding(t, known).State, "without a hostname to compare, the finding ages as before")
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
