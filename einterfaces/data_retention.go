// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type DataRetentionInterface interface {
	GetGlobalPolicy() (*model.GlobalRetentionPolicy, *model.AppError)
	GetPolicies(offset, limit int) ([]*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	GetPolicy(id string) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	CreatePolicy(policy *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	PatchPolicy(patch *model.RetentionPolicyWithTeamAndChannelIds) (*model.RetentionPolicyWithTeamAndChannelCounts, *model.AppError)
	DeletePolicy(policyId string) *model.AppError
	AddTeamsToPolicy(policyId string, teamIds []string) *model.AppError
	RemoveTeamsFromPolicy(policyId string, teamIds []string) *model.AppError
	AddChannelsToPolicy(policyId string, channelIds []string) *model.AppError
	RemoveChannelsFromPolicy(policyId string, channelIds []string) *model.AppError
}
