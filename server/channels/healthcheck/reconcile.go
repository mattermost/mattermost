// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

// FindingRecord is the persisted state of a single finding, keyed by
// Fingerprint. It is the in-memory representation of one row in the
// HealthCheckFindings table.
type FindingRecord struct {
	// Fingerprint is the stable, unique key for this finding instance.
	// For P1 it equals the rule code. Future rules with multiple instances
	// (per-plugin, per-replica) will set a distinct fingerprint per instance.
	Fingerprint string
	// RuleCode is the rule that produced this finding.
	RuleCode string
	// State is the current state-machine state.
	State FindingState

	// FirstFiredAt is the Unix-ms timestamp when the finding first entered
	// the firing state.
	FirstFiredAt int64
	// LastFiredAt is the Unix-ms timestamp of the most recent evaluation cycle
	// in which the rule was firing.
	LastFiredAt int64
	// ResolvedAt is the Unix-ms timestamp when the finding last transitioned
	// to resolved. Zero if never resolved.
	ResolvedAt int64

	// ConsecutiveFailures counts how many consecutive evaluation cycles
	// produced a firing outcome (for probe-class debounce).
	// Reset to 0 on resolved. Not modified on unknown.
	ConsecutiveFailures int

	// MutedAt is the Unix-ms timestamp when the finding was muted.
	// Zero means not muted. Mute persists across resolve→refire per decision #6.
	MutedAt int64
	// MutedByUserID is the user ID that muted the finding. Empty when not muted.
	MutedByUserID string
}

// debounce thresholds per volatility class. These are the minimum number of
// consecutive firing outcomes before a rule enters FindingStateFiring in the
// store.
//
// Values are deliberately small (chosen for testability and initial
// conservatism). The "real" per-class values are a parked build detail —
// adjust once false-positive data from P1 soak is available.
const (
	debounceProbe             = 2 // probe rules fire after 2 consecutive failures
	debounceClusterMembership = 3
)

// ReconcileResult holds the full outcome of one reconcile call.
type ReconcileResult struct {
	// Updated contains all records that changed state or counters this cycle.
	Updated []FindingRecord
	// Unchanged contains records that required no change this cycle.
	Unchanged []FindingRecord
}

// Reconcile applies one evaluation cycle's outcomes to the prior persisted
// state and returns updated records. It is a pure function: no I/O, no
// time.Now(). The caller injects nowMS (Unix milliseconds) and provides the
// prior state as a fingerprint-keyed map.
//
// State-machine transitions per volatility class:
//
//	stable:            firing → immediate FireState; false → immediate resolved.
//	probe:             firing → increment ConsecutiveFailures; fires at ≥ debounceProbe.
//	                   resolved → immediate resolved + reset counter.
//	                   unknown  → counter unchanged, state unchanged.
//	cluster_membership: same as probe with debounceClusterMembership threshold.
//	boundary/feed:     treated as stable for now (no rules exercise them in P1).
//	any:               unknown → state unchanged, counter unchanged.
//
// "Resolved only applies to fingerprints with a prior row" means: if a
// fingerprint has no prior record and the outcome is resolved/unknown, no new
// row is created.
func Reconcile(
	outcomes []EvalOutcome,
	prior map[string]FindingRecord,
	rules map[string]Rule,
	nowMS int64,
) ReconcileResult {
	var result ReconcileResult

	seen := make(map[string]struct{}, len(outcomes))

	for _, o := range outcomes {
		fp := o.Fingerprint
		seen[fp] = struct{}{}

		rule, hasRule := rules[o.RuleCode]
		if !hasRule {
			// Defensive: unknown rule code — treat as stable.
			rule = Rule{Code: o.RuleCode, Volatility: VolatilityStable}
		}

		prev, hasPrev := prior[fp]

		switch o.State {
		case FindingStateUnknown:
			// Unknown: preserve prior state and counter unchanged.
			if hasPrev {
				result.Unchanged = append(result.Unchanged, prev)
			}
			// No prior record + unknown → nothing to persist.

		case FindingStateResolved:
			if !hasPrev {
				// Never fired, evaluates false → nothing to persist.
				continue
			}
			if prev.State == FindingStateResolved {
				// Already resolved — nothing changed.
				result.Unchanged = append(result.Unchanged, prev)
				continue
			}
			// Transition to resolved.
			rec := prev
			rec.State = FindingStateResolved
			rec.ConsecutiveFailures = 0
			rec.ResolvedAt = nowMS
			result.Updated = append(result.Updated, rec)

		case FindingStateFiring:
			debounceThreshold := debounceForVolatility(rule.Volatility)

			if !hasPrev {
				// First-ever firing for this fingerprint.
				consecutiveFails := 1
				newState := FindingStateFiring
				if debounceThreshold > 1 {
					// Not yet at the debounce threshold; hold as unknown
					// until the counter reaches threshold.
					newState = FindingStateUnknown
				}
				rec := FindingRecord{
					Fingerprint:         fp,
					RuleCode:            o.RuleCode,
					State:               newState,
					ConsecutiveFailures: consecutiveFails,
				}
				if newState == FindingStateFiring {
					rec.FirstFiredAt = nowMS
					rec.LastFiredAt = nowMS
				}
				result.Updated = append(result.Updated, rec)
				continue
			}

			// Update consecutive failures counter.
			newFails := prev.ConsecutiveFailures + 1
			rec := prev
			rec.ConsecutiveFailures = newFails

			if newFails >= debounceThreshold {
				// At or above threshold — fire (or stay firing).
				if rec.State != FindingStateFiring {
					rec.State = FindingStateFiring
					if rec.FirstFiredAt == 0 {
						rec.FirstFiredAt = nowMS
					}
				}
				rec.LastFiredAt = nowMS
				result.Updated = append(result.Updated, rec)
			} else {
				// Below threshold — state is still unknown/pre-fire.
				rec.State = FindingStateUnknown
				result.Updated = append(result.Updated, rec)
			}
		}
	}

	// Fingerprints that had a prior row but were absent from this cycle's
	// outcomes (rule removed from catalog, etc.): leave them unchanged.
	for fp, rec := range prior {
		if _, wasSeen := seen[fp]; !wasSeen {
			result.Unchanged = append(result.Unchanged, rec)
		}
	}

	return result
}

// debounceForVolatility returns the consecutive-failure threshold for the
// given volatility class. Stable / boundary / feed use 1 (fire immediately).
func debounceForVolatility(v Volatility) int {
	switch v {
	case VolatilityProbe:
		return debounceProbe
	case VolatilityClusterMembership:
		return debounceClusterMembership
	default:
		return 1
	}
}
