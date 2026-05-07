// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const attributeViewRefreshInterval = 30 * time.Second
const accessControlChildPolicySearchLimit = 1000

func (a *App) GetChannelsForPolicy(rctx request.CTX, policyID string, cursor model.AccessControlPolicyCursor, limit int) ([]*model.ChannelWithTeamData, int64, *model.AppError) {
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return nil, 0, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: policyID,
			Cursor:   cursor,
			Limit:    limit,
		})
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		channelIDs := make([]string, 0, len(policies))

		// channel IDs are the same as policy IDs
		for _, p := range policies {
			channelIDs = append(channelIDs, p.ID)
		}

		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds(channelIDs, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return chs, total, nil
	case model.AccessControlPolicyTypeChannel:
		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds([]string{policyID}, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		total := int64(len(chs))
		return chs, total, nil
	default:
		return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, "Invalid policy type", http.StatusBadRequest)
	}
}

func (a *App) GetAccessControlPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		return nil, appErr
	}

	return policy, nil
}

func (a *App) CreateOrUpdateAccessControlPolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CreateAccessControlPolicy", "app.pap.create_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if policy.ID == "" {
		policy.ID = model.NewId()
	}

	// Channel-scope policies are pinned to a single channel by ID. Validate
	// channel eligibility here (default / DM / GM / group-constrained / shared
	// channels are ineligible) so this guard protects all callers — including
	// system admins, whose request goes through the api4 handler's permission
	// fast-path that skips the per-channel ValidateChannelAccessControlPolicyCreation
	// check, and the parent-policy AssignAccessControlPolicyToChannels flow,
	// which validates eligibility there but bypasses this entry point.
	if policy.Type == model.AccessControlPolicyTypeChannel {
		channel, appErr := a.GetChannel(rctx, policy.ID)
		if appErr != nil {
			return nil, appErr
		}
		if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
			return nil, appErr
		}
	}

	policy.Version = model.AccessControlPolicyVersionV0_3
	for i, rule := range policy.Rules {
		for j, action := range rule.Actions {
			if action == "*" {
				policy.Rules[i].Actions[j] = model.AccessControlPolicyActionMembership
			}
		}
	}

	var appErr *model.AppError
	policy, appErr = acs.SavePolicy(rctx, policy)
	if appErr != nil {
		return nil, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeChannel:
		a.publishChannelPolicyEnforcedUpdate(rctx, policy.ID)
	case model.AccessControlPolicyTypeParent:
		a.publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx, policy.ID)
	}

	return policy, nil
}

func (a *App) DeleteAccessControlPolicy(rctx request.CTX, id string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("DeleteAccessControlPolicy", "app.pap.delete_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Resolve the policy first so we know whether to broadcast a channel
	// access control update after deletion (channel-type policies share the
	// channel's ID, so we can use the policy ID as the channel ID).
	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		return appErr
	}

	var affectedChannelIDs []string
	if policy != nil && policy.Type != model.AccessControlPolicyTypeChannel {
		affectedChannelIDs = a.channelPolicyIDsWithImport(rctx, id)
	}

	if appErr := acs.DeletePolicy(rctx, id); appErr != nil {
		return appErr
	}

	if policy != nil && policy.Type == model.AccessControlPolicyTypeChannel {
		a.publishChannelPolicyEnforcedUpdate(rctx, id)
	} else if policy.Type == model.AccessControlPolicyTypeParent {
		a.publishChannelPolicyEnforcedUpdatesForChannels(rctx, affectedChannelIDs)
	}

	return nil
}

func (a *App) CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	errs, appErr := acs.CheckExpression(rctx, expression)
	if appErr != nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return errs, nil
}

func (a *App) TestExpression(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	res, count, err := acs.QueryUsersForExpression(rctx, expression, opts)
	if err != nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return res, count, nil
}

