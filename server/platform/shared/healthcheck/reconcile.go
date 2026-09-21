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

	evals = r.suppressDependentUnknowns(evals)

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

	allFindings, err := r.store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
	if err != nil {
		return nil, err
	}

	now := r.now()
	nowUnixMilli := now.UnixMilli()
	cycleSeen := map[string]struct{}{}
	pending := map[string]*model.HealthFinding{}
	transitions := []Transition{}

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

	toUpsert := make([]*model.HealthFinding, 0, len(pending))
	for _, finding := range pending {
		toUpsert = append(toUpsert, finding)
	}

	if err := r.store.Upsert(toUpsert); err != nil {
		return nil, err
	}

	return transitions, nil
}

func (r *Reconciler) suppressDependentUnknowns(evals []Evaluation) []Evaluation {
	unreachable := UnreachableScopes(evals)
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

func UnreachableScopes(evals []Evaluation) map[string]bool {
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
