// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	teamPoliciesDefaultPerPage = 10
	teamPoliciesMaxFetch       = 1000
)

// SearchTeamAccessPolicies returns parent policies stored with this team's
// scope that the requester satisfies. Fetches the matching policies first,
// applies self-inclusion filtering, then paginates the result to keep totals accurate.
func (a *App) SearchTeamAccessPolicies(rctx request.CTX, teamID, requesterID string, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	requestedCursor := opts.Cursor
	requestedLimit := opts.Limit
	if requestedLimit <= 0 {
		requestedLimit = teamPoliciesDefaultPerPage
	}

	// Parents listed for a team are those stored with that team's scope.
	scopeOpts := opts
	scopeOpts.Type = model.AccessControlPolicyTypeParent
	scopeOpts.Scope = model.AccessControlPolicyScopeTeam
	scopeOpts.ScopeID = teamID
	scopeOpts.IncludeChildren = true
	scopeOpts.Cursor = model.AccessControlPolicyCursor{}
	scopeOpts.Limit = teamPoliciesMaxFetch

	policies, _, appErr := a.SearchAccessControlPolicies(rctx, scopeOpts)
	if appErr != nil {
		return nil, 0, appErr
	}

	// Sort by ID for stable cursor-based pagination.
	slices.SortFunc(policies, func(a, b *model.AccessControlPolicy) int {
		return cmp.Compare(a.ID, b.ID)
	})

	// Single batched Channel lookup for all policies' child_ids so we don't
	// issue GetChannelsByIds once per policy (N+1).
	unionSet := make(map[string]struct{})
	for _, policy := range policies {
		ids, ok := childIDsFromPolicyProps(policy)
		if !ok {
			continue
		}
		for _, id := range ids {
			unionSet[id] = struct{}{}
		}
	}
	union := make([]string, 0, len(unionSet))
	for id := range unionSet {
		union = append(union, id)
	}
	slices.Sort(union)

	var idToType map[string]model.ChannelType
	batchLookupFailed := false
	if len(union) > 0 {
		channels, err := a.Srv().Store().Channel().GetChannelsByIds(union, true)
		if err != nil {
			rctx.Logger().Warn("Failed to look up child channels for self-inclusion gating batch; keeping the filter on",
				mlog.Err(err),
				mlog.Int("policy_count", len(policies)),
			)
			batchLookupFailed = true
		} else {
			if len(channels) != len(union) {
				rctx.Logger().Warn("Partial batch child-channel lookup for self-inclusion gating",
					mlog.Int("requested", len(union)),
					mlog.Int("returned", len(channels)),
				)
			}
			idToType = make(map[string]model.ChannelType, len(channels))
			for _, ch := range channels {
				idToType[ch.Id] = ch.Type
			}
		}
	} else {
		idToType = map[string]model.ChannelType{}
	}

	// Filter by self-inclusion. Skip the filter for parent policies whose
	// children are all public channels — public-channel ABAC is advisory and
	// can never lock the requesting admin out, so a non-matching expression
	// is not a reason to hide the policy from them.
	filtered := make([]*model.AccessControlPolicy, 0, len(policies))
	for _, policy := range policies {
		effectiveRules := policy.EffectiveRules()
		if len(effectiveRules) > 0 && policyAppliesToPrivateChannel(rctx, policy, idToType, batchLookupFailed) {
			expression := effectiveRules[0].Expression
			matches, matchErr := a.ValidateExpressionAgainstRequester(rctx, expression, requesterID)
			if matchErr != nil {
				rctx.Logger().Warn("Failed to validate self-inclusion for policy",
					mlog.String("policy_id", policy.ID), mlog.Err(matchErr))
				continue
			}
			if !matches {
				continue
			}
		}
		filtered = append(filtered, policy)
	}

	total := int64(len(filtered))

	// Paginate the filtered results. If the cursor ID was removed by
	// self-inclusion filtering, startIdx stays 0 (resets to first page).
	startIdx := 0
	if !requestedCursor.IsEmpty() {
		for i, p := range filtered {
			if p.ID == requestedCursor.ID {
				startIdx = i + 1
				break
			}
		}
	}

	endIdx := min(startIdx+requestedLimit, len(filtered))

	return filtered[startIdx:endIdx], total, nil
}