// SimulateAccessControlPolicyForUsers proxies to the enterprise PDP
// service so the /cel/simulate_users handler can preview how a draft
// policy would resolve for an explicit set of users. The caller picks
// users (with optional per-user session attribute overrides); the
// response carries per-user, per-action decisions with blame attribution.
//
// Post-processing happens in two stages before the response leaves the
// server:
//
//  1. enrichBlameForDraftScope inspects every blame entry. Same-scope
//     entries (this_rule / sibling_rule / sibling_saved against the
//     draft, or system_permission entries whose blamed policy shares the
//     draft's scope) gain the failing rule's CEL Expression so the picker
//     can render an evaluation trace. system_permission entries that turn
//     out to be at the draft's scope are reclassified to peer_policy.
//     Truly upper-scoped entries (system_permission with a different
//     scope, channel_policy) are deliberately left expression-less so
//     the UI cannot leak the contents of a policy outside the editing
//     scope.
//  2. filterResponseToEditingRuleScope (only when EvaluationScope ==
//     "this_rule") is a defensive backstop that strips any non-editing-
//     rule blame entries that may have leaked through despite the
//     simulator restricting contributions to the editing rule. The
//     simulator side does the heavy lifting (skipping sibling rules and
//     system permission policies entirely); this filter drops anything
//     that isn't a draft-side blame on the editing rule and flips
//     orphaned denies back to allow.
//
// Returns NotImplemented when the access control service is unavailable
// (no enterprise license / ABAC disabled).
func (a *App) SimulateAccessControlPolicyForUsers(rctx request.CTX, params model.PolicySimulationByUsersParams) (*model.PolicySimulationResponse, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("SimulateAccessControlPolicyForUsers", "app.pap.simulate.unavailable", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	resp, appErr := acs.SimulatePolicyForUsers(rctx, params)
	if appErr != nil {
		return nil, appErr
	}

	if resp != nil {
		enrichBlameForDraftScope(rctx, acs, params.Policy, resp)
		if isThisRuleScope(params.EvaluationScope) {
			filterResponseToEditingRuleScope(resp, params.RuleName)
		}
	}

	return resp, nil
}

// ValidatePolicySimulationUsersInScope ensures every user listed for a delegated
// (non-system-admin) simulation belongs to the channel when channel_id is set,
// otherwise to the team when team_id is set. Call only after the caller has
// passed authorizeSimulatePolicy.
func (a *App) ValidatePolicySimulationUsersInScope(rctx request.CTX, teamID, channelID string, users []model.PolicySimulationUserOverride) *model.AppError {
	if channelID != "" {
		if !model.IsValidId(channelID) {
			return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.context.invalid_param.app_error", map[string]any{"Name": "channel_id"}, "", http.StatusBadRequest)
		}
		for _, u := range users {
			if u.UserID == "" || !model.IsValidId(u.UserID) {
				return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.context.invalid_param.app_error", map[string]any{"Name": "user_id"}, "", http.StatusBadRequest)
			}
			if _, err := a.Srv().Store().Channel().GetMember(rctx, channelID, u.UserID); err != nil {
				var nfErr *store.ErrNotFound
				if errors.As(err, &nfErr) {
					return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.access_control_policy.simulate.users_out_of_scope.app_error", nil, "user_id="+u.UserID, http.StatusForbidden)
				}
				return model.NewAppError("ValidatePolicySimulationUsersInScope", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return nil
	}
	if teamID != "" {
		if !model.IsValidId(teamID) {
			return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.context.invalid_param.app_error", map[string]any{"Name": "team_id"}, "", http.StatusBadRequest)
		}
		for _, u := range users {
			if u.UserID == "" || !model.IsValidId(u.UserID) {
				return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.context.invalid_param.app_error", map[string]any{"Name": "user_id"}, "", http.StatusBadRequest)
			}
			if _, appErr := a.GetTeamMember(rctx, teamID, u.UserID); appErr != nil {
				if appErr.StatusCode == http.StatusNotFound {
					return model.NewAppError("ValidatePolicySimulationUsersInScope", "api.access_control_policy.simulate.users_out_of_scope.app_error", nil, "user_id="+u.UserID, http.StatusForbidden)
				}
				return appErr
			}
		}
	}
	return nil
}

// isThisRuleScope returns true when the simulator should run in
// "this rule only" mode. Empty defaults to this_rule for backward
// compatibility with older clients that don't set EvaluationScope.
func isThisRuleScope(scope string) bool {
	return scope == "" || scope == model.PolicyEvaluationScopeThisRule
}

// enrichBlameForDraftScope walks the simulator response and:
//   - copies the failing rule's expression into draft-side blame entries
//     (this_rule / sibling_rule / sibling_saved) using params.Policy.Rules
//     as the source — only if the simulator hasn't already populated it.
//   - reclassifies system_permission blame entries whose blamed policy
//     lives at the SAME scope as the draft (same Type and same Imports
//     parent set) to peer_policy, populating the failing rule's
//     expression in from the blamed policy's Rules when the simulator
//     left it empty. acs.GetPolicy is consulted once per unique
//     policy_id and cached for the request.
//   - **defensively strips Expression and EvaluationTree from blame
//     entries whose final source is truly upper-scoped**
//     (system_permission, channel_policy). The simulator may attach
//     these fields unconditionally for ergonomics; the privacy
//     boundary is enforced here so the UI never receives the contents
//     of a policy outside the editing scope.
func enrichBlameForDraftScope(rctx request.CTX, acs einterfaces.AccessControlServiceInterface, draft *model.AccessControlPolicy, resp *model.PolicySimulationResponse) {
	if resp == nil || draft == nil {
		return
	}
	draftRules := buildRulesIndex(draft)
	cache := map[string]*model.AccessControlPolicy{}

	enrichDecisions := func(decisions map[string]model.PolicySimulationActionDecision) {
		for action, dec := range decisions {
			for j := range dec.Blame {
				enrichBlameEntry(rctx, acs, draft, draftRules, cache, &dec.Blame[j])
			}
			decisions[action] = dec
		}
	}

	for i := range resp.Results {
		enrichDecisions(resp.Results[i].Decisions)
		for k := range resp.Results[i].Sessions {
			enrichDecisions(resp.Results[i].Sessions[k].Decisions)
		}
	}
}

func enrichBlameEntry(rctx request.CTX, acs einterfaces.AccessControlServiceInterface, draft *model.AccessControlPolicy, draftRules map[string]string, cache map[string]*model.AccessControlPolicy, blame *model.PolicySimulationBlame) {
	if blame == nil {
		return
	}
	switch blame.Source {
	case model.PolicySimulationBlameSourceThisRule,
		model.PolicySimulationBlameSourceSiblingRule,
		model.PolicySimulationBlameSourceSiblingSaved:
		// Same-scope draft blame: backfill expression if the simulator
		// didn't pre-populate it.
		if blame.Expression == "" {
			if expr, ok := draftRules[blame.RuleName]; ok {
				blame.Expression = expr
			}
		}
	case model.PolicySimulationBlameSourceSystemPermission:
		// Peer-vs-upper distinction lives here: load the blamed
		// policy, compare scope to the draft, and either reclassify
		// (peer_policy with expression preserved/backfilled) or strip
		// the leaked details.
		if blame.PolicyID == "" {
			stripUpperScopedFields(blame)
			return
		}
		blamed, cached := cache[blame.PolicyID]
		if !cached {
			policy, appErr := acs.GetPolicy(rctx, blame.PolicyID)
			if appErr != nil {
				policy = nil
			}
			cache[blame.PolicyID] = policy
			blamed = policy
		}
		if blamed == nil || !samePeerScope(draft, blamed) {
			stripUpperScopedFields(blame)
			return
		}
		blame.Source = model.PolicySimulationBlameSourcePeerPolicy
		if blame.Expression == "" {
			for _, r := range blamed.Rules {
				if r.Name == blame.RuleName {
					blame.Expression = r.Expression
					break
				}
			}
		}
	case model.PolicySimulationBlameSourceChannelPolicy:
		// channel_policy is always upper-scoped from a draft's view —
		// the parent or an inherited resource policy. Strip
		// expression / tree details so the UI keeps the chip opaque.
		stripUpperScopedFields(blame)
	}
}

// stripUpperScopedFields clears the fields that would leak the contents
// of an out-of-scope policy if the simulator attached them. Called
// whenever a blame entry's final source is determined to live above
// the editing scope.
func stripUpperScopedFields(blame *model.PolicySimulationBlame) {
	blame.Expression = ""
	blame.EvaluationTree = nil
}

// buildRulesIndex maps rule_name -> CEL expression for a policy. Rules
// without a name (legacy v0.3 membership rules) are skipped because the
// blame entries reference rules by name — anonymous rules would never
// match.
func buildRulesIndex(policy *model.AccessControlPolicy) map[string]string {
	if policy == nil {
		return nil
	}
	out := make(map[string]string, len(policy.Rules))
	for _, r := range policy.Rules {
		if r.Name == "" {
			continue
		}
		out[r.Name] = r.Expression
	}
	return out
}

// samePeerScope reports whether two policies live at the same scope.
// Policies are peers when they share the same Type, the same Scope +
// ScopeID (so a team-scoped permission policy is never treated as a
// peer of a system-scoped one with the same imports), and the same
// parent imports set (order-insensitive). Two policies with no Imports
// (top-level system policies) count as peers of one another. A policy
// and its parent are NOT peers — the parent has a smaller / different
// imports set.
func samePeerScope(a, b *model.AccessControlPolicy) bool {
	if a == nil || b == nil {
		return false
	}
	if a.Type != b.Type {
		return false
	}
	if a.Scope != b.Scope || a.ScopeID != b.ScopeID {
		return false
	}
	return importsEqual(a.Imports, b.Imports)
}

func importsEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	if len(a) == 0 {
		return true
	}
	aa := append([]string(nil), a...)
	bb := append([]string(nil), b...)
	slices.Sort(aa)
	slices.Sort(bb)
	for i := range aa {
		if aa[i] != bb[i] {
			return false
		}
	}
	return true
}

// filterResponseToEditingRuleScope is the defensive post-process for the
// "this rule only" evaluation scope. The simulator already restricts
// contributions to just the editing rule (no sibling rules, no system
// permission policies, no peer policies), so in practice this function
// only runs over an already-clean response. It exists to backstop
// any blame entry that leaked through, drop anything that isn't a
// draft-side entry on the editing rule, and flip orphaned denies back
// to allow.
//
// editingRuleName is the rule the author is currently simulating; when
// non-empty, only this_rule blame entries that explicitly target that
// rule survive. When empty (e.g. an unnamed draft rule) the filter
// drops everything except this_rule, sibling_saved, and
// no_applicable_policy regardless of the rule_name field — sibling
// rules in the same policy are never kept in this mode.
func filterResponseToEditingRuleScope(resp *model.PolicySimulationResponse, editingRuleName string) {
	for i := range resp.Results {
		resp.Results[i].Decisions = filterDecisionsToEditingRuleScope(resp.Results[i].Decisions, editingRuleName)
		for j := range resp.Results[i].Sessions {
			resp.Results[i].Sessions[j].Decisions = filterDecisionsToEditingRuleScope(resp.Results[i].Sessions[j].Decisions, editingRuleName)
		}
	}
}

func filterDecisionsToEditingRuleScope(decisions map[string]model.PolicySimulationActionDecision, editingRuleName string) map[string]model.PolicySimulationActionDecision {
	if len(decisions) == 0 {
		return decisions
	}
	for action, dec := range decisions {
		filtered := filterBlameToEditingRuleScope(dec.Blame, editingRuleName)
		if !dec.Decision && len(filtered) == 0 {
			// The deny had no editing-rule cause — flip to allow so
			// the picker accurately reports "this rule alone would
			// have allowed this user."
			dec.Decision = true
			dec.Blame = nil
		} else {
			dec.Blame = filtered
		}
		decisions[action] = dec
	}
	return decisions
}

// editingRuleBlameSources lists the blame sources that originate inside
// the editing rule itself (or are synthetic markers about how the rule
// applies). Anything else — peer_policy (same scope, different policy),
// system_permission, channel_policy, and even sibling_rule (same policy,
// different rule) — is dropped when the caller asks for "this rule only".
var editingRuleBlameSources = map[string]struct{}{
	model.PolicySimulationBlameSourceThisRule:           {},
	model.PolicySimulationBlameSourceSiblingSaved:       {},
	model.PolicySimulationBlameSourceNoApplicablePolicy: {},
}

func filterBlameToEditingRuleScope(blame []model.PolicySimulationBlame, editingRuleName string) []model.PolicySimulationBlame {
	if len(blame) == 0 {
		return nil
	}
	out := blame[:0:0]
	for _, b := range blame {
		if _, ok := editingRuleBlameSources[b.Source]; !ok {
			continue
		}
		// Defensive: when the editing rule's name is known, only keep
		// blame entries that explicitly target it. The simulator's
		// contribution restriction already enforces this; this is the
		// belt-and-suspenders for any edge case where the simulator
		// emits a this_rule-tagged blame from a different rule.
		if editingRuleName != "" && b.RuleName != "" && b.RuleName != editingRuleName {
			continue
		}
		out = append(out, b)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func (a *App) AssignAccessControlPolicyToChannels(rctx request.CTX, parentID string, channelIDs []string) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := a.GetAccessControlPolicy(rctx, parentID)
	if appErr != nil {
		return nil, appErr
	}

	if policy.Type != model.AccessControlPolicyTypeParent {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy is not of type parent", http.StatusBadRequest)
	}

	channels, err := a.GetChannels(rctx, channelIDs)
	if err != nil {
		return nil, err
	}

	policies := make([]*model.AccessControlPolicy, 0, len(channelIDs))
	for _, channel := range channels {
		if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
			return nil, appErr
		}

		child, err := acs.GetPolicy(rctx, channel.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if child == nil {
			child = &model.AccessControlPolicy{
				ID:       channel.Id,
				Type:     model.AccessControlPolicyTypeChannel,
				Active:   policy.Active,
				CreateAt: model.GetMillis(),
				Props:    map[string]any{},
			}
		}
		child.Version = model.AccessControlPolicyVersionV0_3

		appErr := child.Inherit(policy)
		if appErr != nil {
			return nil, appErr
		}

		child, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return nil, appErr
		}
		a.publishChannelPolicyEnforcedUpdate(rctx, child.ID)
		policies = append(policies, child)
	}

	return policies, nil
}

func (a *App) UnassignPoliciesFromChannels(rctx request.CTX, policyID string, channelIDs []string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	cps, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		Type:     model.AccessControlPolicyTypeChannel,
		ParentID: policyID,
		Limit:    1000,
	})
	if err != nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	childPolicies := make(map[string]bool)
	for _, p := range cps {
		childPolicies[p.ID] = true
	}

	for _, channelID := range channelIDs {
		if _, ok := childPolicies[channelID]; !ok {
			mlog.Warn("Policy is not assigned to the parent policy", mlog.String("channel_id", channelID), mlog.String("parent_policy_id", policyID))
			continue
		}

		child, appErr := acs.GetPolicy(rctx, channelID)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}

		child.Imports = slices.DeleteFunc(child.Imports, func(importID string) bool {
			return importID == policyID
		})
		if len(child.Imports) == 0 && len(child.Rules) == 0 {
			// If the policy has no imports and no rules, we can delete it
			if err := acs.DeletePolicy(rctx, child.ID); err != nil {
				return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
			// invalidate the channel cache and broadcast the policy change
			a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
			continue
		}
		_, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
		a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
	}

	return nil
}

func (a *App) SearchAccessControlPolicies(rctx request.CTX, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, opts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for i, policy := range policies {
		if policy.Type != model.AccessControlPolicyTypeParent {
			continue
		}

		normlizedPolicy, appErr := acs.NormalizePolicy(rctx, policy)
		if appErr != nil {
			mlog.Error("Failed to normalize policy", mlog.String("policy_id", policy.ID), mlog.Err(appErr))
			continue
		}
		policies[i] = normlizedPolicy
	}

	return policies, total, nil
}

func (a *App) GetAccessControlPolicyAttributes(rctx request.CTX, channelID string, action string) (map[string][]string, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetChannelAccessControlAttributes", "app.pap.get_channel_access_control_attributes.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	attributes, appErr := acs.GetPolicyRuleAttributes(rctx, channelID, action)
	if appErr != nil {
		return nil, appErr
	}

	return attributes, nil
}

func (a *App) GetAccessControlFieldsAutocomplete(rctx request.CTX, after string, limit int, callerID string) ([]*model.PropertyField, *model.AppError) {
	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Use property app layer to enforce access control
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)
	fields, appErr := a.SearchPropertyFields(rctxWithCaller, cpaGroupID, model.PropertyFieldSearchOpts{
		Cursor: model.PropertyFieldSearchCursor{
			PropertyFieldID: after,
			CreateAt:        1,
		},
		PerPage: limit,
	})
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return fields, nil
}

