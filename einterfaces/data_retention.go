// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type DataRetentionInterface interface {
	GetGlobalPolicy() (*model.GlobalRetentionPolicy, *model.AppError)
	GetPolicies() ([]*model.RetentionPolicyEnriched, *model.AppError)
	GetPoliciesWithCounts() ([]*model.RetentionPolicyWithCounts, *model.AppError)
	GetPolicy(id string) (*model.RetentionPolicyEnriched, *model.AppError)
	CreatePolicy(policy *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError)
	PatchPolicy(patch *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError)
	UpdatePolicy(update *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError)
	DeletePolicy(policyId string) *model.AppError
	AddTeamsToPolicy(policyId string, teamIds []string) *model.AppError
	RemoveTeamsFromPolicy(policyId string, teamIds []string) *model.AppError
	AddChannelsToPolicy(policyId string, channelIds []string) *model.AppError
	RemoveChannelsFromPolicy(policyId string, channelIds []string) *model.AppError
}
