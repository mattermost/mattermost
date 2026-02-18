// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const maxChannelsPerPolicyLookup = 1000

// IsPolicyTeamScoped checks if a policy's assigned channels all belong to the given team.
// Returns true only if:
//   - The policy has at least one channel importing it, AND
//   - ALL channels importing this policy belong to teamID
func (a *App) IsPolicyTeamScoped(rctx request.CTX, policyID, teamID string) (bool, *model.AppError) {
	channels, _, appErr := a.GetChannelsForPolicy(rctx, policyID, model.AccessControlPolicyCursor{}, maxChannelsPerPolicyLookup)
	if appErr != nil {
		return false, appErr
	}

	if len(channels) == 0 {
		return false, nil
	}

	for _, channel := range channels {
		if channel.TeamId != teamID {
			return false, nil
		}
	}

	return true, nil
}

// GetPolicyTeamScope returns the team ID if the policy is team-scoped (all channels
// belong to the same team), or empty string if the policy is system-scoped.
func (a *App) GetPolicyTeamScope(rctx request.CTX, policyID string) (string, *model.AppError) {
	channels, _, appErr := a.GetChannelsForPolicy(rctx, policyID, model.AccessControlPolicyCursor{}, maxChannelsPerPolicyLookup)
	if appErr != nil {
		return "", appErr
	}

	if len(channels) == 0 {
		return "", nil
	}

	firstTeamID := channels[0].TeamId
	for _, channel := range channels[1:] {
		if channel.TeamId != firstTeamID {
			return "", nil
		}
	}

	return firstTeamID, nil
}

// SearchTeamAccessPolicies returns parent policies visible to the given Team Admin.
// A policy is visible only if:
//  1. It is a parent policy
//  2. All its assigned channels belong to the given team (team-scoped)
//  3. The requesting admin satisfies the policy's access rules (self-inclusion)
//
// Post-query filtering is required because scope is derived at runtime from
// channel relationships, not stored as a column.
func (a *App) SearchTeamAccessPolicies(rctx request.CTX, teamID, requesterID string, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	opts.Type = model.AccessControlPolicyTypeParent

	policies, _, appErr := a.SearchAccessControlPolicies(rctx, opts)
	if appErr != nil {
		return nil, 0, appErr
	}

	filtered := make([]*model.AccessControlPolicy, 0, len(policies))
	for _, policy := range policies {
		isTeamScoped, err := a.IsPolicyTeamScoped(rctx, policy.ID, teamID)
		if err != nil {
			rctx.Logger().Warn("Failed to check policy team scope",
				mlog.String("policy_id", policy.ID), mlog.Err(err))
			continue
		}
		if !isTeamScoped {
			continue
		}

		// if policy is team scope, then check self-inclusion to consider listing the team
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

	return filtered, int64(len(filtered)), nil
}

// ValidateTeamPolicyChannelAssignment validates that all channels are eligible
// for team policy assignment, is the gate that run before channels are attached to a 'team' policy:
//   - At least one channel provided
//   - All channels exist
//   - All channels belong to the given team
//   - All channels are private
//   - No group-constrained channels
//   - No shared channels
func (a *App) ValidateTeamPolicyChannelAssignment(rctx request.CTX, teamID string, channelIDs []string) *model.AppError {
	if len(channelIDs) == 0 {
		return model.NewAppError("ValidateTeamPolicyChannelAssignment",
			"app.team.access_policies.channels_required.app_error",
			nil, "at least one channel is required", http.StatusBadRequest)
	}

	channels, appErr := a.GetChannels(rctx, channelIDs)
	if appErr != nil {
		return appErr
	}

	if len(channels) != len(channelIDs) {
		return model.NewAppError("ValidateTeamPolicyChannelAssignment",
			"app.team.access_policies.channel_not_found.app_error",
			nil, "one or more channels not found", http.StatusBadRequest)
	}

	for _, channel := range channels {
		if channel.TeamId != teamID {
			return model.NewAppError("ValidateTeamPolicyChannelAssignment",
				"app.team.access_policies.channel_wrong_team.app_error",
				map[string]any{"ChannelId": channel.Id},
				"channel does not belong to this team", http.StatusBadRequest)
		}

		if channel.Type != model.ChannelTypePrivate {
			return model.NewAppError("ValidateTeamPolicyChannelAssignment",
				"app.team.access_policies.channel_not_private.app_error",
				map[string]any{"ChannelId": channel.Id},
				"only private channels can have access policies", http.StatusBadRequest)
		}

		if channel.IsGroupConstrained() {
			return model.NewAppError("ValidateTeamPolicyChannelAssignment",
				"app.team.access_policies.channel_group_synced.app_error",
				map[string]any{"ChannelId": channel.Id},
				"group-synced channels cannot have access policies", http.StatusBadRequest)
		}

		if channel.IsShared() {
			return model.NewAppError("ValidateTeamPolicyChannelAssignment",
				"app.team.access_policies.channel_shared.app_error",
				map[string]any{"ChannelId": channel.Id},
				"shared channels cannot have access policies", http.StatusBadRequest)
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