func (a *App) UpdateAccessControlPoliciesActive(rctx request.CTX, updates []model.AccessControlPolicyActiveUpdate) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.update_access_control_policies_active.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, err := a.Srv().Store().AccessControlPolicy().SetActiveStatusMultiple(rctx, updates)
	if err != nil {
		return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.update_access_control_policies_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, policy := range policies {
		// only channel policies use the active state
		if policy.Type == model.AccessControlPolicyTypeChannel {
			a.publishChannelPolicyEnforcedUpdate(rctx, policy.ID)
		}
	}

	return policies, nil
}

func (a *App) ExpressionToVisualAST(rctx request.CTX, expression string) (*model.VisualExpression, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.expression_to_visual_ast.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	visualAST, appErr := acs.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}

	return visualAST, nil
}

// publishChannelPolicyEnforcedForChannelPoliciesWithImport broadcasts
// channel_access_control_updated for every channel-type policy that lists
// importID in its imports. Call only after the imported policy (parent,
// permission, etc.) is persisted.
func (a *App) publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx request.CTX, importID string) {
	a.publishChannelPolicyEnforcedUpdatesForChannels(rctx, a.channelPolicyIDsWithImport(rctx, importID))
}

func (a *App) publishChannelPolicyEnforcedUpdatesForChannels(rctx request.CTX, channelIDs []string) {
	seen := make(map[string]struct{}, len(channelIDs))
	for _, channelID := range channelIDs {
		if channelID == "" {
			continue
		}
		if _, ok := seen[channelID]; ok {
			continue
		}
		seen[channelID] = struct{}{}
		a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
	}
}

