// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func (a *App) GetChannelsForPolicy(rctx request.CTX, policyID string, cursor model.AccessControlPolicyCursor, limit int) ([]*model.ChannelWithTeamData, int64, *model.AppError) {
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return nil, 0, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: policyID,
			Cursor:   cursor,
			Limit:    limit,
		})
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		channelIDs := make([]string, 0, len(policies))

		// channel IDs are the same as policy IDs
		for _, p := range policies {
			channelIDs = append(channelIDs, p.ID)
		}

		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds(channelIDs, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return chs, total, nil
	case model.AccessControlPolicyTypeChannel:
		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds([]string{policyID}, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		total := int64(len(chs))
		return chs, total, nil
	default:
		return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, "Invalid policy type", http.StatusBadRequest)
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

func (a *App) TestExpression(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	res, count, err := acs.QueryUsersForExpression(rctx, expression, opts)
	if err != nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return res, count, nil
}

func (a *App) AssignAccessControlPolicyToChannels(rctx request.CTX, parentID string, channelIDs []string) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := a.GetAccessControlPolicy(rctx, parentID)
	if appErr != nil {
		return nil, appErr
	}

	if policy.Type != model.AccessControlPolicyTypeParent {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy is not of type parent", http.StatusBadRequest)
	}

	channels, err := a.GetChannels(rctx, channelIDs)
	if err != nil {
		return nil, appErr
	}

	policies := make([]*model.AccessControlPolicy, 0, len(channelIDs))
	for _, channel := range channels {
		if channel.Type != model.ChannelTypePrivate || channel.IsGroupConstrained() {
			return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Channel is not of type private", http.StatusBadRequest)
		}

		if channel.IsShared() {
			return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Channel is shared", http.StatusBadRequest)
		}

		child, err := acs.GetPolicy(rctx, channel.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if child == nil {
			child = &model.AccessControlPolicy{
				ID:       channel.Id,
				Type:     model.AccessControlPolicyTypeChannel,
				Active:   policy.Active,
				CreateAt: model.GetMillis(),
				Props:    map[string]any{},
			}
		}
		child.Version = model.AccessControlPolicyVersionV0_2

		appErr := child.Inherit(policy)
		if appErr != nil {
			return nil, appErr
		}

		child, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return nil, appErr
		}
		policies = append(policies, child)
	}

	return policies, nil
}

func (a *App) UnassignPoliciesFromChannels(rctx request.CTX, policyID string, channelIDs []string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	cps, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		Type:     model.AccessControlPolicyTypeChannel,
		ParentID: policyID,
		Limit:    1000,
	})
	if err != nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	childPolicies := make(map[string]bool)
	for _, p := range cps {
		childPolicies[p.ID] = true
	}

	for _, channelID := range channelIDs {
		if _, ok := childPolicies[channelID]; !ok {
			mlog.Warn("Policy is not assigned to the parent policy", mlog.String("channel_id", channelID), mlog.String("parent_policy_id", policyID))
			continue
		}

		child, appErr := acs.GetPolicy(rctx, channelID)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}

		child.Imports = slices.DeleteFunc(child.Imports, func(importID string) bool {
			return importID == policyID
		})
		if len(child.Imports) == 0 && len(child.Rules) == 0 {
			// If the policy has no imports and no rules, we can delete it
			if err := acs.DeletePolicy(rctx, child.ID); err != nil {
				return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
			continue
		}
		_, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) SearchAccessControlPolicies(rctx request.CTX, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, opts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for i, policy := range policies {
		if policy.Type != model.AccessControlPolicyTypeParent {
			continue
		}

		normlizedPolicy, appErr := acs.NormalizePolicy(rctx, policy)
		if appErr != nil {
			mlog.Error("Failed to normalize policy", mlog.String("policy_id", policy.ID), mlog.Err(appErr))
			continue
		}
		policies[i] = normlizedPolicy
	}

	return policies, total, nil
}

func (a *App) GetAccessControlPolicyAttributes(rctx request.CTX, channelID string, action string) (map[string][]string, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetChannelAccessControlAttributes", "app.pap.get_channel_access_control_attributes.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	attributes, appErr := acs.GetPolicyRuleAttributes(rctx, channelID, action)
	if appErr != nil {
		return nil, appErr
	}

	return attributes, nil
}

func (a *App) GetAccessControlFieldsAutocomplete(rctx request.CTX, after string, limit int) ([]*model.PropertyField, *model.AppError) {
	cpaGroupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	fields, err := a.Srv().Store().PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
		GroupID: cpaGroupID,
		Cursor: model.PropertyFieldSearchCursor{
			PropertyFieldID: after,
			CreateAt:        1,
		},
		PerPage: limit,
	})
	if err != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return fields, nil
}

