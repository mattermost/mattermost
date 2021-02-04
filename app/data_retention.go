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

func (a *App) GetRetentionPolicies(offset, limit uint64) ([]*model.RetentionPolicyEnriched, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPolicies")
	}
	return a.DataRetention().GetPolicies(offset, limit)
}

func (a *App) GetRetentionPoliciesWithCounts(offset, limit uint64) ([]*model.RetentionPolicyWithCounts, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPoliciesWithCounts")
	}
	return a.DataRetention().GetPoliciesWithCounts(offset, limit)
}

func (a *App) GetRetentionPolicy(id string) (*model.RetentionPolicyEnriched, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("GetRetentionPolicy")
	}
	return a.DataRetention().GetPolicy(id)
}

func (a *App) CreateRetentionPolicy(policy *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("CreateRetentionPolicy")
	}
	return a.DataRetention().CreatePolicy(policy)
}

func (a *App) PatchRetentionPolicy(patch *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("PatchRetentionPolicy")
	}
	return a.DataRetention().PatchPolicy(patch)
}

func (a *App) UpdateRetentionPolicy(update *model.RetentionPolicyWithApplied) (*model.RetentionPolicyEnriched, *model.AppError) {
	if !a.hasValidRetentionPolicy() {
		return nil, newLicenseError("UpdateRetentionPolicy")
	}
	return a.DataRetention().UpdatePolicy(update)
}

func (a *App) DeleteRetentionPolicy(id string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("DeleteRetentionPolicy")
	}
	return a.DataRetention().DeletePolicy(id)
}

func (a *App) AddTeamsToRetentionPolicy(policyId string, teamIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("AddTeamsToRetentionPolicy")
	}
	return a.DataRetention().AddTeamsToPolicy(policyId, teamIds)
}

func (a *App) RemoveTeamsFromRetentionPolicy(policyId string, teamIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("RemoveTeamsFromRetentionPolicy")
	}
	return a.DataRetention().RemoveTeamsFromPolicy(policyId, teamIds)
}

func (a *App) AddChannelsToRetentionPolicy(policyId string, channelIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("AddChannelsToRetentionPolicies")
	}
	return a.DataRetention().AddChannelsToPolicy(policyId, channelIds)
}

func (a *App) RemoveChannelsFromRetentionPolicy(policyId string, channelIds []string) *model.AppError {
	if !a.hasValidRetentionPolicy() {
		return newLicenseError("RemoveChannelsFromRetentionPolicy")
	}
	return a.DataRetention().RemoveChannelsFromPolicy(policyId, channelIds)
}

func (a *App) hasValidRetentionPolicy() bool {
	return a.DataRetention() != nil
}

func newLicenseError(methodName string) *model.AppError {
	return model.NewAppError("App."+methodName, "ent.data_retention.generic.license.error",
		nil, "", http.StatusNotImplemented)
}