func (a *App) channelPolicyIDsWithImport(rctx request.CTX, importID string) []string {
	channelIDs := []string{}
	var cursor model.AccessControlPolicyCursor
	for {
		children, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: importID,
			Cursor:   cursor,
			Limit:    accessControlChildPolicySearchLimit,
		})
		if err != nil {
			rctx.Logger().Warn("Failed to list channel policies that import a policy; skipping channel access control fan-out",
				mlog.String("imported_policy_id", importID),
				mlog.Err(err),
			)
			return channelIDs
		}
		for _, child := range children {
			channelIDs = append(channelIDs, child.ID)
		}
		if len(children) < accessControlChildPolicySearchLimit {
			break
		}
		cursor.ID = children[len(children)-1].ID
	}
	return channelIDs
}

// publishChannelPolicyEnforcedUpdate invalidates the channel cache for the
// given channel ID and broadcasts a channel_access_control_updated websocket
// event so that connected clients can refresh their view of the channel's
// access control state (e.g. the policy_enforced flag and the set of
// attributes used by the policy). A dedicated event is used rather than
// channel_updated because this is fired on every policy mutation and clients
// only need to refresh access control state — not run the full
// channel_updated reducer/router pipeline.
func (a *App) publishChannelPolicyEnforcedUpdate(rctx request.CTX, channelID string) {
	a.Srv().Store().Channel().InvalidateChannel(channelID)

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load channel after access control policy change",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return
	}

	channelJSON, jsonErr := json.Marshal(channel)
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to marshal channel after access control policy change",
			mlog.String("channel_id", channelID),
			mlog.Err(jsonErr),
		)
		return
	}

	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelAccessControlUpdated, "", channel.Id, "", nil, "")
	messageWs.Add("channel", string(channelJSON))
	a.Publish(messageWs)
}

