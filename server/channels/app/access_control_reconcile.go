// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// Policy simulation and live enforcement are separate lanes:
// SimulatePolicyForUsers compiles a draft in memory, while AccessEvaluation
// runs the persisted, cached programs the PDP serves at request time. They are
// meant to agree, and nothing checked that they did — so a preview could show
// ALLOW for a subject production denies, and the author would only find out
// after shipping the policy.
//
// reconcileSimulationWithLiveEvaluation closes that gap by replaying each
// simulated verdict through the real PDP and flagging any disagreement. It
// deliberately runs the production lane rather than re-implementing it: same
// subject build, same compiled programs, same evaluator.
//
// A draft that hasn't been saved isn't in the PDP cache, so the two lanes
// cannot be compared for it. Rather than reporting a guaranteed-useless
// disagreement, reconciliation restricts itself to the window where the lanes
// ARE comparable and records why it stood down otherwise.
const (
	simulationReconcileSkipServiceUnavailable = "service_unavailable"
	simulationReconcileSkipNoResults          = "no_results"
	simulationReconcileSkipScopeNotAll        = "evaluation_scope_not_all"
	simulationReconcileSkipNotChannelPolicy   = "not_a_channel_policy"
	simulationReconcileSkipChannelMismatch    = "policy_id_channel_id_mismatch"
	simulationReconcileSkipInactivePolicy     = "policy_inactive"
	simulationReconcileSkipPolicyNotPersisted = "policy_not_persisted"
	simulationReconcileSkipDraftModified      = "draft_differs_from_stored"
)

// simulationOnlyBlameSources are verdicts the simulator synthesises that
// production evaluation never emits (each constant's docstring says as much).
// They are vacuous allows standing in for "the policy is silent on this user",
// so replaying them through the PDP compares a UX affordance against a real
// decision and would report disagreement on every row. Skip them.
var simulationOnlyBlameSources = map[string]bool{
	model.PolicySimulationBlameSourceNoApplicablePolicy: true,
	model.PolicySimulationBlameSourceNoApplicableRule:   true,
	model.PolicySimulationBlameSourceNoSessionData:      true,
	model.PolicySimulationBlameSourceSiblingSaved:       true,
}

// reconcileSimulationWithLiveEvaluation replays every simulated decision
// through AccessEvaluation and marks the ones the two lanes disagree on.
//
// Reconciliation never fails the simulate request: its own errors are logged
// and the pair is skipped. A divergence is a signal that the preview cannot be
// trusted, not a reason to deny the author the rest of the results.
func (a *App) reconcileSimulationWithLiveEvaluation(rctx request.CTX, params model.PolicySimulationByUsersParams, resp *model.PolicySimulationResponse) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		logSimulationReconcileSkipped(rctx, params, simulationReconcileSkipServiceUnavailable)
		return
	}
	if resp == nil || len(resp.Results) == 0 {
		logSimulationReconcileSkipped(rctx, params, simulationReconcileSkipNoResults)
		return
	}

	if reason := simulationReconcileSkipReason(params); reason != "" {
		logSimulationReconcileSkipped(rctx, params, reason)
		return
	}

	stored, appErr := acs.GetPolicy(rctx, params.Policy.ID)
	if appErr != nil || stored == nil {
		logSimulationReconcileSkipped(rctx, params, simulationReconcileSkipPolicyNotPersisted)
		return
	}
	// The editor works in attribute NAMES while parent policies are stored with
	// attribute IDs, so compare against the normalized form or every draft
	// would look modified. A normalization failure falls back to the raw
	// policy: worst case the comparison finds a difference and we stand down.
	if normalized, normErr := acs.NormalizePolicy(rctx, stored); normErr == nil && normalized != nil {
		stored = normalized
	}
	if !policyProgramsEquivalent(stored, params.Policy) {
		logSimulationReconcileSkipped(rctx, params, simulationReconcileSkipDraftModified)
		return
	}

	resource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: params.Policy.ID}
	sessionByUser := simulationSessionOverridesByUser(params)
	baseline := a.callerSessionAttributes(rctx)

	for i := range resp.Results {
		user := resp.Results[i].User
		if user == nil || len(resp.Results[i].Decisions) == 0 {
			continue
		}

		subject, buildErr := a.BuildAccessControlSubject(rctx, user.Id, user.Roles, resource.ID)
		if buildErr != nil {
			rctx.Logger().Warn("Skipping ABAC simulation reconciliation for user: subject build failed",
				mlog.String("policy_id", params.Policy.ID),
				mlog.String("user_id", user.Id),
				mlog.Err(buildErr),
			)
			continue
		}
		// Mirror how the simulator assembles session context (the caller's
		// resolved session under the per-user overrides) so both lanes see a
		// byte-identical subject. Any disagreement is then attributable to
		// policy resolution or evaluation, never to differing inputs.
		subject.Session = mergeSessionAttributes(baseline, sessionByUser[user.Id])

		for action, simulated := range resp.Results[i].Decisions {
			if hasSimulationOnlyBlame(simulated.Blame) {
				continue
			}

			live, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
				Subject:  *subject,
				Resource: resource,
				Action:   action,
			})
			if evalErr != nil {
				rctx.Logger().Warn("Skipping ABAC simulation reconciliation for action: live evaluation failed",
					mlog.String("policy_id", params.Policy.ID),
					mlog.String("user_id", user.Id),
					mlog.String("action", action),
					mlog.Err(evalErr),
				)
				continue
			}
			if live.Decision == simulated.Decision {
				continue
			}

			rctx.Logger().Error("ABAC policy simulation disagrees with live evaluation",
				mlog.String("policy_id", params.Policy.ID),
				mlog.String("channel_id", resource.ID),
				mlog.String("user_id", user.Id),
				mlog.String("action", action),
				mlog.Bool("simulated_decision", simulated.Decision),
				mlog.Bool("live_decision", live.Decision),
				mlog.String("live_reason", string(live.Reason())),
				mlog.Array("simulated_blame", blameSourcesOf(simulated.Blame)),
			)

			simulated.Blame = append(simulated.Blame, model.PolicySimulationBlame{
				Source:  model.PolicySimulationBlameSourceDivergence,
				Outcome: blameOutcomeFor(live.Decision),
			})
			resp.Results[i].Decisions[action] = simulated
		}
	}
}

