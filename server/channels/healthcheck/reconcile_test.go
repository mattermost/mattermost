// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const testNow = int64(1_700_000_000_000) // arbitrary fixed timestamp

func stableRule(code string) Rule {
	return Rule{Code: code, Volatility: VolatilityStable}
}

func probeRule(code string) Rule {
	return Rule{Code: code, Volatility: VolatilityProbe}
}

func rulesMap(rules ...Rule) map[string]Rule {
	m := make(map[string]Rule, len(rules))
	for _, r := range rules {
		m[r.Code] = r
	}
	return m
}

func firingOutcome(code string) EvalOutcome {
	f := &Finding{Code: code, RuleCode: code}
	return EvalOutcome{RuleCode: code, Fingerprint: code, State: FindingStateFiring, Finding: f}
}

func resolvedOutcome(code string) EvalOutcome {
	return EvalOutcome{RuleCode: code, Fingerprint: code, State: FindingStateResolved}
}

func unknownOutcome(code string) EvalOutcome {
	return EvalOutcome{RuleCode: code, Fingerprint: code, State: FindingStateUnknown}
}

// findRecord returns the first record with the given fingerprint from a slice.
func findRecord(records []FindingRecord, fp string) (FindingRecord, bool) {
	for _, r := range records {
		if r.Fingerprint == fp {
			return r, true
		}
	}
	return FindingRecord{}, false
}

// ---------------------------------------------------------------------------
// Stable volatility class
// ---------------------------------------------------------------------------

func TestReconcile_Stable_FirstFiring(t *testing.T) {
	outcomes := []EvalOutcome{firingOutcome("X")}
	result := Reconcile(outcomes, nil, rulesMap(stableRule("X")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, "X", rec.Fingerprint)
	assert.Equal(t, FindingStateFiring, rec.State)
	assert.Equal(t, testNow, rec.FirstFiredAt)
	assert.Equal(t, testNow, rec.LastFiredAt)
	assert.Equal(t, 1, rec.ConsecutiveFailures)
}

func TestReconcile_Stable_StaysFiring(t *testing.T) {
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateFiring, FirstFiredAt: testNow - 1000, LastFiredAt: testNow - 1000, ConsecutiveFailures: 1},
	}
	outcomes := []EvalOutcome{firingOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateFiring, rec.State)
	assert.Equal(t, testNow-1000, rec.FirstFiredAt, "FirstFiredAt must not change once set")
	assert.Equal(t, testNow, rec.LastFiredAt, "LastFiredAt updates each cycle")
}

func TestReconcile_Stable_Resolves(t *testing.T) {
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateFiring, FirstFiredAt: testNow - 1000, LastFiredAt: testNow - 1000, ConsecutiveFailures: 1},
	}
	outcomes := []EvalOutcome{resolvedOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateResolved, rec.State)
	assert.Equal(t, 0, rec.ConsecutiveFailures, "counter resets on resolve")
	assert.Equal(t, testNow, rec.ResolvedAt)
}

func TestReconcile_Stable_ResolvedWithNoPriorRow_NoRecord(t *testing.T) {
	// A rule that has never fired and evaluates false → no row created.
	outcomes := []EvalOutcome{resolvedOutcome("X")}
	result := Reconcile(outcomes, nil, rulesMap(stableRule("X")), testNow)

	assert.Empty(t, result.Updated, "resolved with no prior row must not create a record")
	assert.Empty(t, result.Unchanged)
}

func TestReconcile_Stable_AlreadyResolved_NoChange(t *testing.T) {
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateResolved, ResolvedAt: testNow - 1000},
	}
	outcomes := []EvalOutcome{resolvedOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	assert.Empty(t, result.Updated)
	require.Len(t, result.Unchanged, 1)
	assert.Equal(t, FindingStateResolved, result.Unchanged[0].State)
}

// ---------------------------------------------------------------------------
// Probe volatility class (consecutive-failure debounce)
// ---------------------------------------------------------------------------