// ValidateChannelEligibilityForAccessControl checks that a channel is eligible for
// access control policy assignment: must be public or private (DM/GM excluded),
// not group-constrained, not shared, and not a team default channel (e.g. town-square).
func (a *App) ValidateChannelEligibilityForAccessControl(rctx request.CTX, channel *model.Channel) *model.AppError {
	if channel.Type != model.ChannelTypePrivate && channel.Type != model.ChannelTypeOpen {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_type_not_supported",
			nil, "Policies can only be applied to public or private channels", http.StatusBadRequest)
	}

	if channel.IsGroupConstrained() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_group_constrained",
			nil, "Channel is group constrained", http.StatusBadRequest)
	}

	if channel.IsShared() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_shared",
			nil, "Channel is shared", http.StatusBadRequest)
	}

	if slices.Contains(a.DefaultChannelNames(rctx), channel.Name) {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_default",
			nil, "Channel is a team default channel", http.StatusBadRequest)
	}

	return nil
}

// ValidateChannelAccessControlPermission validates if a user has permission to manage access control for a specific channel
func (a *App) ValidateChannelAccessControlPermission(rctx request.CTX, userID, channelID string) *model.AppError {
	// Verify the channel exists
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}

	// Check if user has channel admin permission for the specific channel
	if ok, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionManageChannelAccessRules); !ok {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.insufficient_channel_permissions", nil, "user_id="+userID+" channel_id="+channelID, http.StatusForbidden)
	}

	if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
		return appErr
	}

	return nil
}