// simulationReconcileSkipReason reports why the request falls outside the
// window where the simulator and the PDP are comparable, or "" when it doesn't.
//
// The window is narrow on purpose. Only a saved, active channel policy that the
// author hasn't edited resolves to the same compiled programs on both sides,
// and only evaluation_scope=all claims to mirror what the live PDP does — the
// this_rule scope deliberately drops sibling rules, peer policies and parent
// policies, so it is expected to disagree. Anchoring the resource on the
// policy's own ID also guarantees the PDP resolves this exact policy rather
// than whatever is assigned to some other channel.
func simulationReconcileSkipReason(params model.PolicySimulationByUsersParams) string {
	if params.EvaluationScope != model.PolicyEvaluationScopeAll {
		return simulationReconcileSkipScopeNotAll
	}
	if params.Policy == nil || params.Policy.ID == "" || params.Policy.Type != model.AccessControlPolicyTypeChannel {
		return simulationReconcileSkipNotChannelPolicy
	}
	if params.ChannelID != "" && params.ChannelID != params.Policy.ID {
		return simulationReconcileSkipChannelMismatch
	}
	if !params.Policy.Active {
		return simulationReconcileSkipInactivePolicy
	}
	return ""
}

// policyProgramsEquivalent reports whether two policies compile to the same
// programs. Only the inputs the compiler reads are compared; presentation
// fields (name, revision, timestamps, props) are ignored because they cannot
// change a verdict. The check is intentionally strict: a false "modified"
// merely skips reconciliation, whereas a false "unchanged" would compare the
// draft against stale cached programs and report a bogus divergence.
func policyProgramsEquivalent(stored, draft *model.AccessControlPolicy) bool {
	if stored == nil || draft == nil {
		return false
	}
	if stored.Version != draft.Version || stored.Active != draft.Active {
		return false
	}
	if !stringSlicesEqual(stored.Imports, draft.Imports) || !stringSlicesEqual(stored.Roles, draft.Roles) {
		return false
	}
	if len(stored.Rules) != len(draft.Rules) {
		return false
	}
	for i := range stored.Rules {
		if stored.Rules[i].Expression != draft.Rules[i].Expression ||
			stored.Rules[i].Role != draft.Rules[i].Role ||
			stored.Rules[i].Name != draft.Rules[i].Name ||
			!stringSlicesEqual(stored.Rules[i].Actions, draft.Rules[i].Actions) {
			return false
		}
	}
	return true
}

// callerSessionAttributes returns the requesting admin's resolved session
// attributes — the same baseline the simulator layers under the per-user
// overrides. Returns nil when there is no session or the lookup fails; both
// lanes then evaluate against the overrides alone.
func (a *App) callerSessionAttributes(rctx request.CTX) map[string]any {
	session := rctx.Session()
	if session == nil || session.Id == "" {
		return nil
	}
	attrs, appErr := a.GetSessionAttributes(rctx, session.Id)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve caller session attributes for ABAC simulation reconciliation", mlog.Err(appErr))
		return nil
	}
	return attrs
}

func simulationSessionOverridesByUser(params model.PolicySimulationByUsersParams) map[string]map[string]any {
	overrides := make(map[string]map[string]any, len(params.Users))
	for _, u := range params.Users {
		if len(u.SessionOverrides) > 0 {
			overrides[u.UserID] = u.SessionOverrides
		}
	}
	return overrides
}

func mergeSessionAttributes(baseline, overrides map[string]any) map[string]any {
	merged := make(map[string]any, len(baseline)+len(overrides))
	for k, v := range baseline {
		merged[k] = v
	}
	for k, v := range overrides {
		merged[k] = v
	}
	return merged
}

func hasSimulationOnlyBlame(blame []model.PolicySimulationBlame) bool {
	for _, b := range blame {
		if simulationOnlyBlameSources[b.Source] {
			return true
		}
	}
	return false
}

func blameOutcomeFor(decision bool) string {
	if decision {
		return model.PolicySimulationBlameOutcomeAllow
	}
	return model.PolicySimulationBlameOutcomeDeny
}

func blameSourcesOf(blame []model.PolicySimulationBlame) []string {
	sources := make([]string, 0, len(blame))
	for _, b := range blame {
		sources = append(sources, b.Source)
	}
	return sources
}

func stringSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func logSimulationReconcileSkipped(rctx request.CTX, params model.PolicySimulationByUsersParams, reason string) {
	policyID := ""
	if params.Policy != nil {
		policyID = params.Policy.ID
	}
	rctx.Logger().Debug("Skipping ABAC simulation reconciliation",
		mlog.String("policy_id", policyID),
		mlog.String("evaluation_scope", params.EvaluationScope),
		mlog.String("reason", reason),
	)
}
