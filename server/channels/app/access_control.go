// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetAllParentPolicies(rctx request.CTX, page, perPage int) ([]*model.AccessControlPolicy, *model.AppError) {
	policies, err := a.Srv().Store().AccessControlPolicy().GetAll(rctx, store.GetPolicyOptions{
		Type: model.AccessControlPolicyTypeParent,
	})
	if err != nil {
		return nil, model.NewAppError("GetAllParentPolicies", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return policies, nil
}

func (a *App) GetAllChildPolicies(rctx request.CTX, parentID string, page, perPage int) ([]*model.AccessControlPolicy, *model.AppError) {
	policies, err := a.Srv().Store().AccessControlPolicy().GetAll(rctx, store.GetPolicyOptions{
		Type:     model.AccessControlPolicyTypeChannel,
		ParentID: parentID,
	})
	if err != nil {
		return nil, model.NewAppError("GetAllChildPolicies", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return policies, nil
}

func (a *App) GetChannelsForPolicy(rctx request.CTX, policyID string, page, perPage int) ([]*model.ChannelWithTeamData, *model.AppError) {
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return nil, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		policies, err := a.Srv().Store().AccessControlPolicy().GetAll(rctx, store.GetPolicyOptions{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: policyID,
			// Page:	 page,
			// PerPage:  perPage,
		})
		if err != nil {
			return nil, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		channelIDs := make([]string, 0, len(policies))

		for _, p := range policies {
			channelIDs = append(channelIDs, p.ID)
		}

		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds(channelIDs, true)
		if err != nil {
			return nil, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return chs, nil
	case model.AccessControlPolicyTypeChannel:
		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds([]string{policyID}, true)
		if err != nil {
			return nil, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return chs, nil
	default:
		return nil, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, "Invalid policy type", http.StatusBadRequest)
	}
}

func (a *App) GetAccessControlPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		return nil, appErr
	}

	return policy, nil
}

func (a *App) CreateOrUpdateAccessControlPolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CreateAccessControlPolicy", "app.pap.create_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if policy.ID == "" {
		policy.ID = model.NewId()
	}

	var appErr *model.AppError
	policy, appErr = acs.SavePolicy(rctx, policy)
	if appErr != nil {
		return nil, appErr
	}

	return policy, nil
}

func (a *App) DeleteAccessControlPolicy(rctx request.CTX, id string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("DeleteAccessControlPolicy", "app.pap.delete_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	appErr := acs.DeletePolicy(rctx, id)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	errs, appErr := acs.CheckExpression(rctx, expression)
	if appErr != nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return errs, nil
}

func (a *App) TestExpression(rctx request.CTX, expression string) ([]*model.User, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	res, err := acs.QueryExpression(rctx, expression)
	if err != nil {
		return nil, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	users, appErr := a.GetUsers(res.MatchedSubjectIDs)
	if err != nil {
		return nil, appErr
	}

	return users, nil
}
