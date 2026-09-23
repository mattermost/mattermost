// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"fmt"
	"maps"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const detailKeyUnreachableNode = "unreachable_node"

// DefaultFindingRetention is how long a finding is kept after it was last seen; once it lapses,
// GCFindings hard-deletes the finding along with any mute state attached to it.
const DefaultFindingRetention = 30 * 24 * time.Hour

type ReconcilerOpts struct {
	Store    FindingStore
	Policies map[Volatility]Policy
	Logger   mlog.LoggerIFace
	Now      func() time.Time
	Registry *Registry
}

type Reconciler struct {
	store    FindingStore
	policies map[Volatility]Policy
	logger   mlog.LoggerIFace
	now      func() time.Time
	registry *Registry
}

func NewReconciler(opts ReconcilerOpts) *Reconciler {
	policies := opts.Policies
	if len(policies) == 0 {
		policies = DefaultPolicies()
	}

	now := opts.Now
	if now == nil {
		now = time.Now
	}

	registry := opts.Registry
	if registry == nil {
		registry = Builtin()
	}

	return &Reconciler{
		store:    opts.Store,
		policies: policies,
		logger:   opts.Logger,
		now:      now,
		registry: registry,
	}
}

type Transition struct {
	Finding *model.HealthFinding
	From    State
	To      State
}

func (r *Reconciler) Reconcile(evals []Evaluation) ([]Transition, error) {
	if r == nil {
		return nil, fmt.Errorf("reconciler is nil")
	}
	if r.store == nil {
		return nil, fmt.Errorf("finding store is nil")
	}
	if r.registry == nil {
		return nil, fmt.Errorf("registry is nil")
	}

	// Step 1: an unreachable node yields one node-down finding, not a derived unknown per section.
	unreachable := unreachableScopes(evals)
	evals = suppressDependentUnknowns(evals, unreachable)

	// Step 2: load this cycle's prior state so transitions can be computed against it.
	fingerprints := make([]string, 0, len(evals))
	for _, eval := range evals {
		if eval.Fingerprint != "" {
			fingerprints = append(fingerprints, eval.Fingerprint)
		}
	}

	existing, err := r.store.GetByFingerprints(fingerprints)
	if err != nil {
		return nil, err
	}
	existingByFingerprint := make(map[string]*model.HealthFinding, len(existing))
	for _, finding := range existing {
		if finding == nil || finding.Fingerprint == "" {
			continue
		}
		existingByFingerprint[finding.Fingerprint] = finding
	}

	// The whole finding set backs step 4 below: findings absent from this cycle are found by
	// diffing this list against the fingerprints seen while applying evaluations.
	allFindings, err := r.store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
	if err != nil {
		return nil, err
	}

	now := r.now()
	nowUnixMilli := now.UnixMilli()
	cycleSeen := map[string]struct{}{}
	pending := map[string]*model.HealthFinding{}
	transitions := []Transition{}

	// Step 3: apply each evaluation to its finding. An unknown rule code is a programming
	// error, so log and drop it — its finding then ages via step 4 rather than persisting stale.
	for _, eval := range evals {
		rule, ok := r.registry.Get(eval.Code)
		if !ok {
			r.logMissingRule(eval)
			continue
		}
		if eval.Fingerprint == "" {
			continue
		}
		cycleSeen[eval.Fingerprint] = struct{}{}

		previous := existingByFingerprint[eval.Fingerprint]
		next := upsertableFinding(previous, eval, rule, timestampForEval(eval, nowUnixMilli))

		prevState := findingState(previous)
		nextState := eval.Result.State
		if nextState == "" {
			nextState = StateUnknown
		}
		// Assigning the eval's own state keeps unknown distinct from resolved: an unknown
		// result becomes unknown, never a clear of a firing finding.
		next.State = string(nextState)

		if prevState != nextState {
			next.StateSince = next.LastSeenAt
			transitions = append(transitions, Transition{
				Finding: next,
				From:    prevState,
				To:      nextState,
			})
		}

		pending[next.Fingerprint] = next
		existingByFingerprint[next.Fingerprint] = next
	}

	// Step 4: age findings that were NOT evaluated this cycle (and aren't already unknown) to
	// unknown once they have gone unevaluated longer than their rule's UnknownAfter.
	for _, finding := range allFindings {
		if finding == nil || finding.Fingerprint == "" {
			continue
		}
		if _, ok := cycleSeen[finding.Fingerprint]; ok {
			continue
		}
		if finding.State == string(StateUnknown) {
			continue
		}
		// The node-down finding already represents this scope; aging its dependents to unknown
		// would resurrect the derived unknown step 1 suppressed.
		if finding.Scope != "" && unreachable[finding.Scope] {
			continue
		}

		rule, ok := r.registry.Get(finding.Code)
		if !ok {
			r.logMissingRuleEvalCode(finding.Code, finding.Fingerprint)
			continue
		}
		policy := r.policyFor(rule.Volatility)
		if policy.UnknownAfter <= 0 {
			continue
		}

		lastSeen := time.UnixMilli(finding.LastSeenAt)
		if now.Sub(lastSeen) < policy.UnknownAfter {
			continue
		}

		aged := *finding
		aged.State = string(StateUnknown)
		aged.StateSince = nowUnixMilli
		pending[aged.Fingerprint] = &aged
		transitions = append(transitions, Transition{
			Finding: &aged,
			From:    findingState(finding),
			To:      StateUnknown,
		})
	}

	// Step 5: one batched write so the whole cycle lands atomically for any reader.
	toUpsert := make([]*model.HealthFinding, 0, len(pending))
	for _, finding := range pending {
		toUpsert = append(toUpsert, finding)
	}

	if err := r.store.Upsert(toUpsert); err != nil {
		return nil, err
	}

	return transitions, nil
}

