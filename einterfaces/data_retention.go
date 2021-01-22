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
	UpdatePolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError)
	DeletePolicy(policyId string) *model.AppError
	AddTeamsToPolicy(policyId string, teamIds []string) *model.AppError
	RemoveTeamFromPolicy(policyId string, teamId string) *model.AppError
	AddChannelsToPolicy(policyId string, channelIds []string) *model.AppError
	RemoveChannelFromPolicy(policyId string, channelId string) *model.AppError
}
