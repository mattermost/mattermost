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

	// ABAC is gated at route registration; only check masking here. Masking is
	// attribute-based: edits are allowed with masked values present as long as
	// the caller doesn't drop a condition holding values they couldn't see.
	if a.Config().FeatureFlags.AttributeValueMasking {
		session := rctx.Session()
		if session == nil {
			return nil, model.NewAppError("CreateOrUpdateAccessControlPolicy", "api.context.session_expired.app_error", nil, "session required for masking validation", http.StatusUnauthorized)
		}
		callerID := session.UserId

		resolver, appErr := newMaskingResolver(a, rctx, callerID)
		if appErr != nil {
			return nil, model.NewAppError("CreateOrUpdateAccessControlPolicy", "app.pap.save_policy.resolver_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}

		// Validate submitted values BEFORE merge: only the values the caller
		// actually submitted should be checked against their holdings. Running
		// validation after merge would reject the re-injected hidden values
		// (e.g. Bravo, Charlie) that the caller legitimately cannot see.
		appErr = a.validatePolicyExpressionValues(rctx, policy, resolver)
		if appErr != nil {
			return nil, appErr
		}

		// Merge hidden values back in and block deletion of masked conditions.
		mergedHidden, appErr := a.mergeStoredPolicyExpressions(rctx, policy, resolver)
		if appErr != nil {
			return nil, appErr
		}

		// Guard against persisting the sentinel as a real value.
		if appErr := rejectMaskedTokens(policy); appErr != nil {
			return nil, appErr
		}

		// Self-inclusion check applies only to non-admins. System admins may
		// legitimately set conditions for attributes they do not personally hold
		// (e.g., creating a "Clearance == Top Secret" rule without holding that
		// clearance themselves). Masking and write-path value validation still
		// apply to system admins above.
		if !a.HasPermissionTo(callerID, model.PermissionManageSystem) {
			if appErr := a.checkSelfInclusion(rctx, policy, callerID, mergedHidden); appErr != nil {
				return nil, appErr
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
	case model.AccessControlPolicyTypeTeam:
		a.publishTeamPolicyEnforcedUpdate(rctx, policy.ID)
	case model.AccessControlPolicyTypeParent:
		a.publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx, policy.ID)
		a.publishTeamPolicyEnforcedForTeamPoliciesWithImport(rctx, policy.ID)
	}

	return policy, nil
}

// policyHasMaskedValuesForCaller returns true if policy contains any attribute values
// that are not visible to callerID under the current masking rules.
func (a *App) policyHasMaskedValuesForCaller(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) (bool, *model.AppError) {
	if policy == nil {
		return false, nil
	}

	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, nil
	}

	resolver, appErr := newMaskingResolver(a, rctx, callerID)
	if appErr != nil {
		return false, appErr
	}

	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		hasMasked, appErr := acs.HasMaskedValuesForCaller(rctx, rule.Expression, resolver)
		if appErr != nil {
			return false, appErr
		}
		if hasMasked {
			return true, nil
		}
	}

	return false, nil
}

// mergeStoredPolicyExpressions re-injects hidden values from the stored policy into the
// submitted one, and blocks the save if the caller removed a condition that contained
// values they cannot see (which would silently widen access beyond what they could audit).
// No-op for new policies (not found in store). Returns true when hidden values were re-injected.
func (a *App) mergeStoredPolicyExpressions(rctx request.CTX, policy *model.AccessControlPolicy, resolver model.MaskingFieldResolver) (bool, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, nil
	}

	existingPolicy, appErr := acs.GetPolicy(rctx, policy.ID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
		return false, appErr
	}

	// Pair submitted and stored rules by Name so that a reorder /
	// insert / delete in the editor doesn't swap one rule's masked
	// values into a sibling rule's expression. v0.4 permission rules
	// are required to carry a unique Name; the membership rule (no
	// Name) is pinned by its membership Action so it round-trips
	// through reorders too.
	storedByName := make(map[string]*model.AccessControlPolicyRule, len(existingPolicy.Rules))
	var storedMembership *model.AccessControlPolicyRule
	for i := range existingPolicy.Rules {
		r := &existingPolicy.Rules[i]
		switch {
		case r.Name != "":
			storedByName[r.Name] = r
		case isMembershipRule(r):
			if storedMembership == nil {
				storedMembership = r
			}
		}
	}

	pairedNames := make(map[string]bool, len(existingPolicy.Rules))
	membershipPaired := false
	mergedHidden := false

	for i := range policy.Rules {
		rule := &policy.Rules[i]
		var stored *model.AccessControlPolicyRule
		switch {
		case rule.Name != "":
			stored = storedByName[rule.Name]
			if stored != nil {
				pairedNames[rule.Name] = true
			}
		case isMembershipRule(rule):
			if !membershipPaired {
				stored = storedMembership
				membershipPaired = true
			}
		}
		if stored == nil {
			// New rule with no corresponding stored entry — nothing to
			// re-inject. The validate step (when run from the save
			// path) is what rejects forbidden literals on a brand-new
			// rule; the merge has nothing useful to do here.
			continue
		}
		if stored.Expression == "" || stored.Expression == "true" {
			continue
		}
		// Snapshot the caller-submitted expression so we can tell
		// post-merge whether mergeExpressionWithMaskedValues actually
		// re-injected hidden literals (vs. echoing the submission
		// back unchanged). Doing this here, before the merge call,
		// lets the Actions-locking guard below use a plain `!=` check
		// regardless of whether `rule` is a pointer or a copy.
		submittedExpr := rule.Expression
		mergedExpr, appErr := a.mergeExpressionWithMaskedValues(rctx, submittedExpr, stored.Expression, resolver)
		if appErr != nil {
			return false, appErr
		}
		rule.Expression = mergedExpr
		// Hidden values were re-injected → caller was working from a
		// masked view. Lock Actions AND Role to stored so they can't
		// silently swap the gate's action type or role audience while
		// reusing the hidden CEL.
		if mergedExpr != submittedExpr {
			rule.Actions = stored.Actions
			rule.Role = stored.Role
			mergedHidden = true
		}
	}

	// Any stored rule the caller didn't include in the submission was
	// dropped. If a dropped rule carries values the caller couldn't
	// see, block the save — otherwise we'd silently widen access by
	// removing a rule whose hidden conditions the caller could not
	// audit. Same side-channel reasoning as the per-condition
	// deletion guard inside mergeExpressionWithMaskedValues.
	for i := range existingPolicy.Rules {
		stored := &existingPolicy.Rules[i]
		switch {
		case stored.Name != "":
			if pairedNames[stored.Name] {
				continue
			}
		case isMembershipRule(stored):
			if membershipPaired {
				continue
			}
		default:
			// Legacy anonymous non-membership rule — can't safely
			// identify it across the submission boundary, skip the
			// guard rather than reject every save.
			continue
		}
		if stored.Expression == "" || stored.Expression == "true" {
			continue
		}
		hasMasked, appErr := a.expressionHasMaskedValuesForCaller(rctx, stored.Expression, resolver)
		if appErr != nil {
			return false, appErr
		}
		if hasMasked {
			return false, saveForbiddenError(rctx, "MergeStoredPolicyExpressions", "masked_rule_deleted: cannot remove a rule that contains attribute values you do not hold")
		}
	}

	return mergedHidden, nil
}

