// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	teamPoliciesDefaultPerPage = 10
	teamPoliciesMaxFetch       = 1000
)

// SearchTeamAccessPolicies returns team-scoped parent policies that the requester
// satisfies. Fetches all matching policies first, applies self-inclusion filtering,
// then paginates the result to keep totals accurate.
func (a *App) SearchTeamAccessPolicies(rctx request.CTX, teamID, requesterID string, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	requestedCursor := opts.Cursor
	requestedLimit := opts.Limit
	if requestedLimit <= 0 {
		requestedLimit = teamPoliciesDefaultPerPage
	}

	opts.TeamID = teamID
	opts.Type = model.AccessControlPolicyTypeParent
	opts.IncludeChildren = true
	opts.Cursor = model.AccessControlPolicyCursor{}
	opts.Limit = teamPoliciesMaxFetch

	policies, _, appErr := a.SearchAccessControlPolicies(rctx, opts)
	if appErr != nil {
		return nil, 0, appErr
	}

	// Filter by self-inclusion.
	filtered := make([]*model.AccessControlPolicy, 0, len(policies))
	for _, policy := range policies {
		if len(policy.Rules) > 0 {
			expression := policy.Rules[0].Expression
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

// ValidateTeamAdminPolicyOwnership checks whether a policy is scoped to a given team.
// Returns (true, nil) if the policy belongs to the team, (false, nil) if it does not,
// or (false, err) if an internal error occurred during the check.
//
// The SearchPolicies TeamID filter matches via two mechanisms in a single query:
//  1. Explicit scope: Data->>'scope' = 'team' AND Data->>'scope_id' = teamID
//  2. Channel inference: all assigned channels belong to this team (pre-scope policies)
func (a *App) ValidateTeamAdminPolicyOwnership(rctx request.CTX, teamID, policyID string) (bool, *model.AppError) {
	policies, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		IDs:    []string{policyID},
		Type:   model.AccessControlPolicyTypeParent,
		TeamID: teamID,
		Limit:  1,
	})
	if err != nil {
		return false, model.NewAppError("ValidateTeamAdminPolicyOwnership",
			"app.team.access_policies.ownership_check.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return len(policies) > 0, nil
}

// ReconcilePolicyTeamScope evaluates a parent policy's assigned channels and
// sets or clears the team scope accordingly:
//   - All channels belong to a single team → scope = "team", scope_id = that team
//   - Channels span multiple teams → scope cleared
//   - No channels remaining → scope unchanged (preserves the team set at creation)
//
// This runs after every assign/unassign regardless of the caller's role, so that
// system admins adding cross-team channels correctly clears the team scope.
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

	// Resolve channels to determine their teams
	channels, appErr := a.GetChannels(rctx, channelIDs)
	if appErr != nil {
		return appErr
	}

	// Check if all channels belong to a single team
	teamIDs := make(map[string]struct{})
	for _, ch := range channels {
		teamIDs[ch.TeamId] = struct{}{}
	}

	// Fetch the parent policy directly from the store (not the enterprise layer)
	// to avoid unnecessary CEL expression normalization — we only need scope fields.
	policy, storeErr := a.Srv().Store().AccessControlPolicy().Get(rctx, policyID)
	if storeErr != nil {
		return model.NewAppError("ReconcilePolicyTeamScope",
			"app.team.access_policies.reconcile_scope.app_error",
			nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	var newScope, newScopeID string
	if len(teamIDs) == 1 {
		// All channels belong to one team — set scope
		for tid := range teamIDs {
			newScope = model.AccessControlPolicyScopeTeam
			newScopeID = tid
		}
	}
	// len(teamIDs) > 1: multiple teams — clear scope (newScope/newScopeID stay "")

	// Skip save if nothing changed
	if policy.Scope == newScope && policy.ScopeID == newScopeID {
		return nil
	}

	policy.Scope = newScope
	policy.ScopeID = newScopeID

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

// ValidateTeamScopePolicyChannelAssignment validates that all channels are eligible
// for team policy assignment, is the gate that run before channels are attached to a 'team' policy:
//   - At least one channel provided
//   - All channels exist
//   - All channels belong to the given team
//   - All channels are private
//   - No group-constrained channels
//   - No shared channels
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

		if appErr := ValidateChannelEligibilityForAccessControl(channel); appErr != nil {
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
