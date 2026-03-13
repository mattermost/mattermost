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

	endIdx := startIdx + requestedLimit
	if endIdx > len(filtered) {
		endIdx = len(filtered)
	}

	return filtered[startIdx:endIdx], total, nil
}

// ValidateTeamAdminPolicyOwnership verifies that a policy is team-scoped to the
// given team. Returns an error if the policy doesn't exist, spans multiple teams,
// or belongs to a different team.
func (a *App) ValidateTeamAdminPolicyOwnership(rctx request.CTX, teamID, policyID string) *model.AppError {
	policies, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		IDs:    []string{policyID},
		Type:   model.AccessControlPolicyTypeParent,
		TeamID: teamID,
		Limit:  1,
	})
	if err != nil {
		return model.NewAppError("ValidateTeamAdminPolicyOwnership",
			"app.team.access_policies.ownership_check.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if len(policies) == 0 {
		return model.NewAppError("ValidateTeamAdminPolicyOwnership",
			"app.team.access_policies.policy_not_in_team.app_error",
			map[string]any{"PolicyId": policyID, "TeamId": teamID},
			"policy is not scoped to this team", http.StatusForbidden)
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