// ValidateTeamAdminPolicyOwnership reports whether a parent policy belongs to teamID.
// A parent belongs to a team only when its first stored revision has scope=team
// and scope_id equal to that team.
// Returns (true, nil) when it does, (false, nil) when it does not,
// or (false, err) when the lookup fails.
func (a *App) ValidateTeamAdminPolicyOwnership(rctx request.CTX, teamID, policyID string) (bool, *model.AppError) {
	scopeResults, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		IDs:     []string{policyID},
		Type:    model.AccessControlPolicyTypeParent,
		Scope:   model.AccessControlPolicyScopeTeam,
		ScopeID: teamID,
		Limit:   1,
	})
	if err != nil {
		return false, model.NewAppError("ValidateTeamAdminPolicyOwnership",
			"app.team.access_policies.ownership_check.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return len(scopeResults) > 0, nil
}

// ReconcilePolicyTeamScope leaves a parent policy's scope unchanged, except when
// the policy already has scope=team and a channel's team is not ScopeID. In that
// case the scope is cleared. An empty scope stays empty, including when every
// channel is in one team. A team scope stays in place when there are no channels
// or when every returned channel's team is ScopeID.
func (a *App) ReconcilePolicyTeamScope(rctx request.CTX, policyID string) *model.AppError {
	// Find all child channel policies for this parent.
	// Limit of 1000 is ok, since In practice a single policy will not have 1000+ channel
	// private children.
	children, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		ParentID: policyID,
		Type:     model.AccessControlPolicyTypeChannel,
		Limit:    1000,
	})
	if err != nil {
		return model.NewAppError("ReconcilePolicyTeamScope",
			"app.team.access_policies.reconcile_scope.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// No channels — keep existing scope unchanged
	if len(children) == 0 {
		return nil
	}

	// Collect channel IDs (child policy ID = channel ID)
	channelIDs := make([]string, len(children))
	for i, child := range children {
		channelIDs[i] = child.ID
	}

	// Missing channel rows do not change the outcome: a returned channel in
	// another team still clears the scope.
	channels, appErr := a.GetChannels(rctx, channelIDs)
	if appErr != nil {
		return appErr
	}

	// Fetch the parent policy directly from the store (not the enterprise layer)
	// to avoid unnecessary CEL expression normalization — we only need scope fields.
	policy, storeErr := a.Srv().Store().AccessControlPolicy().Get(rctx, policyID)
	if storeErr != nil {
		return model.NewAppError("ReconcilePolicyTeamScope",
			"app.team.access_policies.reconcile_scope.app_error",
			nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	if policy.Scope != model.AccessControlPolicyScopeTeam {
		return nil
	}

	for _, ch := range channels {
		if ch.TeamId == policy.ScopeID {
			continue
		}

		policy.Scope = ""
		policy.ScopeID = ""

		// Save directly via the store — scope is metadata that doesn't require
		// enterprise-layer CEL normalization. This avoids re-processing expressions
		// and works consistently regardless of the enterprise layer state.
		if _, err := a.Srv().Store().AccessControlPolicy().Save(rctx, policy); err != nil {
			return model.NewAppError("ReconcilePolicyTeamScope",
				"app.team.access_policies.reconcile_scope.app_error",
				nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	}

	return nil
}

// ValidateTeamScopePolicyChannelAssignment validates that all channels are eligible
// for team policy assignment, is the gate that run before channels are attached to a 'team' policy:
//   - At least one channel provided
//   - All channels exist
//   - All channels belong to the given team
//   - All channels are public or private (DM/GM excluded)
//   - No group-constrained channels
//   - No shared channels
//   - No team default channels (e.g. town-square)
func (a *App) ValidateTeamScopePolicyChannelAssignment(rctx request.CTX, teamID string, channelIDs []string) *model.AppError {
	if len(channelIDs) == 0 {
		return model.NewAppError("ValidateTeamScopePolicyChannelAssignment",
			"app.team.access_policies.channels_required.app_error",
			nil, "at least one channel is required", http.StatusBadRequest)
	}

	channels, appErr := a.GetChannels(rctx, channelIDs)
	if appErr != nil {
		return appErr
	}

	if len(channels) != len(channelIDs) {
		return model.NewAppError("ValidateTeamScopePolicyChannelAssignment",
			"app.team.access_policies.channel_not_found.app_error",
			nil, "one or more channels not found", http.StatusBadRequest)
	}

	for _, channel := range channels {
		if channel.TeamId != teamID {
			return model.NewAppError("ValidateTeamScopePolicyChannelAssignment",
				"app.team.access_policies.channel_wrong_team.app_error",
				map[string]any{"ChannelId": channel.Id},
				"channel does not belong to this team", http.StatusBadRequest)
		}

		if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
			return appErr
		}
	}

	return nil
}

// ValidateTeamAdminSelfInclusion ensures the requesting admin satisfies the given
// CEL expression. Returns an error if the admin would be excluded by the expression.
func (a *App) ValidateTeamAdminSelfInclusion(rctx request.CTX, userID, expression string) *model.AppError {
	if expression == "" {
		return nil
	}

	matches, appErr := a.ValidateExpressionAgainstRequester(rctx, expression, userID)
	if appErr != nil {
		return model.NewAppError("ValidateTeamAdminSelfInclusion",
			"app.team.access_policies.validation_error.app_error",
			nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	if !matches {
		return model.NewAppError("ValidateTeamAdminSelfInclusion",
			"app.team.access_policies.self_exclusion.app_error",
			nil, "policy rules would exclude the requesting admin", http.StatusBadRequest)
	}

	return nil
}

// SendTeamAccessControlRemovalNotification DMs the user, from the system bot,
// that the team's membership policy removed them. The message carries only the
// team name — never any policy/attribute detail.
// The systemBot may be pre-resolved by the caller (the sync worker resolves it
// once per team rather than once per user, since GetSystemBot is not free); pass
// nil to have it resolved here.
func (a *App) SendTeamAccessControlRemovalNotification(rctx request.CTX, systemBot *model.Bot, userID string, team *model.Team) *model.AppError {
	locale := ""
	if user, err := a.GetUser(rctx, userID); err == nil {
		locale = user.Locale
	}
	T := i18n.GetUserTranslations(locale)
	message := T("api.team.access_control.removed.system_message", map[string]any{"TeamName": team.DisplayName})
	return a.sendTeamAccessControlMembershipDM(rctx, systemBot, userID, team, model.PostTypeAccessControlTeamRemoval, message)
}

// SendTeamAccessControlAdditionNotification DMs the user, from the system bot,
// that they were added to the team because they meet its membership policy. Like
// the removal DM, it leaks no policy detail. The membership audit record is
// emitted by AddTeamMemberByAccessPolicy, not here, so the two Send* helpers stay
// DM-only.
func (a *App) SendTeamAccessControlAdditionNotification(rctx request.CTX, systemBot *model.Bot, userID string, team *model.Team) *model.AppError {
	locale := ""
	if user, err := a.GetUser(rctx, userID); err == nil {
		locale = user.Locale
	}
	T := i18n.GetUserTranslations(locale)
	message := T("api.team.access_control.added.system_message", map[string]any{"TeamName": team.DisplayName})
	return a.sendTeamAccessControlMembershipDM(rctx, systemBot, userID, team, model.PostTypeAccessControlTeamAddition, message)
}

func (a *App) sendTeamAccessControlMembershipDM(rctx request.CTX, systemBot *model.Bot, userID string, team *model.Team, postType, message string) *model.AppError {
	if systemBot == nil {
		var appErr *model.AppError
		if systemBot, appErr = a.GetSystemBot(rctx); appErr != nil {
			return appErr
		}
	}

	channel, appErr := a.GetOrCreateDirectChannel(rctx, userID, systemBot.UserId)
	if appErr != nil {
		return appErr
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      postType,
		UserId:    systemBot.UserId,
		Props:     model.StringInterface{"team_name": team.DisplayName},
	}

	if _, _, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); appErr != nil {
		return appErr
	}
	return nil
}

// childIDsFromPolicyProps reads Props["child_ids"], which is normally []string
// (set by the policy store) but may be []any after JSON round-trip.
// If ok is false, the shape is unsupported and callers should treat it as unknown.
func childIDsFromPolicyProps(policy *model.AccessControlPolicy) (ids []string, ok bool) {
	if policy == nil || policy.Props == nil {
		return nil, false
	}
	switch raw := policy.Props["child_ids"].(type) {
	case []string:
		return raw, true
	case []any:
		out := make([]string, 0, len(raw))
		for _, item := range raw {
			if id, itemOk := item.(string); itemOk {
				out = append(out, id)
			}
		}
		return out, true
	default:
		return nil, false
	}
}

// policyAppliesToPrivateChannel reports whether a parent policy has at least
// one private child channel — used to gate the self-inclusion filter, which
// only matters when a non-matching admin could actually be locked out. Public
// channels under ABAC are advisory (no member removal, anyone can join), so
// a non-matching admin is never at risk there.
//
// idToType maps channel ID → channel type from a batched GetChannelsByIds;
// batchLookupFailed means the batch store call failed and the conservative
// answer is to apply the filter.
//
// Returns `true` (i.e. apply the filter) on metadata or lookup errors, since
// the safer fallback is to keep the existing behavior rather than silently
// expose a policy a private channel might depend on.
func policyAppliesToPrivateChannel(rctx request.CTX, policy *model.AccessControlPolicy, idToType map[string]model.ChannelType, batchLookupFailed bool) bool {
	if policy == nil || policy.Props == nil {
		return true
	}

	childIDs, propsOk := childIDsFromPolicyProps(policy)
	if !propsOk {
		return true
	}

	if len(childIDs) == 0 {
		// Channel-less policy (newly created, not yet assigned). Until a
		// channel is attached there's nothing to lock anyone out of, so the
		// filter is meaningless here.
		return false
	}

	if batchLookupFailed {
		return true
	}

	found := 0
	for _, id := range childIDs {
		if _, ok := idToType[id]; ok {
			found++
		}
	}
	if found != len(childIDs) {
		rctx.Logger().Warn("Partial child-channel lookup for self-inclusion gating; keeping the filter on",
			mlog.String("policy_id", policy.ID),
			mlog.Int("requested", len(childIDs)),
			mlog.Int("returned", found),
		)
		return true
	}
	for _, id := range childIDs {
		if idToType[id] == model.ChannelTypePrivate {
			return true
		}
	}
	return false
}