// isMembershipRule reports whether a rule fills the policy's
// membership slot for the merge-time pairing logic. v0.4 membership
// rules carry no Name and the membership action; legacy v0.1/v0.2
// channel policies used the wildcard "*" (rejected at v0.3+ IsValid)
// for the same role, so both anchor the same single storedMembership
// pairing slot.
func isMembershipRule(rule *model.AccessControlPolicyRule) bool {
	if rule == nil || rule.Name != "" {
		return false
	}
	return slices.Contains(rule.Actions, model.AccessControlPolicyActionMembership) ||
		slices.Contains(rule.Actions, "*")
}

// expressionHasMaskedValuesForCaller reports whether storedExpr contains any value the caller cannot see.
func (a *App) expressionHasMaskedValuesForCaller(rctx request.CTX, storedExpr string, resolver model.MaskingFieldResolver) (bool, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, model.NewAppError("expressionHasMaskedValuesForCaller", "app.pap.has_masked_values.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	return acs.HasMaskedValuesForCaller(rctx, storedExpr, resolver)
}

// mergeExpressionWithMaskedValues re-injects hidden values from storedExpr into
// submittedExpr using the canonical CEL AST walker. Returns submittedExpr unchanged
// when storedExpr contains no values hidden from the caller (the canonical merge's
// own fast path). Returns 403 if the caller dropped an AST node that held hidden
// values, or if the submitted tree shape diverges from stored while hidden values
// are present.
func (a *App) mergeExpressionWithMaskedValues(rctx request.CTX, submittedExpr, storedExpr string, resolver model.MaskingFieldResolver) (string, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return "", model.NewAppError("mergeExpressionWithMaskedValues", "app.pap.merge_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// No separate has-masked pre-check here: MergeExpressionWithMaskedValuesCanonical
	// already short-circuits to submittedExpr when stored has nothing hidden, so an
	// extra walk would only re-parse and re-scan the stored expression.
	return acs.MergeExpressionWithMaskedValuesCanonical(rctx, submittedExpr, storedExpr, resolver)
}

// saveForbiddenError logs the rejection reason internally and returns a generic 403.
func saveForbiddenError(rctx request.CTX, where, internalReason string) *model.AppError {
	rctx.Logger().Info("save policy refused (see internal_reason for details)",
		mlog.String("where", where),
		mlog.String("internal_reason", internalReason),
	)
	return model.NewAppError(where, "app.pap.save_policy.forbidden", nil, "", http.StatusForbidden)
}

// checkSelfInclusion verifies the caller satisfies all policy rules after their edit.
// When mergedHidden is true (hidden values were re-injected), a self-exclusion failure
// returns the generic forbidden error; otherwise the specific self_exclusion error is used.
func (a *App) checkSelfInclusion(rctx request.CTX, policy *model.AccessControlPolicy, callerID string, mergedHidden bool) *model.AppError {
	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}

		matches, appErr := a.ValidateExpressionAgainstRequester(rctx, rule.Expression, callerID)
		if appErr != nil {
			return appErr
		}
		if !matches {
			if mergedHidden {
				return saveForbiddenError(rctx, "checkSelfInclusion", "self_exclusion: you do not satisfy one or more conditions in this policy")
			}
			return model.NewAppError("checkSelfInclusion", "app.pap.save_policy.self_exclusion", nil, "", http.StatusForbidden)
		}
	}

	return nil
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

	// ABAC is gated at route registration; only check masking here.
	if a.Config().FeatureFlags.AttributeValueMasking {
		session := rctx.Session()
		if session != nil {
			callerID := session.UserId
			if hasMasked, appErr := a.policyHasMaskedValuesForCaller(rctx, policy, callerID); appErr != nil {
				return appErr
			} else if hasMasked {
				return model.NewAppError("DeleteAccessControlPolicy", "app.pap.delete_policy.masked_values", nil, "", http.StatusForbidden)
			}
		}
	}

	var affectedChannelIDs []string
	var affectedTeamIDs []string
	if policy != nil && policy.Type == model.AccessControlPolicyTypeParent {
		affectedChannelIDs = a.channelPolicyIDsWithImport(rctx, id)
		affectedTeamIDs = a.teamPolicyIDsWithImport(rctx, id)
	}

	if appErr := acs.DeletePolicy(rctx, id); appErr != nil {
		return appErr
	}

	// Parent deletes leave child rows in place (their dangling Imports are
	// reconciled lazily); we only fan out a refresh per affected resource.
	switch {
	case policy == nil:
		// GetPolicy is expected to return a non-nil policy on success, but the
		// surrounding code already guards against nil; keep the switch consistent
		// so a future (nil, nil) return can never dereference policy.Type.
	case policy.Type == model.AccessControlPolicyTypeChannel:
		a.publishChannelPolicyEnforcedUpdate(rctx, id)
	case policy.Type == model.AccessControlPolicyTypeTeam:
		a.publishTeamPolicyEnforcedUpdate(rctx, id)
	case policy.Type == model.AccessControlPolicyTypeParent:
		a.publishChannelPolicyEnforcedUpdatesForChannels(rctx, affectedChannelIDs)
		a.publishTeamPolicyEnforcedUpdatesForTeams(rctx, affectedTeamIDs)
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

	// The editor masks raw CEL literal values for callers who don't
	// hold them on every GET / search response, replacing them with
	// the "--------" sentinel. The frontend hands that masked policy
	// right back to us when the admin clicks "Simulate access", so
	// without re-injecting the stored hidden values the simulator
	// would evaluate the sentinel as a literal — every condition
	// would compare against "--------" and the verdicts would be
	// meaningless.
	//
	// Reuse the same per-rule merge the save path uses to re-inject
	// the stored hidden values so the simulator evaluates the real
	// CEL. We deliberately do NOT run the save-side write-path value
	// validation here: simulate doesn't persist anything, so
	// rejecting submissions that carry forbidden literal values is a
	// save-only invariant. The merge alone is what makes the
	// simulator see the unmasked policy.
	if a.Config().FeatureFlags.AttributeValueMasking {
		callerID := ""
		if s := rctx.Session(); s != nil {
			callerID = s.UserId
		}
		if callerID == "" {
			return nil, model.NewAppError("SimulateAccessControlPolicyForUsers", "api.context.session_expired.app_error", nil, "session required for simulation when attribute value masking is enabled", http.StatusUnauthorized)
		}
		resolver, appErr := newMaskingResolver(a, rctx, callerID)
		if appErr != nil {
			return nil, model.NewAppError("SimulateAccessControlPolicyForUsers", "app.pap.simulate.resolver_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}
		if _, mergeAppErr := a.mergeStoredPolicyExpressions(rctx, params.Policy, resolver); mergeAppErr != nil {
			return nil, mergeAppErr
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

			// mergeStoredPolicyExpressions re-injected the stored hidden
			// values so the simulator could evaluate the real CEL — and
			// enrichBlameForDraftScope just copied those unmasked
			// expressions into Blame.Expression / MergedRules / the
			// evaluation tree. Re-mask every literal-bearing surface
			// before the response leaves the server so the caller never
			// sees a value they couldn't see via the policy GET path.
			a.MaskSimulationPolicyLiteralsForCaller(rctx, resp, callerID)
		}

		return resp, nil
	}

	// Masking disabled: simulate without merge or response masking.
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
// "this rule only" mode. The empty string is included as a defensive
// belt-and-braces fallback for callers that bypass the api4 handler's
// normalisation (it forces "" → this_rule per the model docstring
// default). Direct App.SimulateAccessControlPolicyForUsers callers
// in tests / future RPC entry points may still hit this helper with
// a raw empty string; we treat it consistently with the documented
// model default rather than letting it silently fall through to
// "all" semantics.
func isThisRuleScope(scope string) bool {
	return scope == "" || scope == model.PolicyEvaluationScopeThisRule
}

// userAttributesPathPrefix is the canonical CEL prefix the simulator
// records on leaf evaluation-tree nodes for user-attribute references
// (e.g. `user.attributes.Clearance`). The CPA field name is the
// suffix; we strip the prefix to match against the protected set
// indexed by field name.
const userAttributesPathPrefix = "user.attributes."

// RedactSimulationAttributesForCaller strips attribute values from a
// PolicySimulationResponse on every surface the picker exposes
// (top-level user/session Attributes maps AND the per-leaf
// ActualValue inside same-scope blame evaluation trees) when the
// caller is not a system admin.
//
// A field is treated as protected — and therefore redacted — when
// any of the following applies (channel and team admins are never a
// CPA field's source plugin, so the access_mode branches collapse
// to "not public" for these callers):
//
//   - `visibility == "hidden"`: the field is hidden on the user
//     profile page; the simulate UI must not be a side channel.
//
//   - `access_mode == "source_only"`: the CPA value is reserved for
//     the source plugin. Channel/team admins are never plugin
//     callers, so the value is always inaccessible to them.
//
//   - `access_mode == "shared_only"`: the underlying property
//     service computes an intersection of the caller's and target's
//     values on read. The simulator does NOT call the property
//     service (it reads from AttributeView directly), so we
//     conservatively redact these values rather than ship them
//     unfiltered.
//
// System admins (passed via callerIsSystemAdmin=true) bypass the
// filter entirely; they always see every attribute the simulator
// recorded.
//
// On failure to look up the CPA fields we *strip every attribute map*
// and clear every evaluation tree's ActualValue, rather than leaking
// a value through a transient error — the fail-closed default mirrors
// how `BuildAccessControlSubject` treats a missing channel-role
// lookup.
func (a *App) RedactSimulationAttributesForCaller(rctx request.CTX, resp *model.PolicySimulationResponse, callerIsSystemAdmin bool) {
	if resp == nil || callerIsSystemAdmin {
		return
	}

	// Cheap-out when no result row carries any of the redactable
	// surfaces (top-level Attributes maps or blame evaluation trees) —
	// saves the CPA fetch on the common "deny chip only, no Decision
	// Details panel" UX.
	if !simulationHasRedactableAttributeData(resp) {
		return
	}

	protected, err := a.protectedCPAFieldNamesForCaller(rctx)
	if err != nil {
		rctx.Logger().Warn(
			"RedactSimulationAttributesForCaller: failed to load CPA fields; redacting every simulation attribute surface as a fail-closed default",
			mlog.Err(err),
		)
		// Fail closed: drop every attribute snapshot AND every leaf
		// `actual_value` rather than leak a protected field through a
		// transient lookup failure.
		clearAllSimulationAttributes(resp)
		clearAllEvaluationTreeActualValues(resp)
		return
	}
	if len(protected) == 0 {
		return
	}

	stripProtectedAttributes(resp, protected)
	redactProtectedEvaluationTreeActualValues(resp, protected)
}

// protectedCPAFieldNamesForCaller returns the set of CPA field names
// whose contents must be hidden from a non-system-admin caller. The
// set includes both `visibility: hidden` fields and any field whose
// `access_mode` is not public (source_only / shared_only). The
// simulator's AttributeView populates its per-user map keyed by
// `pf.Name` (see db/migrations/postgres/000137_update_attribute_view.up.sql),
// and the evaluation-tree walker likewise records `user.attributes.<name>`
// on each leaf — so matching by name is correct for both.
func (a *App) protectedCPAFieldNamesForCaller(rctx request.CTX) (map[string]struct{}, error) {
	group, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, appErr
	}

	propertyFields, appErr := a.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		ObjectTypes: []string{model.PropertyFieldObjectTypeUser},
		PerPage:     model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		return nil, appErr
	}

	protected := map[string]struct{}{}
	for _, pf := range propertyFields {
		if pf == nil {
			continue
		}
		f, err := model.NewCPAFieldFromPropertyField(pf)
		if err != nil {
			// Fail-closed: an unparseable field is treated as protected
			// rather than leaked through the masking layer as public.
			rctx.Logger().Warn("Failed to parse property field for CPA protection check; treating as protected",
				mlog.String("field_name", pf.Name),
				mlog.String("field_id", pf.ID),
				mlog.Err(err),
			)
			protected[pf.Name] = struct{}{}
			continue
		}
		if cpaFieldIsProtectedForChannelAdmin(f) {
			protected[f.Name] = struct{}{}
		}
	}
	return protected, nil
}

// cpaFieldIsProtectedForChannelAdmin reports whether a CPA field's
// value must be hidden from a non-system-admin caller. Pure helper
// so the protected-set construction and the per-leaf tree walker can
// share the same predicate.
func cpaFieldIsProtectedForChannelAdmin(f *model.CPAField) bool {
	if f == nil {
		return false
	}
	if f.Attrs.Visibility == model.CustomProfileAttributesVisibilityHidden {
		return true
	}
	// access_mode "" defaults to public — only non-public values are
	// protected. Channel/team admins are never the source plugin so
	// both source_only and shared_only collapse to "inaccessible".
	if f.Attrs.AccessMode != "" && f.Attrs.AccessMode != model.PropertyAccessModePublic {
		return true
	}
	return false
}

// simulationHasRedactableAttributeData reports whether any result row
// carries a non-empty top-level `Attributes` map at the user OR
// session level, or any blame entry whose `EvaluationTree` (or
// per-rule subtree under MergedRules) might leak a leaf
// `ActualValue`. Used to short-circuit the redact pass when the
// response is purely "decision chips only" with no Decision Details
// data to redact.
func simulationHasRedactableAttributeData(resp *model.PolicySimulationResponse) bool {
	if resp == nil {
		return false
	}
	for i := range resp.Results {
		r := &resp.Results[i]
		if len(r.Attributes) > 0 {
			return true
		}
		for j := range r.Decisions {
			if decisionCarriesActualValue(r.Decisions[j]) {
				return true
			}
		}
		for j := range r.Sessions {
			if len(r.Sessions[j].Attributes) > 0 {
				return true
			}
			for k := range r.Sessions[j].Decisions {
				if decisionCarriesActualValue(r.Sessions[j].Decisions[k]) {
					return true
				}
			}
		}
	}
	return false
}

// decisionCarriesActualValue reports whether any blame entry on the
// decision has an evaluation tree (either at the top level or under a
// merged-rule entry) that could leak an `ActualValue`.
func decisionCarriesActualValue(dec model.PolicySimulationActionDecision) bool {
	for i := range dec.Blame {
		b := &dec.Blame[i]
		if b.EvaluationTree != nil {
			return true
		}
		for j := range b.MergedRules {
			if b.MergedRules[j].EvaluationTree != nil {
				return true
			}
		}
	}
	return false
}

// stripProtectedAttributes deletes any key in `protected` from every
// result row's user-level and per-session top-level Attributes maps in
// `resp`. Mutates `resp` in place; safe to call when `protected` is
// empty (no-op). This handles the top-level snapshot the Decision
// Details panel renders as a User/Session attributes table.
func stripProtectedAttributes(resp *model.PolicySimulationResponse, protected map[string]struct{}) {
	if resp == nil || len(protected) == 0 {
		return
	}
	for i := range resp.Results {
		r := &resp.Results[i]
		for name := range protected {
			delete(r.Attributes, name)
		}
		for j := range r.Sessions {
			for name := range protected {
				delete(r.Sessions[j].Attributes, name)
			}
		}
	}
}

// redactProtectedEvaluationTreeActualValues walks every blame entry's
// EvaluationTree (and the per-rule subtrees attached under
// MergedRules) on every result and session decision in `resp`. For
// each leaf node whose `Attribute` references a protected CPA field
// (path format `user.attributes.<name>`), the leaf's `ActualValue`
// is blanked.
//
// Why ActualValue and nothing else:
//   - `Attribute` is the path; it already appears in the rule's
//     `Expression`, which the channel admin can see.
//   - `ExpectedValue` is the literal from the rule (e.g. `"il5"`),
//     not the user's data — also already in `Expression`.
//   - `ActualValue` is the only field that records the target user's
//     concrete attribute value. That's the one we must redact.
func redactProtectedEvaluationTreeActualValues(resp *model.PolicySimulationResponse, protected map[string]struct{}) {
	if resp == nil || len(protected) == 0 {
		return
	}
	for i := range resp.Results {
		r := &resp.Results[i]
		for action, dec := range r.Decisions {
			redactProtectedActualValuesInDecision(&dec, protected)
			r.Decisions[action] = dec
		}
		for j := range r.Sessions {
			for action, dec := range r.Sessions[j].Decisions {
				redactProtectedActualValuesInDecision(&dec, protected)
				r.Sessions[j].Decisions[action] = dec
			}
		}
	}
}

func redactProtectedActualValuesInDecision(dec *model.PolicySimulationActionDecision, protected map[string]struct{}) {
	for i := range dec.Blame {
		b := &dec.Blame[i]
		if b.EvaluationTree != nil {
			redactProtectedActualValuesInTree(b.EvaluationTree, protected)
		}
		for j := range b.MergedRules {
			if b.MergedRules[j].EvaluationTree != nil {
				redactProtectedActualValuesInTree(b.MergedRules[j].EvaluationTree, protected)
			}
		}
	}
}

// redactProtectedActualValuesInTree recursively walks `node` and
// blanks the `ActualValue` on every leaf whose `Attribute` resolves
// to a CPA field in `protected`. Operates in place on the tree
// pointer the response shares with its parent blame entry.
func redactProtectedActualValuesInTree(node *model.PolicySimulationEvaluationNode, protected map[string]struct{}) {
	if node == nil {
		return
	}
	if isProtectedAttributePath(node.Attribute, protected) {
		node.ActualValue = ""
	}
	for i := range node.Children {
		redactProtectedActualValuesInTree(&node.Children[i], protected)
	}
}

// isProtectedAttributePath returns true when `path` is the canonical
// CEL form `user.attributes.<name>` and `<name>` is in `protected`.
// Returns false for empty paths and for any path that doesn't carry
// the user-attribute prefix (other shapes — function-call leaves,
// constant comparisons — are not user data).
func isProtectedAttributePath(path string, protected map[string]struct{}) bool {
	if path == "" || len(protected) == 0 {
		return false
	}
	name, ok := strings.CutPrefix(path, userAttributesPathPrefix)
	if !ok || name == "" {
		return false
	}
	_, found := protected[name]
	return found
}

// clearAllSimulationAttributes wipes every top-level user-level and
// per-session Attributes map in `resp`. Used as part of the fail-
// closed default when the CPA visibility lookup fails — a transient
// store error must not leak a hidden value to a channel admin via
// the simulator.
func clearAllSimulationAttributes(resp *model.PolicySimulationResponse) {
	if resp == nil {
		return
	}
	for i := range resp.Results {
		r := &resp.Results[i]
		r.Attributes = nil
		for j := range r.Sessions {
			r.Sessions[j].Attributes = nil
		}
	}
}

// clearAllEvaluationTreeActualValues wipes the `ActualValue` field on
// every leaf in every evaluation tree the response carries (top-level
// and per-merged-rule). Companion to `clearAllSimulationAttributes`
// for the fail-closed path: we don't know which fields are protected
// because the CPA lookup failed, so we redact every leaf rather than
// take the risk.
func clearAllEvaluationTreeActualValues(resp *model.PolicySimulationResponse) {
	if resp == nil {
		return
	}
	for i := range resp.Results {
		r := &resp.Results[i]
		for action, dec := range r.Decisions {
			clearActualValuesInDecision(&dec)
			r.Decisions[action] = dec
		}
		for j := range r.Sessions {
			for action, dec := range r.Sessions[j].Decisions {
				clearActualValuesInDecision(&dec)
				r.Sessions[j].Decisions[action] = dec
			}
		}
	}
}

func clearActualValuesInDecision(dec *model.PolicySimulationActionDecision) {
	for i := range dec.Blame {
		b := &dec.Blame[i]
		if b.EvaluationTree != nil {
			clearActualValuesInTree(b.EvaluationTree)
		}
		for j := range b.MergedRules {
			if b.MergedRules[j].EvaluationTree != nil {
				clearActualValuesInTree(b.MergedRules[j].EvaluationTree)
			}
		}
	}
}

func clearActualValuesInTree(node *model.PolicySimulationEvaluationNode) {
	if node == nil {
		return
	}
	node.ActualValue = ""
	for i := range node.Children {
		clearActualValuesInTree(&node.Children[i])
	}
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
//
// MergedRules is stripped alongside Expression / EvaluationTree:
// the per-rule list lets the picker number sub-rules of the
// contributing policy, which would amount to enumerating that
// policy's authored rules — exactly what the privacy boundary is
// supposed to hide. The simulator may have attached MergedRules
// unconditionally for ergonomics; we drop it here once the source is
// known to live above the editing scope.
func stripUpperScopedFields(blame *model.PolicySimulationBlame) {
	blame.Expression = ""
	blame.EvaluationTree = nil
	blame.MergedRules = nil
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
		// System admins are subject to ABAC the same as any other
		// user, BUT they don't carry the channel-level role tokens
		// (channel_user / channel_guest / channel_admin) the
		// simulator pairs rules against — they inherit them
		// implicitly. The simulator returns a bare {decision: true}
		// for sysadmin candidates without a this_rule blame, which
		// looks identical to the "rule doesn't apply (role
		// mismatch)" vacuous allow the filter relies on. Without a
		// sysadmin carve-out the marker would mislabel sysadmin
		// rows as "this rule doesn't apply" when in fact the rule
		// does apply via role fallback — the sysadmin is allowed
		// by the same rule the picker is testing. We pass the flag
		// down to filterDecisionsToEditingRuleScope so it can skip
		// the no_applicable_rule injection for those rows.
		callerIsSystemAdmin := false
		if u := resp.Results[i].User; u != nil {
			callerIsSystemAdmin = u.IsSystemAdmin()
		}
		resp.Results[i].Decisions = filterDecisionsToEditingRuleScope(resp.Results[i].Decisions, editingRuleName, callerIsSystemAdmin)
		for j := range resp.Results[i].Sessions {
			resp.Results[i].Sessions[j].Decisions = filterDecisionsToEditingRuleScope(resp.Results[i].Sessions[j].Decisions, editingRuleName, callerIsSystemAdmin)
		}
	}
}

func filterDecisionsToEditingRuleScope(decisions map[string]model.PolicySimulationActionDecision, editingRuleName string, candidateIsSystemAdmin bool) map[string]model.PolicySimulationActionDecision {
	if len(decisions) == 0 {
		return decisions
	}
	for action, dec := range decisions {
		filtered := filterBlameToEditingRuleScope(dec.Blame, editingRuleName)

		switch {
		case !dec.Decision && len(filtered) == 0:
			// DENY with no editing-rule contribution at all (only
			// upper-scoped / peer / sibling-rule denies, all of which
			// were just filtered out). The editing rule is silent on
			// this user, so we surface "doesn't apply" rather than
			// the old flip-to-plain-allow — that read as "this rule
			// alone would have allowed this user" which isn't true
			// for a permission rule whose filter didn't grant.
			//
			// Outcome is left empty (not OutcomeAllow) to match the
			// existing no_applicable_policy convention: the chip's
			// hasBlame helper filters informational outcome=allow
			// entries out, so a vacuous-allow synthetic must NOT set
			// outcome=allow or the chip will skip it.
			dec.Decision = true
			dec.Blame = []model.PolicySimulationBlame{{
				Source: model.PolicySimulationBlameSourceNoApplicableRule,
			}}
		case dec.Decision && !hasThisRuleAllow(filtered) && !hasNoApplicablePolicy(filtered) && !candidateIsSystemAdmin:
			// ALLOW without the editing rule actively granting. This
			// covers three real-world simulator outputs:
			//
			//   1. sibling_saved present — this rule denied, an
			//      OR-merged sibling allowed.
			//   2. Bare {decision: true} with empty blame — the
			//      simulator emits a vacuous allow when the editing
			//      rule's role doesn't match the candidate's role
			//      (e.g. testing a channel_user rule against a guest
			//      user), or the rule's action set doesn't overlap.
			//   3. Only upper-scoped allow blame survived the
			//      filter — same idea: the editing rule itself was
			//      silent on this user.
			//
			// In every case the editing rule didn't contribute a
			// grant, so in "this rule only" view the chip should read
			// "this rule doesn't apply". Append (don't replace) so
			// any sibling_saved expression stays available for the
			// Decision Details trace.
			//
			// Three carve-outs:
			//   - no_applicable_policy already attributes the verdict
			//     to the WHOLE policy being silent on this user;
			//     that's strictly more informative and we don't
			//     shadow it.
			//   - candidateIsSystemAdmin — sysadmins inherit every
			//     channel-level role implicitly, so a bare
			//     {decision: true} for a sysadmin candidate is a
			//     legitimate allow via role fallback, NOT a "rule
			//     doesn't apply" signal. The simulator just doesn't
			//     emit a this_rule blame entry for the fallback path.
			//   - this_rule allow + sibling_saved (handled by the
			//     hasThisRuleAllow guard above) — the rule did
			//     contribute, sibling is supplementary.
			dec.Blame = append(filtered, model.PolicySimulationBlame{
				Source: model.PolicySimulationBlameSourceNoApplicableRule,
			})
		default:
			dec.Blame = filtered
		}

		decisions[action] = dec
	}
	return decisions
}

// hasThisRuleAllow reports whether any blame entry is an
// informational this_rule entry with outcome=allow — i.e. the
// editing rule itself granted the subject. When this is true we
// must NOT convert to no_applicable_rule: the rule did contribute,
// any sibling_saved entry alongside is just supplementary
// "another rule also allowed" context.
func hasThisRuleAllow(blames []model.PolicySimulationBlame) bool {
	for _, b := range blames {
		if b.Source == model.PolicySimulationBlameSourceThisRule && b.Outcome == model.PolicySimulationBlameOutcomeAllow {
			return true
		}
	}
	return false
}

// hasNoApplicablePolicy reports whether the simulator already
// marked the response with a no_applicable_policy synthetic blame
// — the policy as a whole doesn't govern this user. We use the
// same "outcome != allow" gate the chip's hasBlame helper uses so
// our detection lines up with what the picker will actually
// render; this prevents us from shadowing a wider
// "policy doesn't apply" verdict with a narrower
// "this rule doesn't apply" pill.
func hasNoApplicablePolicy(blames []model.PolicySimulationBlame) bool {
	for _, b := range blames {
		if b.Source == model.PolicySimulationBlameSourceNoApplicablePolicy && b.Outcome != model.PolicySimulationBlameOutcomeAllow {
			return true
		}
	}
	return false
}

// editingRuleBlameSources lists the blame sources that originate inside
// the editing rule itself (or are synthetic markers about how the rule
// applies). Anything else — peer_policy (same scope, different policy),
// system_permission, channel_policy, and even sibling_rule (same policy,
// different rule) — is dropped when the caller asks for "this rule only".
//
// no_applicable_rule is not listed here because it's emitted POST-filter
// by filterDecisionsToEditingRuleScope itself, not by the simulator.
// Listing it here would have no effect; the filter would never see one.
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
		// blame entries that explicitly target it. sibling_saved is the
		// deliberate exception — by definition it names the rescuing
		// sibling, never the editing rule.
		if editingRuleName != "" && b.RuleName != "" && b.RuleName != editingRuleName &&
			b.Source != model.PolicySimulationBlameSourceSiblingSaved {
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

func (a *App) AssignAccessControlPolicyToTeams(rctx request.CTX, parentID string, teamIDs []string) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("AssignAccessControlPolicyToTeams", "app.pap.assign_access_control_policy_to_teams.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := a.GetAccessControlPolicy(rctx, parentID)
	if appErr != nil {
		return nil, appErr
	}

	if policy.Type != model.AccessControlPolicyTypeParent {
		return nil, model.NewAppError("AssignAccessControlPolicyToTeams", "app.pap.assign_access_control_policy_to_teams.app_error", nil, "Policy is not of type parent", http.StatusBadRequest)
	}

	teams, appErr := a.GetTeams(teamIDs)
	if appErr != nil {
		return nil, appErr
	}

	policies := make([]*model.AccessControlPolicy, 0, len(teamIDs))
	for _, team := range teams {
		if appErr := a.ValidateTeamEligibilityForAccessControl(rctx, team); appErr != nil {
			return nil, appErr
		}

		child, err := acs.GetPolicy(rctx, team.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			return nil, model.NewAppError("AssignAccessControlPolicyToTeams", "app.pap.assign_access_control_policy_to_teams.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if child == nil {
			child = &model.AccessControlPolicy{
				ID:       team.Id,
				Type:     model.AccessControlPolicyTypeTeam,
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
		a.publishTeamPolicyEnforcedUpdate(rctx, child.ID)
		policies = append(policies, child)
	}

	return policies, nil
}

func (a *App) UnassignPoliciesFromTeams(rctx request.CTX, policyID string, teamIDs []string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("UnassignPoliciesFromTeams", "app.pap.unassign_access_control_policy_from_teams.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	cps, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		Type:     model.AccessControlPolicyTypeTeam,
		ParentID: policyID,
		Limit:    1000,
	})
	if err != nil {
		return model.NewAppError("UnassignPoliciesFromTeams", "app.pap.unassign_access_control_policy_from_teams.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	childPolicies := make(map[string]bool)
	for _, p := range cps {
		childPolicies[p.ID] = true
	}

	for _, teamID := range teamIDs {
		if _, ok := childPolicies[teamID]; !ok {
			mlog.Warn("Policy is not assigned to the parent policy", mlog.String("team_id", teamID), mlog.String("parent_policy_id", policyID))
			continue
		}

		child, appErr := acs.GetPolicy(rctx, teamID)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromTeams", "app.pap.unassign_access_control_policy_from_teams.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}

		child.Imports = slices.DeleteFunc(child.Imports, func(importID string) bool {
			return importID == policyID
		})
		if len(child.Imports) == 0 && len(child.Rules) == 0 {
			// No imports and no custom rules left — the child only existed to
			// carry this parent assignment, so remove it. A child with custom
			// rules is kept (a team admin's rules must survive an unassign).
			if err := acs.DeletePolicy(rctx, child.ID); err != nil {
				return model.NewAppError("UnassignPoliciesFromTeams", "app.pap.unassign_access_control_policy_from_teams.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
			a.publishTeamPolicyEnforcedUpdate(rctx, teamID)
			continue
		}
		_, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromTeams", "app.pap.unassign_access_control_policy_from_teams.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
		a.publishTeamPolicyEnforcedUpdate(rctx, teamID)
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

	if len(attributes) == 0 {
		return attributes, nil
	}

	// Strip source_only and shared_only fields: their values must not be
	// exposed to channel members through the invite modal / members sidebar.
	// Fail closed: if the CPA group or a field cannot be resolved, omit that
	// field rather than leaking its values.
	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return map[string][]string{}, nil
	}

	for fieldName := range attributes {
		// Read directly from the store so this security filter sees the raw
		// access_mode, unaffected by property read hooks for the request caller.
		field, fieldErr := a.Srv().Store().PropertyField().GetFieldByNameForObjectType(rctx.Context(), cpaGroup.ID, "", model.PropertyFieldObjectTypeUser, fieldName)
		if fieldErr != nil {
			delete(attributes, fieldName)
			continue
		}
		switch field.GetAccessMode() {
		case model.PropertyAccessModeSourceOnly, model.PropertyAccessModeSharedOnly:
			delete(attributes, fieldName)
		}
	}

	return attributes, nil
}

func (a *App) GetAccessControlFieldsAutocomplete(rctx request.CTX, after string, limit int, callerID string) ([]*model.PropertyField, *model.AppError) {
	group, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Use property app layer to enforce access control
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)
	fields, appErr := a.SearchPropertyFields(rctxWithCaller, group.ID, model.PropertyFieldSearchOpts{
		ObjectType: model.PropertyFieldObjectTypeUser,
		Cursor: model.PropertyFieldSearchCursor{
			PropertyFieldID: after,
			CreateAt:        1,
		},
		PerPage: limit,
	})
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	// Native user attributes are synthetic (not persisted), so emit them once on
	// the first page to keep the cursor-paging contract intact. The API maps an
	// empty "after" to a 26-zero sentinel cursor (the lowest possible ID), so
	// treat both as the first page.
	if after == "" || after == strings.Repeat("0", 26) {
		fields = append(model.NativeUserAttributeFields(group.ID), fields...)
	}

	return fields, nil
}

func (a *App) UpdateAccessControlPoliciesActive(rctx request.CTX, updates []model.AccessControlPolicyActiveUpdate) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.update_access_control_policies_active.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Deactivating a policy is enforcement-equivalent to deleting it: the policy stops
	// filtering membership. Mirror the delete-path guard so a caller blocked from
	// deleting a policy with hidden values cannot achieve the same effect via deactivation.
	if a.Config().FeatureFlags.AttributeValueMasking {
		session := rctx.Session()
		if session != nil {
			callerID := session.UserId
			for _, u := range updates {
				if u.Active {
					continue // activation never widens access
				}
				policy, appErr := acs.GetPolicy(rctx, u.ID)
				if appErr != nil {
					return nil, appErr
				}
				if hasMasked, appErr := a.policyHasMaskedValuesForCaller(rctx, policy, callerID); appErr != nil {
					return nil, appErr
				} else if hasMasked {
					return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.delete_policy.masked_values", nil, "", http.StatusForbidden)
				}
			}
		}
	}

	policies, err := a.Srv().Store().AccessControlPolicy().SetActiveStatusMultiple(rctx, updates)
	if err != nil {
		return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.update_access_control_policies_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, policy := range policies {
		switch policy.Type {
		case model.AccessControlPolicyTypeChannel:
			a.publishChannelPolicyEnforcedUpdate(rctx, policy.ID)
		case model.AccessControlPolicyTypeTeam:
			a.publishTeamPolicyEnforcedUpdate(rctx, policy.ID)
		case model.AccessControlPolicyTypeParent:
			a.publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx, policy.ID)
			a.publishTeamPolicyEnforcedForTeamPoliciesWithImport(rctx, policy.ID)
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

func (a *App) publishTeamPolicyEnforcedUpdatesForTeams(rctx request.CTX, teamIDs []string) {
	seen := make(map[string]struct{}, len(teamIDs))
	for _, teamID := range teamIDs {
		if teamID == "" {
			continue
		}
		if _, ok := seen[teamID]; ok {
			continue
		}
		seen[teamID] = struct{}{}
		a.publishTeamPolicyEnforcedUpdate(rctx, teamID)
	}
}

// publishTeamPolicyEnforcedForTeamPoliciesWithImport broadcasts
// team_access_control_updated for every team-type policy that lists importID in
// its imports. Call only after the imported policy (parent) is persisted.
func (a *App) publishTeamPolicyEnforcedForTeamPoliciesWithImport(rctx request.CTX, importID string) {
	a.publishTeamPolicyEnforcedUpdatesForTeams(rctx, a.teamPolicyIDsWithImport(rctx, importID))
}

func (a *App) teamPolicyIDsWithImport(rctx request.CTX, importID string) []string {
	teamIDs := []string{}
	var cursor model.AccessControlPolicyCursor
	for {
		children, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeTeam,
			ParentID: importID,
			Cursor:   cursor,
			Limit:    accessControlChildPolicySearchLimit,
		})
		if err != nil {
			rctx.Logger().Warn("Failed to list team policies that import a policy; skipping team access control fan-out",
				mlog.String("imported_policy_id", importID),
				mlog.Err(err),
			)
			return teamIDs
		}
		for _, child := range children {
			teamIDs = append(teamIDs, child.ID)
		}
		if len(children) < accessControlChildPolicySearchLimit {
			break
		}
		cursor.ID = children[len(children)-1].ID
	}
	return teamIDs
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

// HydrateChannelPolicyActions populates ch.PolicyActions for a single channel
// when ch.PolicyEnforced is true, by looking up the per-action union from
// the AccessControlPolicies table. It's a no-op for channels without an
// attached policy, so the cost on the common no-policy path is zero — only
// the cheap PolicyEnforced=false branch is taken.
//
// Errors from the underlying store are returned as AppErrors; callers
// should treat them as the channel having no actions (fail-closed) for any
// membership-dependent gate. Hydration leaves PolicyEnforced untouched so
// the "any AC policy attached" semantic remains available for consumers
// that need it (admin UI, useChannelSystemPolicies).
func (a *App) HydrateChannelPolicyActions(rctx request.CTX, ch *model.Channel) *model.AppError {
	if ch == nil || !ch.PolicyEnforced {
		return nil
	}
	actions, err := a.Srv().Store().AccessControlPolicy().GetActionsForPolicy(rctx, ch.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			// Policy was deleted between the channel read and this lookup;
			// the channel row's PolicyEnforced flag will be reconciled on
			// the next write. Treat as "no actions" rather than failing.
			ch.PolicyActions = map[string]bool{}
			return nil
		}
		return model.NewAppError("HydrateChannelPolicyActions", "app.pap.hydrate_actions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	ch.PolicyActions = actions
	return nil
}

// HydrateChannelsPolicyActions does the same for a slice of channels, but
// batches the underlying store call for the subset of channels with
// PolicyEnforced=true. Channels with PolicyEnforced=false are left
// untouched and never reach the AccessControlPolicies table. Used by
// list endpoints to avoid an N+1 against the policy store.
func (a *App) HydrateChannelsPolicyActions(rctx request.CTX, channels []*model.Channel) *model.AppError {
	if len(channels) == 0 {
		return nil
	}
	var ids []string
	for _, ch := range channels {
		if ch == nil || !ch.PolicyEnforced {
			continue
		}
		ids = append(ids, ch.Id)
	}
	if len(ids) == 0 {
		return nil
	}
	actionsByID, err := a.Srv().Store().AccessControlPolicy().GetActionsForPolicies(rctx, ids)
	if err != nil {
		return model.NewAppError("HydrateChannelsPolicyActions", "app.pap.hydrate_actions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, ch := range channels {
		if ch == nil || !ch.PolicyEnforced {
			continue
		}
		if actions, ok := actionsByID[ch.Id]; ok {
			ch.PolicyActions = actions
		} else {
			// Policy row missing for an enforced channel — same semantics
			// as the single-channel ErrNotFound path: treat as empty rather
			// than fail the whole batch.
			ch.PolicyActions = map[string]bool{}
		}
	}
	return nil
}

// HydrateTeamPolicyActions populates team.PolicyActions for a single team
// when team.PolicyEnforced is true. Mirrors HydrateChannelPolicyActions: a
// no-op for teams without an attached policy, so the common no-policy path
// costs nothing. A store error is returned as an AppError; callers must
// treat it as fail-closed for any membership gate.
func (a *App) HydrateTeamPolicyActions(rctx request.CTX, team *model.Team) *model.AppError {
	if team == nil || !team.PolicyEnforced {
		return nil
	}
	actions, err := a.Srv().Store().AccessControlPolicy().GetActionsForPolicy(rctx, team.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			// Policy was deleted between the team read and this lookup;
			// treat as "no actions" rather than failing.
			team.PolicyActions = map[string]bool{}
			return nil
		}
		return model.NewAppError("HydrateTeamPolicyActions", "app.pap.hydrate_actions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	team.PolicyActions = actions
	return nil
}

// HydrateTeamsPolicyActions does the same for a slice of teams, batching the
// underlying store call for the subset with PolicyEnforced=true. Teams with
// PolicyEnforced=false never reach the AccessControlPolicies table. Used by
// list/directory paths to avoid an N+1 against the policy store.
func (a *App) HydrateTeamsPolicyActions(rctx request.CTX, teams []*model.Team) *model.AppError {
	if len(teams) == 0 {
		return nil
	}
	var ids []string
	for _, team := range teams {
		if team == nil || !team.PolicyEnforced {
			continue
		}
		ids = append(ids, team.Id)
	}
	if len(ids) == 0 {
		return nil
	}
	actionsByID, err := a.Srv().Store().AccessControlPolicy().GetActionsForPolicies(rctx, ids)
	if err != nil {
		return model.NewAppError("HydrateTeamsPolicyActions", "app.pap.hydrate_actions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, team := range teams {
		if team == nil || !team.PolicyEnforced {
			continue
		}
		if actions, ok := actionsByID[team.Id]; ok {
			team.PolicyActions = actions
		} else {
			// Policy row missing for an enforced team — same semantics as
			// the single-team ErrNotFound path: treat as empty rather than
			// fail the whole batch.
			team.PolicyActions = map[string]bool{}
		}
	}
	return nil
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

	// Ensure the broadcasted payload carries the freshly-hydrated action
	// map so clients can react to action-set changes without an extra
	// round-trip. GetChannel above already hydrates on cache miss, but
	// re-hydrating here keeps the behavior consistent if a cache hit
	// returned a channel without PolicyActions populated (e.g. a Phase 1
	// rollout where caches predate the hydration seam).
	if appErr := a.HydrateChannelPolicyActions(rctx, channel); appErr != nil {
		rctx.Logger().Warn("Failed to hydrate policy actions before broadcast; clients will see policy_actions=nil",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
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

// publishTeamPolicyEnforcedUpdate reloads the team, hydrates its policy
// actions, and broadcasts a team_access_control_updated websocket event so
// connected clients can refresh their view of the team's access control state
// (the shield indicator, Join button state, Team Settings banners). Mirrors
// publishChannelPolicyEnforcedUpdate. Teams are not cached per-id like
// channels, so a fresh GetTeam already reflects the post-mutation
// PolicyEnforced flag without an explicit cache invalidation.
//
// A hydrate failure logs a warning but still broadcasts (clients then see
// policy_actions=nil) — parity with the channel path.
func (a *App) publishTeamPolicyEnforcedUpdate(rctx request.CTX, teamID string) {
	team, appErr := a.GetTeam(teamID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load team after access control policy change",
			mlog.String("team_id", teamID),
			mlog.Err(appErr),
		)
		return
	}

	if appErr := a.HydrateTeamPolicyActions(rctx, team); appErr != nil {
		rctx.Logger().Warn("Failed to hydrate team policy actions before broadcast; clients will see policy_actions=nil",
			mlog.String("team_id", teamID),
			mlog.Err(appErr),
		)
	}

	// Sanitize before broadcasting to the whole team: this event reaches every
	// connected member, including those without InviteUser, so Email/InviteId
	// must be stripped. Sanitize() preserves PolicyEnforced/PolicyActions.
	sanitizedTeam := &model.Team{}
	*sanitizedTeam = *team
	sanitizedTeam.Sanitize()

	teamJSON, jsonErr := json.Marshal(sanitizedTeam)
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to marshal team after access control policy change",
			mlog.String("team_id", teamID),
			mlog.Err(jsonErr),
		)
		return
	}

	messageWs := model.NewWebSocketEvent(model.WebsocketEventTeamAccessControlUpdated, team.Id, "", "", nil, "")
	messageWs.Add("team", string(teamJSON))
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

// ValidateTeamEligibilityForAccessControl checks that a team is eligible for
// access control policy assignment. Group sync and ABAC are mutually exclusive
// on the same team, so a group-constrained team is rejected.
func (a *App) ValidateTeamEligibilityForAccessControl(rctx request.CTX, team *model.Team) *model.AppError {
	if team.IsGroupConstrained() {
		return model.NewAppError("ValidateTeamEligibilityForAccessControl",
			"api.access_control.assign.team_group_constrained",
			nil, "Team is group constrained", http.StatusBadRequest)
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
		// Authorization must not hinge on the policy already existing. A
		// channel policy uses its channel's ID as the policy ID, so when the
		// record is missing (e.g. a channel admin opening the Permissions
		// Policy tab before any policy has been created) fall back to a direct
		// channel-permission check. An authorized channel admin is then
		// allowed through so the caller's own lookup surfaces a clean 404
		// ("first-time create") instead of a misleading 403.
		if appErr.StatusCode == http.StatusNotFound {
			if channelErr := a.ValidateChannelAccessControlPermission(rctx, userID, policyID); channelErr == nil {
				return nil
			}
		}
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
		// Native attributes (user.email/verified/isbot/createat) describe the
		// requester themselves, not who they can include; strip them so the
		// self-inclusion check validates only the CPA-attribute parts.
		ExcludeNativeAttributes: true,
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
//
// Team join evaluations pass channelID="" — no channel role exists at join time.
func (a *App) BuildAccessControlSubject(rctx request.CTX, userID string, roles string, channelID string) (*model.Subject, *model.AppError) {
	a.refreshAttributeViewIfStale(rctx)

	group, err := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if err != nil {
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	subject, storeErr := a.Srv().Store().Attributes().GetSubject(rctx, userID, group.ID)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			subject = &model.Subject{
				ID:         userID,
				Type:       "user",
				Attributes: map[string]any{},
				Session:    map[string]any{},
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

	// Populate Mattermost-native user attributes (user.email / user.verified /
	// user.isbot / user.createat) for runtime PDP evaluation. a.GetUser is the
	// cached user read and already resolves IsBot via the Bots join, so this is
	// a single (usually cache-hit) lookup per subject build.
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		// Fail closed: a native-attribute policy must not silently evaluate
		// against zero-valued natives if the user read fails. The caller
		// treats a build error as a denial (mirrors the channel-role path).
		rctx.Logger().Warn("Failed to load user for ABAC native attributes; aborting subject build",
			mlog.String("user_id", userID),
			mlog.Err(appErr),
		)
		return nil, appErr
	}
	subject.Email = user.Email
	subject.EmailVerified = user.EmailVerified
	subject.IsBot = user.IsBot
	subject.CreateAt = user.CreateAt

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

func (a *App) BuildAccessControlSubjectForSession(rctx request.CTX, channelID string) (*model.Subject, *model.AppError) {
	subject, appErr := a.BuildAccessControlSubject(rctx, rctx.Session().UserId, rctx.Session().Roles, channelID)
	if appErr != nil {
		return nil, appErr
	}

	attrs, appErr := a.GetSessionAttributes(rctx.Session().Id)
	if appErr != nil {
		return nil, appErr
	}
	if attrs != nil {
		subject.Session = attrs
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

	// Inspect the Roles tokens deterministically rather than returning
	// whichever recognised token appears first in the space-separated
	// string. The legacy first-match-wins behaviour silently downgraded
	// a channel admin whose Roles happened to list
	// `channel_user channel_admin` (in either order, depending on how
	// the row was migrated).
	//
	// channel_admin is checked first because admin and user tokens
	// STACK on legacy rows — a promoted member carries both. Picking
	// admin when present matches the stacked-token reality.
	//
	// channel_guest is a separate lane: it represents an external
	// guest account, NOT a lower rung of the admin/user hierarchy.
	// In healthy data it never co-occurs with channel_user /
	// channel_admin (the SchemeGuest switch case above handles the
	// modern path), so checking it after the stacked-pair tokens is
	// purely defensive — only reached when SchemeGuest wasn't set
	// and `channel_guest` is the sole recognised token in the row.
	tokens := strings.Fields(cm.Roles)
	if slices.Contains(tokens, model.ChannelAdminRoleId) {
		return model.ChannelAdminRoleId, nil
	}
	if slices.Contains(tokens, model.ChannelUserRoleId) {
		return model.ChannelUserRoleId, nil
	}
	if slices.Contains(tokens, model.ChannelGuestRoleId) {
		return model.ChannelGuestRoleId, nil
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