// ValidateAccessControlPolicyPermission validates if a user has permission to manage a specific existing access control policy
func (a *App) ValidateAccessControlPolicyPermission(rctx request.CTX, userID, policyID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{})
}

type ValidateAccessControlPolicyPermissionOptions struct {
	isReadOnly bool
	channelID  string
}

func (a *App) ValidateAccessControlPolicyPermissionWithOptions(rctx request.CTX, userID, policyID string, opts ValidateAccessControlPolicyPermissionOptions) *model.AppError {
	// System admins can manage any policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Get the policy to determine its type
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return appErr
	}

	// For read-only operations, allow access to system policies if they're applied to the specific channel
	if opts.isReadOnly && policy.Type != model.AccessControlPolicyTypeChannel && opts.channelID != "" {
		// Check if user has access to the channel
		if ok, _ := a.HasPermissionToChannel(rctx, userID, opts.channelID, model.PermissionReadChannel); !ok {
			return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" channel_id="+opts.channelID, http.StatusForbidden)
		}

		// Check if this system policy is applied to the specific channel
		if a.isSystemPolicyAppliedToChannel(rctx, policyID, opts.channelID) {
			return nil // Allow read-only access
		}
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type+" channel_id="+opts.channelID, http.StatusForbidden)
	}

	// Non-system admins can only manage channel-type policies (for non-read-only operations)
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policyID)
}

// ValidateAccessControlPolicyPermissionWithMode validates access control policy permissions with read-only mode option
func (a *App) ValidateAccessControlPolicyPermissionWithMode(rctx request.CTX, userID, policyID string, isReadOnly bool) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
	})
}

// ValidateAccessControlPolicyPermissionWithChannelContext validates access control policy permissions with channel context
func (a *App) ValidateAccessControlPolicyPermissionWithChannelContext(rctx request.CTX, userID, policyID string, isReadOnly bool, channelID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
		channelID:  channelID,
	})
}

