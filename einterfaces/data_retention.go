// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type DataRetentionInterface interface {
	GetGlobalPolicy() (*model.GlobalRetentionPolicy, *model.AppError)
	GetPolicies() ([]*model.RetentionPolicy, *model.AppError)
	GetPoliciesWithCounts() ([]*model.RetentionPolicyWithCounts, *model.AppError)
	GetPolicy(id string) (*model.RetentionPolicy, *model.AppError)
	CreatePolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError)
	PatchPolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError)
	DeletePolicy(policy *model.RetentionPolicy) *model.AppError
	AddTeamsToPolicy(policyTeams []*model.RetentionPolicyTeam) *model.AppError
	RemoveTeamFromPolicy(policyTeam *model.RetentionPolicyTeam) *model.AppError
	AddChannelsToPolicy(policyChannels []*model.RetentionPolicyChannel) *model.AppError
	RemoveChannelFromPolicy(policyChannel *model.RetentionPolicyChannel) *model.AppError
}
