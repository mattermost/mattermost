// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/server/v7/model"
)

type DataRetentionInterface interface {
	GetGlobalPolicy() (*model.GlobalRetentionPolicy, *model.AppError)
	GetPolicies(offset, limit int) (*model.RetentionPolicyWithTeamAndChannelCountsList, *model.AppError)
	GetPoliciesCount() (int64, *model.AppError)
	GetPolicy(policyID string) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	CreatePolicy(policy *model.RetentionPolicyWithTeamAndChannelIDs) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	PatchPolicy(patch *model.RetentionPolicyWithTeamAndChannelIDs) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	DeletePolicy(policyID string) *model.AppError
	GetTeamsForPolicy(policyID string, offset, limit int) (*model.TeamsWithCount, *model.AppError)
	AddTeamsToPolicy(policyID string, teamIDs []string) *model.AppError
	RemoveTeamsFromPolicy(policyID string, teamIDs []string) *model.AppError
	GetChannelsForPolicy(policyID string, offset, limit int) (*model.ChannelsWithCount, *model.AppError)
	AddChannelsToPolicy(policyID string, channelIDs []string) *model.AppError
	RemoveChannelsFromPolicy(policyID string, channelIDs []string) *model.AppError
	GetTeamPoliciesForUser(userID string, offset, limit int) (*model.RetentionPolicyForTeamList, *model.AppError)
	GetChannelPoliciesForUser(userID string, offset, limit int) (*model.RetentionPolicyForChannelList, *model.AppError)
}