func (r *Reconciler) GCFindings(retention time.Duration) (int64, error) {
	if r == nil {
		return 0, fmt.Errorf("reconciler is nil")
	}
	if r.store == nil {
		return 0, fmt.Errorf("finding store is nil")
	}
	if retention <= 0 {
		return 0, nil
	}

	cutoff := r.now().Add(-retention).UnixMilli()
	return r.store.DeleteBefore(cutoff)
}

func suppressDependentUnknowns(evals []Evaluation, unreachable map[string]bool) []Evaluation {
	if len(unreachable) == 0 {
		return evals
	}

	filtered := make([]Evaluation, 0, len(evals))
	for _, eval := range evals {
		if eval.Result.State == StateUnknown && eval.Result.Scope != "" && unreachable[eval.Result.Scope] {
			continue
		}

		filtered = append(filtered, eval)
	}

	return filtered
}

func unreachableScopes(evals []Evaluation) map[string]bool {
	unreachable := map[string]bool{}
	for _, eval := range evals {
		if eval.Result.State != StateFiring || eval.Result.Details == nil {
			continue
		}
		scope := eval.Result.Details[detailKeyUnreachableNode]
		if scope == "" {
			continue
		}
		unreachable[scope] = true
	}

	return unreachable
}

func upsertableFinding(previous *model.HealthFinding, eval Evaluation, rule Rule, lastSeenAt int64) *model.HealthFinding {
	details := map[string]string{}
	if eval.Result.Details != nil {
		details = make(map[string]string, len(eval.Result.Details))
		maps.Copy(details, eval.Result.Details)
	}

	subject := eval.Result.Subject
	if subject == "" {
		subject = rule.Subject
	}

	scope := eval.Result.Scope
	if previous != nil && scope == "" {
		scope = previous.Scope
	}
	if previous != nil && subject == "" {
		subject = previous.Subject
	}

	finding := &model.HealthFinding{
		Fingerprint: eval.Fingerprint,
		Code:        eval.Code,
		Subject:     subject,
		Scope:       scope,
		Severity:    string(rule.Severity),
		State:       string(eval.Result.State),
		Area:        rule.Area,
		Surface:     string(rule.Surface),
		MessageID:   eval.Result.MessageID,
		Details:     details,
		LastSeenAt:  lastSeenAt,
	}

	if previous != nil {
		finding.FirstSeenAt = previous.FirstSeenAt
		finding.StateSince = previous.StateSince
		finding.MutedAt = previous.MutedAt
		finding.MutedBy = previous.MutedBy
	} else {
		finding.FirstSeenAt = lastSeenAt
		finding.StateSince = lastSeenAt
	}

	return finding
}

func timestampForEval(eval Evaluation, fallback int64) int64 {
	if eval.EvaluatedAt.IsZero() {
		return fallback
	}
	return eval.EvaluatedAt.UnixMilli()
}

func findingState(finding *model.HealthFinding) State {
	if finding == nil || finding.State == "" {
		return StateUnknown
	}
	return State(finding.State)
}

func (r *Reconciler) policyFor(volatility Volatility) Policy {
	policy, ok := r.policies[volatility]
	if ok {
		return policy
	}

	defaultPolicy, ok := DefaultPolicies()[volatility]
	if ok {
		return defaultPolicy
	}

	return Policy{}
}

func (r *Reconciler) logMissingRule(eval Evaluation) {
	r.logMissingRuleEvalCode(eval.Code, eval.Fingerprint)
}

func (r *Reconciler) logMissingRuleEvalCode(code, fingerprint string) {
	if r.logger == nil {
		return
	}
	r.logger.Error("health check evaluation dropped: rule not found", mlog.String("rule_code", code), mlog.String("fingerprint", fingerprint))
}