func (a *App) UpdateAccessControlPolicyActive(rctx request.CTX, policyID string, active bool) *model.AppError {
	_, err := a.Srv().Store().AccessControlPolicy().SetActiveStatus(rctx, policyID, active)
	if err != nil {
		return model.NewAppError("UpdateAccessControlPolicyActive", "app.pap.update_access_control_policy_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) ExpressionToVisualAST(rctx request.CTX, expression string) (*model.VisualExpression, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.expression_to_visual_ast.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	visualAST, appErr := acs.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}

	return visualAST, nil
}

// ValidateChannelAccessControlPermission validates if a user has permission to manage access control for a specific channel
func (a *App) ValidateChannelAccessControlPermission(rctx request.CTX, userID, channelID string) *model.AppError {
	// Verify the channel exists
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}

	// Check if user has channel admin permission for the specific channel
	if !a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionManageChannelAccessRules) {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.insufficient_channel_permissions", nil, "user_id="+userID+" channel_id="+channelID, http.StatusForbidden)
	}

	// Verify the channel is a private channel
	if channel.Type != model.ChannelTypePrivate {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.channel_not_private", nil, "channel_id="+channelID, http.StatusBadRequest)
	}

	if channel.IsGroupConstrained() {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.channel_group_constrained", nil, "channel_id="+channelID, http.StatusBadRequest)
	}

	if channel.IsShared() {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.channel_shared", nil, "channel_id="+channelID, http.StatusBadRequest)
	}

	return nil
}

// ValidateAccessControlPolicyPermission validates if a user has permission to manage a specific existing access control policy
func (a *App) ValidateAccessControlPolicyPermission(rctx request.CTX, userID, policyID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{})
}

type ValidateAccessControlPolicyPermissionOptions struct {
	isReadOnly bool
	channelID  string
}

func (a *App) ValidateAccessControlPolicyPermissionWithOptions(rctx request.CTX, userID, policyID string, opts ValidateAccessControlPolicyPermissionOptions) *model.AppError {
	// System admins can manage any policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Get the policy to determine its type
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return appErr
	}

	// For read-only operations, allow access to system policies if they're applied to the specific channel
	if opts.isReadOnly && policy.Type != model.AccessControlPolicyTypeChannel && opts.channelID != "" {
		// Check if user has access to the channel
		if !a.HasPermissionToChannel(rctx, userID, opts.channelID, model.PermissionReadChannel) {
			return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" channel_id="+opts.channelID, http.StatusForbidden)
		}

		// Check if this system policy is applied to the specific channel
		if a.isSystemPolicyAppliedToChannel(rctx, policyID, opts.channelID) {
			return nil // Allow read-only access
		}
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type+" channel_id="+opts.channelID, http.StatusForbidden)
	}

	// Non-system admins can only manage channel-type policies (for non-read-only operations)
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policyID)
}

// ValidateAccessControlPolicyPermissionWithMode validates access control policy permissions with read-only mode option
func (a *App) ValidateAccessControlPolicyPermissionWithMode(rctx request.CTX, userID, policyID string, isReadOnly bool) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
	})
}

// ValidateAccessControlPolicyPermissionWithChannelContext validates access control policy permissions with channel context
func (a *App) ValidateAccessControlPolicyPermissionWithChannelContext(rctx request.CTX, userID, policyID string, isReadOnly bool, channelID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
		channelID:  channelID,
	})
}

// isSystemPolicyAppliedToChannel checks if a system policy is applied to a specific channel
func (a *App) isSystemPolicyAppliedToChannel(rctx request.CTX, policyID, channelID string) bool {
	// Get the channel's policy (channel ID = policy ID for channel policies)
	channelPolicy, err := a.GetAccessControlPolicy(rctx, channelID)
	if err != nil {
		return false // Channel doesn't have a policy
	}

	// Check if the channel policy imports this system policy
	if channelPolicy.Imports != nil {
		return slices.Contains(channelPolicy.Imports, policyID)
	}

	return false
}

// ValidateChannelAccessControlPolicyCreation validates if a user can create a channel-specific access control policy
func (a *App) ValidateChannelAccessControlPolicyCreation(rctx request.CTX, userID string, policy *model.AccessControlPolicy) *model.AppError {
	// System admins can create any type of policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Non-system admins can only create channel-type policies
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateChannelAccessControlPolicyCreation", "app.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policy.ID)
}

// TestExpressionWithChannelContext tests expressions for channel admins with attribute validation
// Channel admins can only see users that match expressions they themselves would match
func (a *App) TestExpressionWithChannelContext(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	// Get the current user (channel admin)
	session := rctx.Session()
	if session == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "api.context.session_expired.app_error", nil, "", http.StatusUnauthorized)
	}

	currentUserID := session.UserId

	// SECURITY: First check if the channel admin themselves matches this expression
	// If they don't match, they shouldn't be able to see users who do
	adminMatches, appErr := a.ValidateExpressionAgainstRequester(rctx, expression, currentUserID)
	if appErr != nil {
		return nil, 0, appErr
	}

	if !adminMatches {
		// Channel admin doesn't match the expression, so return empty results
		return []*model.User{}, 0, nil
	}

	// If the channel admin matches the expression, run it against all users
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	return a.TestExpression(rctx, expression, opts)
}

// ValidateExpressionAgainstRequester validates an expression directly against a specific user
func (a *App) ValidateExpressionAgainstRequester(rctx request.CTX, expression string, requesterID string) (bool, *model.AppError) {
	// Self-exclusion validation should work with any attribute
	// Channel admins should be able to validate any expression they're testing

	// Use access control service to evaluate expression
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, model.NewAppError("ValidateExpressionAgainstRequester", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Search only for the specific requester user ID
	users, _, appErr := acs.QueryUsersForExpression(rctx, expression, model.SubjectSearchOptions{
		SubjectID: requesterID, // Only check this specific user
		Limit:     1,           // Maximum 1 result expected
	})
	if appErr != nil {
		return false, appErr
	}
	if len(users) == 1 && users[0].Id == requesterID {
		return true, nil
	}
	return false, nil
}