// isSystemPolicyAppliedToChannel checks if a system policy is applied to a specific channel
func (a *App) isSystemPolicyAppliedToChannel(rctx request.CTX, policyID, channelID string) bool {
	// Get the channel's policy (channel ID = policy ID for channel policies)
	channelPolicy, err := a.GetAccessControlPolicy(rctx, channelID)
	if err != nil {
		return false // Channel doesn't have a policy
	}

	// Check if the channel policy imports this system policy
	if channelPolicy.Imports != nil {
		return slices.Contains(channelPolicy.Imports, policyID)
	}

	return false
}

// ValidateChannelAccessControlPolicyCreation validates if a user can create a channel-specific access control policy
func (a *App) ValidateChannelAccessControlPolicyCreation(rctx request.CTX, userID string, policy *model.AccessControlPolicy) *model.AppError {
	// System admins can create any type of policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Non-system admins can only create channel-type policies
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateChannelAccessControlPolicyCreation", "app.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policy.ID)
}

// TestExpressionWithChannelContext tests expressions for channel admins with attribute validation
// Channel admins can only see users that match expressions they themselves would match
func (a *App) TestExpressionWithChannelContext(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	// Get the current user (channel admin)
	session := rctx.Session()
	if session == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "api.context.session_expired.app_error", nil, "", http.StatusUnauthorized)
	}

	currentUserID := session.UserId

	// SECURITY: First check if the channel admin themselves matches this expression
	// If they don't match, they shouldn't be able to see users who do
	adminMatches, appErr := a.ValidateExpressionAgainstRequester(rctx, expression, currentUserID)
	if appErr != nil {
		return nil, 0, appErr
	}

	if !adminMatches {
		// Channel admin doesn't match the expression, so return empty results
		return []*model.User{}, 0, nil
	}

	// If the channel admin matches the expression, run it against all users
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	return a.TestExpression(rctx, expression, opts)
}

