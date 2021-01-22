// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) GetGlobalRetentionPolicy() (*model.GlobalRetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetGlobalRetentionPolicy")
	}
	return a.DataRetention().GetGlobalPolicy()
}

func (a *App) GetRetentionPolicies() ([]*model.RetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPolicies")
	}
	return a.DataRetention().GetPolicies()
}

func (a *App) GetRetentionPoliciesWithCounts() ([]*model.RetentionPolicyWithCounts, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPoliciesWithCounts")
	}
	return a.DataRetention().GetPoliciesWithCounts()
}

func (a *App) GetRetentionPolicy(id string) (*model.RetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPolicy")
	}
	return a.DataRetention().GetPolicy(id)
}

func (a *App) CreateRetentionPolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("CreateRetentionPolicy")
	}
	return a.DataRetention().CreatePolicy(policy)
}

func (a *App) PatchRetentionPolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("PatchRetentionPolicy")
	}
	return a.DataRetention().PatchPolicy(policy)
}

func (a *App) UpdateRetentionPolicy(policy *model.RetentionPolicy) (*model.RetentionPolicy, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("UpdateRetentionPolicy")
	}
	return a.DataRetention().UpdatePolicy(policy)
}

func (a *App) DeleteRetentionPolicy(id string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("UpdateRetentionPolicy")
	}
	return a.DataRetention().DeletePolicy(id)
}

func (a *App) AddTeamsToRetentionPolicy(policyId string, teamIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("AddTeamsToRetentionPolicy")
	}
	return a.DataRetention().AddTeamsToPolicy(policyId, teamIds)
}

func (a *App) RemoveTeamFromRetentionPolicy(policyId string, teamId string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("RemoveTeamFromRetentionPolicy")
	}
	return a.DataRetention().RemoveTeamFromPolicy(policyId, teamId)
}

func (a *App) AddChannelsToRetentionPolicy(policyId string, channelIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("AddChannelsToRetentionPolicies")
	}
	return a.DataRetention().AddChannelsToPolicy(policyId, channelIds)
}

func (a *App) RemoveChannelFromRetentionPolicy(policyId string, channelId string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("RemoveChannelFromRetentionPolicy")
	}
	return a.DataRetention().RemoveChannelFromPolicy(policyId, channelId)
}

func (a *App) hasValidRetentionPolicy() bool {
	return a.DataRetention() != nil
}

func newLicenseError(methodName string) *model.AppError {
	return model.NewAppError("App."+methodName, "ent.data_retention.generic.license.error",
		nil, "", http.StatusNotImplemented)
}