func TestReconcile_Probe_FiresBelowThreshold_Unknown(t *testing.T) {
	// First failure: counter=1, below debounceProbe=2 → state=unknown.
	outcomes := []EvalOutcome{firingOutcome("P")}
	result := Reconcile(outcomes, nil, rulesMap(probeRule("P")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateUnknown, rec.State, "below debounce threshold must be unknown")
	assert.Equal(t, 1, rec.ConsecutiveFailures)
}

func TestReconcile_Probe_FiresAtThreshold(t *testing.T) {
	// Second failure: counter reaches debounceProbe=2 → state=firing.
	prior := map[string]FindingRecord{
		"P": {Fingerprint: "P", RuleCode: "P", State: FindingStateUnknown, ConsecutiveFailures: 1},
	}
	outcomes := []EvalOutcome{firingOutcome("P")}
	result := Reconcile(outcomes, prior, rulesMap(probeRule("P")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateFiring, rec.State)
	assert.Equal(t, 2, rec.ConsecutiveFailures)
	assert.Equal(t, testNow, rec.FirstFiredAt)
	assert.Equal(t, testNow, rec.LastFiredAt)
}

func TestReconcile_Probe_Unknown_CounterUnchanged(t *testing.T) {
	// Unknown outcome during debounce: counter must NOT change.
	prior := map[string]FindingRecord{
		"P": {Fingerprint: "P", RuleCode: "P", State: FindingStateUnknown, ConsecutiveFailures: 1},
	}
	outcomes := []EvalOutcome{unknownOutcome("P")}
	result := Reconcile(outcomes, prior, rulesMap(probeRule("P")), testNow)

	assert.Empty(t, result.Updated)
	require.Len(t, result.Unchanged, 1)
	assert.Equal(t, 1, result.Unchanged[0].ConsecutiveFailures, "unknown must not change the counter")
}

func TestReconcile_Probe_ResolvesResetCounter(t *testing.T) {
	prior := map[string]FindingRecord{
		"P": {Fingerprint: "P", RuleCode: "P", State: FindingStateFiring, ConsecutiveFailures: 3, FirstFiredAt: testNow - 5000, LastFiredAt: testNow - 100},
	}
	outcomes := []EvalOutcome{resolvedOutcome("P")}
	result := Reconcile(outcomes, prior, rulesMap(probeRule("P")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateResolved, rec.State)
	assert.Equal(t, 0, rec.ConsecutiveFailures, "counter resets on resolve")
	assert.Equal(t, testNow, rec.ResolvedAt)
}

func TestReconcile_Probe_RefiresAfterResolve(t *testing.T) {
	// After a resolve, a new run of failures must start the counter from scratch.
	prior := map[string]FindingRecord{
		"P": {Fingerprint: "P", RuleCode: "P", State: FindingStateResolved, ConsecutiveFailures: 0, FirstFiredAt: testNow - 5000, ResolvedAt: testNow - 100},
	}
	// First failure after resolve: counter becomes 1, below threshold → unknown.
	outcomes := []EvalOutcome{firingOutcome("P")}
	result := Reconcile(outcomes, prior, rulesMap(probeRule("P")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateUnknown, rec.State)
	assert.Equal(t, 1, rec.ConsecutiveFailures)
}

// ---------------------------------------------------------------------------
// Unknown outcome — state preservation
// ---------------------------------------------------------------------------

func TestReconcile_Unknown_NoPrior_NoRecord(t *testing.T) {
	// Unknown with no prior row → nothing persisted.
	outcomes := []EvalOutcome{unknownOutcome("X")}
	result := Reconcile(outcomes, nil, rulesMap(stableRule("X")), testNow)

	assert.Empty(t, result.Updated)
	assert.Empty(t, result.Unchanged)
}

func TestReconcile_Unknown_WithPrior_Preserved(t *testing.T) {
	// Unknown with a prior firing row → row preserved unchanged.
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateFiring, ConsecutiveFailures: 2},
	}
	outcomes := []EvalOutcome{unknownOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	assert.Empty(t, result.Updated, "unknown must not change the record")
	require.Len(t, result.Unchanged, 1)
	assert.Equal(t, FindingStateFiring, result.Unchanged[0].State, "prior state must be preserved")
}

// ---------------------------------------------------------------------------
// Mute persistence
// ---------------------------------------------------------------------------

func TestReconcile_MutePersistedAcrossResolve(t *testing.T) {
	// Per decision #6: mute is NOT cleared when a finding resolves.
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateFiring, MutedAt: testNow - 1000, MutedByUserID: "user1"},
	}
	outcomes := []EvalOutcome{resolvedOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, testNow-1000, rec.MutedAt, "mute must persist through resolve")
	assert.Equal(t, "user1", rec.MutedByUserID)
}

func TestReconcile_MutePersistedOnRefire(t *testing.T) {
	// Muted finding re-fires (same fingerprint) → mute remains.
	prior := map[string]FindingRecord{
		"X": {Fingerprint: "X", RuleCode: "X", State: FindingStateResolved, MutedAt: testNow - 1000, MutedByUserID: "user1"},
	}
	outcomes := []EvalOutcome{firingOutcome("X")}
	result := Reconcile(outcomes, prior, rulesMap(stableRule("X")), testNow)

	require.Len(t, result.Updated, 1)
	rec := result.Updated[0]
	assert.Equal(t, FindingStateFiring, rec.State)
	assert.Equal(t, testNow-1000, rec.MutedAt, "mute survives refire of same fingerprint")
}

// ---------------------------------------------------------------------------
// Multi-rule / multi-fingerprint scenarios
// ---------------------------------------------------------------------------

func TestReconcile_MultiRule_IndependentTransitions(t *testing.T) {
	rules := rulesMap(stableRule("A"), probeRule("B"), stableRule("C"))
	prior := map[string]FindingRecord{
		"A": {Fingerprint: "A", RuleCode: "A", State: FindingStateFiring, ConsecutiveFailures: 1},
		"C": {Fingerprint: "C", RuleCode: "C", State: FindingStateFiring, ConsecutiveFailures: 1},
	}
	outcomes := []EvalOutcome{
		resolvedOutcome("A"),
		firingOutcome("B"), // new probe rule, first fire
		firingOutcome("C"), // still firing
	}

	result := Reconcile(outcomes, prior, rules, testNow)

	updated := make(map[string]FindingRecord)
	for _, r := range result.Updated {
		updated[r.Fingerprint] = r
	}

	// A: resolved
	aRec, ok := updated["A"]
	require.True(t, ok)
	assert.Equal(t, FindingStateResolved, aRec.State)

	// B: first fire, below probe threshold → unknown
	bRec, ok := updated["B"]
	require.True(t, ok)
	assert.Equal(t, FindingStateUnknown, bRec.State)
	assert.Equal(t, 1, bRec.ConsecutiveFailures)

	// C: stays firing
	cRec, ok := updated["C"]
	require.True(t, ok)
	assert.Equal(t, FindingStateFiring, cRec.State)
}

// ---------------------------------------------------------------------------
// EvaluateAll integration — ensures engine and reconciler connect correctly
// ---------------------------------------------------------------------------

func TestEvaluateAll_ThreeValuedOutput(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	// Trigger one rule (PUSH_EMPTY_URL).
	*cfg.EmailSettings.SendPushNotifications = true
	*cfg.EmailSettings.PushNotificationServer = ""
	// SiteURL is set by SetDefaults(), so CORE_SITE_URL_EMPTY won't fire.
	// Probes not collected this cycle.
	snap := &Snapshot{Config: cfg, Probes: nil}

	outcomes := engine.EvaluateAll(snap)

	byCode := make(map[string]EvalOutcome, len(outcomes))
	for _, o := range outcomes {
		byCode[o.RuleCode] = o
	}

	// PUSH_EMPTY_URL must be firing.
	push, ok := byCode["PUSH_EMPTY_URL"]
	require.True(t, ok)
	assert.Equal(t, FindingStateFiring, push.State)
	assert.NotNil(t, push.Finding)

	// DB_HEALTHCHECK_FAIL is a probe rule and probe is nil → unknown.
	probe, ok := byCode["DB_HEALTHCHECK_FAIL"]
	require.True(t, ok)
	assert.Equal(t, FindingStateUnknown, probe.State)

	// A non-firing config rule must be resolved.
	logDebug, ok := byCode["LOG_DEBUG_PROD"]
	require.True(t, ok)
	// SetDefaults sets FileLevel=INFO, so LOG_DEBUG_PROD should be resolved.
	assert.Equal(t, FindingStateResolved, logDebug.State)
}