// ValidateExpressionAgainstRequester validates an expression directly against a specific user
func (a *App) ValidateExpressionAgainstRequester(rctx request.CTX, expression string, requesterID string) (bool, *model.AppError) {
	// Self-exclusion validation should work with any attribute
	// Channel admins should be able to validate any expression they're testing

	// Use access control service to evaluate expression
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, model.NewAppError("ValidateExpressionAgainstRequester", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Search only for the specific requester user ID
	users, _, appErr := acs.QueryUsersForExpression(rctx, expression, model.SubjectSearchOptions{
		SubjectID: requesterID, // Only check this specific user
		Limit:     1,           // Maximum 1 result expected
	})
	if appErr != nil {
		return false, appErr
	}
	if len(users) == 1 && users[0].Id == requesterID {
		return true, nil
	}
	return false, nil
}

// BuildAccessControlSubject creates a fully populated Subject with user attributes and
// scoped roles for use in AccessEvaluation calls. It also ensures the materialized
// attribute view is refreshed periodically (at most once per attributeViewRefreshInterval).
//
// channelID is optional: when non-empty, the channel-scoped role for the user is resolved
// from ChannelMember and appended to Subject.ScopedRoles so v0.4 channel resource policy
// permission rules can match (channel_guest / channel_user / channel_admin). When empty,
// only the system-scoped role is populated.
func (a *App) BuildAccessControlSubject(rctx request.CTX, userID string, roles string, channelID string) (*model.Subject, *model.AppError) {
	a.refreshAttributeViewIfStale(rctx)

	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	subject, storeErr := a.Srv().Store().Attributes().GetSubject(rctx, userID, groupID)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			subject = &model.Subject{
				ID:         userID,
				Type:       "user",
				Attributes: map[string]any{},
			}
		} else {
			rctx.Logger().Warn("Failed to get subject for access control subject",
				mlog.String("user_id", userID),
				mlog.String("roles", roles),
				mlog.Err(storeErr),
			)
			return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.get_subject.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	subject.Role = roles
	subject.SetScopedRole(model.AccessControlSubjectScopeSystem, ResolveSystemRole(roles))
	if channelID != "" {
		channelRole, appErr := a.GetSubjectChannelRole(rctx, userID, channelID)
		if appErr != nil {
			// Fail closed: a transient channel-member lookup failure must
			// not silently produce a subject without a channel-scoped
			// role — the resource lane evaluator would then evaluate
			// against an empty role and let the user through any
			// channel-role-targeted rules. Propagate the error so the
			// caller treats the build as a denial.
			rctx.Logger().Warn("Failed to resolve channel-scoped role for ABAC subject; aborting subject build",
				mlog.String("user_id", userID),
				mlog.String("channel_id", channelID),
				mlog.Err(appErr),
			)
			return nil, appErr
		}
		if channelRole != "" {
			subject.SetScopedRole(model.AccessControlSubjectScopeChannel, channelRole)
		}
	}

	return subject, nil
}

// GetSubjectChannelRole returns the channel-scoped role identifier
// (channel_admin / channel_user / channel_guest) for the given user in
// the given channel.
//
// Resolution order:
//  1. Look up ChannelMember; map SchemeAdmin → channel_admin, SchemeUser → channel_user,
//     SchemeGuest → channel_guest.
//  2. Inspect the Roles tokens on the channel member for the channel role names.
//
// Returns ("", nil) when no channel role can be determined — either
// because the user is not a member of the channel, or because the
// ChannelMember row exists but is in an inconsistent shape (no scheme
// flag set and no recognised channel-role token in Roles). Callers
// (e.g. attachChannelScopedRole, BuildAccessControlSubject) gate on the
// empty string and skip the channel scope rather than evaluating against
// a fabricated role. Inconsistent-row cases are logged at WARN with the
// row's flags and Roles for operator triage.
func (a *App) GetSubjectChannelRole(rctx request.CTX, userID, channelID string) (string, *model.AppError) {
	cm, err := a.Srv().Store().Channel().GetMember(rctx, channelID, userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			// Not a member: return an empty role and let the caller
			// decide what "no resource role" means for them. We used
			// to fabricate a role from the user's system roles here,
			// but that synthesised channel-scope information from
			// data the user has no actual channel membership behind —
			// callers (e.g. attachChannelScopedRole in file.go) now
			// gate on the empty string and skip the channel scope
			// rather than evaluating against a guess.
			return "", nil
		}
		return "", model.NewAppError("GetSubjectChannelRole", "app.access_control.get_channel_role.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	switch {
	case cm.SchemeAdmin:
		return model.ChannelAdminRoleId, nil
	case cm.SchemeGuest:
		return model.ChannelGuestRoleId, nil
	case cm.SchemeUser:
		return model.ChannelUserRoleId, nil
	}

	for token := range strings.FieldsSeq(cm.Roles) {
		switch token {
		case model.ChannelAdminRoleId, model.ChannelUserRoleId, model.ChannelGuestRoleId:
			return token, nil
		}
	}

	// ChannelMember row exists but neither the scheme flags nor the
	// Roles tokens identify a recognised channel role. This shouldn't
	// happen on healthy data — schemes set SchemeUser by default, and
	// pre-scheme rows still carry channel_user / channel_admin /
	// channel_guest tokens. We used to fall back to guessing from the
	// user's system roles here, but that fabricated channel-scope
	// information from system-scope data and silently masked the
	// underlying inconsistency. Returning "" makes the caller skip the
	// channel scope (same as the not-a-member path) and the WARN log
	// surfaces the row state so operators can investigate.
	rctx.Logger().Warn(
		"Channel member exists but channel role could not be resolved; treating as no channel scope",
		mlog.String("user_id", userID),
		mlog.String("channel_id", channelID),
		mlog.String("roles", cm.Roles),
		mlog.Bool("scheme_admin", cm.SchemeAdmin),
		mlog.Bool("scheme_user", cm.SchemeUser),
		mlog.Bool("scheme_guest", cm.SchemeGuest),
	)
	return "", nil
}

// ResolveSystemRole returns the highest-precedence base system role token
// from a space-separated roles string. The check order is deterministic:
// system_admin > system_guest > system_user. Custom/admin-managed roles
// without a recognised base default to system_user so the permission-policy
// lane is never silently skipped.
func ResolveSystemRole(roles string) string {
	tokens := strings.Fields(roles)
	if slices.Contains(tokens, model.SystemAdminRoleId) {
		return model.SystemAdminRoleId
	}
	if slices.Contains(tokens, model.SystemGuestRoleId) {
		return model.SystemGuestRoleId
	}
	if slices.Contains(tokens, model.SystemUserRoleId) {
		return model.SystemUserRoleId
	}
	return model.SystemUserRoleId
}

// refreshAttributeViewIfStale refreshes the materialized AttributeView if the last
// refresh was more than attributeViewRefreshInterval ago. The refresh is non-blocking:
// if another goroutine is already refreshing, this call returns immediately.
func (a *App) refreshAttributeViewIfStale(rctx request.CTX) {
	ch := a.Srv().Channels()

	if !ch.attributeViewRefreshMut.TryLock() {
		return
	}
	defer ch.attributeViewRefreshMut.Unlock()

	if time.Since(ch.attributeViewRefreshLast) < attributeViewRefreshInterval {
		return
	}

	if err := a.Srv().Store().Attributes().RefreshAttributes(); err != nil {
		rctx.Logger().Warn("Failed to refresh attribute materialized view", mlog.Err(err))
		return
	}

	ch.attributeViewRefreshLast = time.Now()
}
