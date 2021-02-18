// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type DataRetentionInterface interface {
	GetGlobalPolicy() (*model.GlobalRetentionPolicy, *model.AppError)
	GetPolicies(offset, limit uint64) ([]*model.RetentionPolicyWithTeamsAndChannels, *model.AppError)
	GetPoliciesWithCounts(offset, limit uint64) ([]*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	GetPolicy(id string) (*model.RetentionPolicyWithTeamsAndChannels, *model.AppError)
	CreatePolicy(policy *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamsAndChannels, *model.AppError)
	PatchPolicy(patch *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamsAndChannels, *model.AppError)
	UpdatePolicy(update *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamsAndChannels, *model.AppError)
	DeletePolicy(policyId string) *model.AppError
	AddTeamsToPolicy(policyId string, teamIds []string) *model.AppError
	RemoveTeamsFromPolicy(policyId string, teamIds []string) *model.AppError
	AddChannelsToPolicy(policyId string, channelIds []string) *model.AppError
	RemoveChannelsFromPolicy(policyId string, channelIds []string) *model.AppError
}
