// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const attributeViewRefreshInterval = 30 * time.Second
const accessControlChildPolicySearchLimit = 1000

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

	// Channel-scope policies are pinned to a single channel by ID. Validate
	// channel eligibility here (default / DM / GM / group-constrained / shared
	// channels are ineligible) so this guard protects all callers — including
	// system admins, whose request goes through the api4 handler's permission
	// fast-path that skips the per-channel ValidateChannelAccessControlPolicyCreation
	// check, and the parent-policy AssignAccessControlPolicyToChannels flow,
	// which validates eligibility there but bypasses this entry point.
	if policy.Type == model.AccessControlPolicyTypeChannel {
		channel, appErr := a.GetChannel(rctx, policy.ID)
		if appErr != nil {
			return nil, appErr
		}
		if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
			return nil, appErr
		}
	}

	policy.Version = model.AccessControlPolicyVersionV0_3
	for i, rule := range policy.Rules {
		for j, action := range rule.Actions {
			if action == "*" {
				policy.Rules[i].Actions[j] = model.AccessControlPolicyActionMembership
			}
		}
	}

	var appErr *model.AppError
	policy, appErr = acs.SavePolicy(rctx, policy)
	if appErr != nil {
		return nil, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeChannel:
		a.publishChannelPolicyEnforcedUpdate(rctx, policy.ID)
	case model.AccessControlPolicyTypeParent:
		a.publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx, policy.ID)
	}

	return policy, nil
}

func (a *App) DeleteAccessControlPolicy(rctx request.CTX, id string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("DeleteAccessControlPolicy", "app.pap.delete_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Resolve the policy first so we know whether to broadcast a channel
	// access control update after deletion (channel-type policies share the
	// channel's ID, so we can use the policy ID as the channel ID).
	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		return appErr
	}

	var affectedChannelIDs []string
	if policy != nil && policy.Type != model.AccessControlPolicyTypeChannel {
		affectedChannelIDs = a.channelPolicyIDsWithImport(rctx, id)
	}

	if appErr := acs.DeletePolicy(rctx, id); appErr != nil {
		return appErr
	}

	if policy != nil && policy.Type == model.AccessControlPolicyTypeChannel {
		a.publishChannelPolicyEnforcedUpdate(rctx, id)
	} else if policy.Type == model.AccessControlPolicyTypeParent {
		a.publishChannelPolicyEnforcedUpdatesForChannels(rctx, affectedChannelIDs)
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
		return nil, err
	}

	policies := make([]*model.AccessControlPolicy, 0, len(channelIDs))
	for _, channel := range channels {
		if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
			return nil, appErr
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
		child.Version = model.AccessControlPolicyVersionV0_3

		appErr := child.Inherit(policy)
		if appErr != nil {
			return nil, appErr
		}

		child, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return nil, appErr
		}
		a.publishChannelPolicyEnforcedUpdate(rctx, child.ID)
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
			// invalidate the channel cache and broadcast the policy change
			a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
			continue
		}
		_, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
		a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
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

func (a *App) GetAccessControlFieldsAutocomplete(rctx request.CTX, after string, limit int, callerID string) ([]*model.PropertyField, *model.AppError) {
	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Use property app layer to enforce access control
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)
	fields, appErr := a.SearchPropertyFields(rctxWithCaller, cpaGroupID, model.PropertyFieldSearchOpts{
		Cursor: model.PropertyFieldSearchCursor{
			PropertyFieldID: after,
			CreateAt:        1,
		},
		PerPage: limit,
	})
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return fields, nil
}

func (a *App) UpdateAccessControlPoliciesActive(rctx request.CTX, updates []model.AccessControlPolicyActiveUpdate) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.update_access_control_policies_active.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, err := a.Srv().Store().AccessControlPolicy().SetActiveStatusMultiple(rctx, updates)
	if err != nil {
		return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.update_access_control_policies_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, policy := range policies {
		// only channel policies use the active state
		if policy.Type == model.AccessControlPolicyTypeChannel {
			a.publishChannelPolicyEnforcedUpdate(rctx, policy.ID)
		}
	}

	return policies, nil
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

// publishChannelPolicyEnforcedForChannelPoliciesWithImport broadcasts
// channel_access_control_updated for every channel-type policy that lists
// importID in its imports. Call only after the imported policy (parent,
// permission, etc.) is persisted.
func (a *App) publishChannelPolicyEnforcedForChannelPoliciesWithImport(rctx request.CTX, importID string) {
	a.publishChannelPolicyEnforcedUpdatesForChannels(rctx, a.channelPolicyIDsWithImport(rctx, importID))
}

func (a *App) publishChannelPolicyEnforcedUpdatesForChannels(rctx request.CTX, channelIDs []string) {
	seen := make(map[string]struct{}, len(channelIDs))
	for _, channelID := range channelIDs {
		if channelID == "" {
			continue
		}
		if _, ok := seen[channelID]; ok {
			continue
		}
		seen[channelID] = struct{}{}
		a.publishChannelPolicyEnforcedUpdate(rctx, channelID)
	}
}

func (a *App) channelPolicyIDsWithImport(rctx request.CTX, importID string) []string {
	channelIDs := []string{}
	var cursor model.AccessControlPolicyCursor
	for {
		children, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: importID,
			Cursor:   cursor,
			Limit:    accessControlChildPolicySearchLimit,
		})
		if err != nil {
			rctx.Logger().Warn("Failed to list channel policies that import a policy; skipping channel access control fan-out",
				mlog.String("imported_policy_id", importID),
				mlog.Err(err),
			)
			return channelIDs
		}
		for _, child := range children {
			channelIDs = append(channelIDs, child.ID)
		}
		if len(children) < accessControlChildPolicySearchLimit {
			break
		}
		cursor.ID = children[len(children)-1].ID
	}
	return channelIDs
}

// publishChannelPolicyEnforcedUpdate invalidates the channel cache for the
// given channel ID and broadcasts a channel_access_control_updated websocket
// event so that connected clients can refresh their view of the channel's
// access control state (e.g. the policy_enforced flag and the set of
// attributes used by the policy). A dedicated event is used rather than
// channel_updated because this is fired on every policy mutation and clients
// only need to refresh access control state — not run the full
// channel_updated reducer/router pipeline.
func (a *App) publishChannelPolicyEnforcedUpdate(rctx request.CTX, channelID string) {
	a.Srv().Store().Channel().InvalidateChannel(channelID)

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load channel after access control policy change",
			mlog.String("channel_id", channelID),
			mlog.Err(appErr),
		)
		return
	}

	channelJSON, jsonErr := json.Marshal(channel)
	if jsonErr != nil {
		rctx.Logger().Warn("Failed to marshal channel after access control policy change",
			mlog.String("channel_id", channelID),
			mlog.Err(jsonErr),
		)
		return
	}

	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelAccessControlUpdated, "", channel.Id, "", nil, "")
	messageWs.Add("channel", string(channelJSON))
	a.Publish(messageWs)
}

func (a *App) GetMaskedVisualAST(rctx request.CTX, expression string, callerID string) (*model.VisualExpression, *model.AppError) {
	visualAST, appErr := a.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}
	if visualAST == nil || len(visualAST.Conditions) == 0 {
		return visualAST, nil
	}

	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetMaskedVisualAST", "app.pap.get_masked_visual_ast.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Embed callerID in context so GetPropertyFieldByName applies per-caller option filtering.
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Pre-fetch all referenced fields once to avoid N+1 DB queries across conditions.
	fieldsByName := a.fetchConditionFields(rctxWithCaller, visualAST.Conditions, cpaGroupID)

	for i := range visualAST.Conditions {
		a.maskConditionValues(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID, fieldsByName)
	}

	return visualAST, nil
}

// fetchConditionFields collects unique field names from conditions and fetches each once.
// Fields that fail lookup are omitted; maskConditionValues treats missing entries as fail-closed.
func (a *App) fetchConditionFields(rctx request.CTX, conditions []model.Condition, cpaGroupID string) map[string]*model.PropertyField {
	seen := make(map[string]bool)
	for _, c := range conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		if name := extractFieldName(c.Attribute); name != "" {
			seen[name] = true
		}
	}

	fields := make(map[string]*model.PropertyField, len(seen))
	for name := range seen {
		field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", name)
		if appErr != nil {
			rctx.Logger().Warn("Failed to look up field for masking, failing closed",
				mlog.String("field_name", name),
				mlog.Err(appErr),
			)
			continue
		}
		fields[name] = field
	}
	return fields
}

func (a *App) maskConditionValues(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) {
	// AttrValue conditions compare two attributes (e.g. user.attr1 == user.attr2) — no literal values to mask.
	if condition.ValueType == model.AttrValue {
		return
	}

	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		// Fail closed: field lookup failed at prefetch time.
		condition.Value = nil
		condition.HasMaskedValues = true
		return
	}

	switch getFieldAccessMode(field) {
	case model.PropertyAccessModePublic:
		// no-op
	case model.PropertyAccessModeSourceOnly:
		condition.Value = nil
		condition.HasMaskedValues = true
	case model.PropertyAccessModeSharedOnly:
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			filterConditionValues(condition, extractVisibleOptionNames(field))
		} else {
			filterConditionValues(condition, a.getCallerTextValues(rctx, callerID, field, cpaGroupID))
		}
	default:
		condition.Value = nil
		condition.HasMaskedValues = true
	}
}

func extractFieldName(attribute string) string {
	const prefix = "user.attributes."
	name := strings.TrimPrefix(attribute, prefix)
	if name == attribute || name == "" {
		return ""
	}
	return name
}

func getFieldAccessMode(field *model.PropertyField) string {
	if field.Attrs == nil {
		return model.PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[model.PropertyAttrsAccessMode].(string)
	if !ok {
		return model.PropertyAccessModePublic
	}
	return accessMode
}

func extractVisibleOptionNames(field *model.PropertyField) map[string]struct{} {
	names := make(map[string]struct{})
	if field.Attrs == nil {
		return names
	}

	optionsRaw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return names
	}

	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		return names
	}

	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		name, ok := optMap["name"].(string)
		if ok && name != "" {
			names[name] = struct{}{}
		}
	}

	return names
}

func (a *App) getCallerTextValues(rctx request.CTX, callerID string, field *model.PropertyField, cpaGroupID string) map[string]struct{} {
	visible := make(map[string]struct{})

	// Each (user, field) pair has at most one text value.
	values, appErr := a.SearchPropertyValues(rctx, cpaGroupID, model.PropertyValueSearchOpts{
		FieldID:   field.ID,
		TargetIDs: []string{callerID},
		PerPage:   1,
	})
	if appErr != nil {
		rctx.Logger().Warn("Failed to look up caller text value for masking, failing closed",
			mlog.String("field_id", field.ID),
			mlog.String("caller_id", callerID),
			mlog.Err(appErr),
		)
		return visible
	}

	for _, pv := range values {
		var textVal string
		if err := json.Unmarshal(pv.Value, &textVal); err == nil && textVal != "" {
			visible[textVal] = struct{}{}
		}
	}

	return visible
}

func filterConditionValues(condition *model.Condition, visibleNames map[string]struct{}) {
	switch v := condition.Value.(type) {
	case []any:
		filtered := make([]any, 0, len(v))
		totalStrings := 0
		for _, val := range v {
			strVal, ok := val.(string)
			if !ok {
				continue // non-string elements are not masking candidates
			}
			totalStrings++
			if _, visible := visibleNames[strVal]; visible {
				filtered = append(filtered, val)
			}
		}
		if len(filtered) < totalStrings {
			condition.HasMaskedValues = true
		}
		condition.Value = filtered

	case string:
		if _, visible := visibleNames[v]; !visible {
			condition.Value = nil
			condition.HasMaskedValues = true
		}
	}
}

// getHiddenValues returns stored condition values not visible to the caller.
// fieldsByName is the pre-fetched field map from fetchConditionFields; a missing entry means
// the field lookup failed and no hidden values are injected for that condition.
func (a *App) getHiddenValues(rctx request.CTX, callerID string, stored *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) []string {
	if stored.ValueType == model.AttrValue {
		return nil
	}

	fieldName := extractFieldName(stored.Attribute)
	if fieldName == "" {
		return nil
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		// Field lookup failed at prefetch time; fail closed — do not inject hidden values
		// for a field we cannot verify (may have been deleted or inaccessible).
		return nil
	}

	switch getFieldAccessMode(field) {
	case model.PropertyAccessModeSourceOnly:
		return extractStringValues(stored.Value)
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(rctx, callerID, field, cpaGroupID)
		}
		var hidden []string
		for _, val := range extractStringValues(stored.Value) {
			if _, visible := visibleNames[val]; !visible {
				hidden = append(hidden, val)
			}
		}
		return hidden
	default:
		return nil
	}
}

// extractStringValues converts a condition's Value to a slice of strings.
func extractStringValues(value any) []string {
	switch v := value.(type) {
	case []any:
		var result []string
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	case string:
		return []string{v}
	default:
		return nil
	}
}

// mergeConditionValues appends hiddenValues to the submitted condition's values, deduplicating.
func mergeConditionValues(submitted model.Condition, hiddenValues []string) model.Condition {
	if len(hiddenValues) == 0 {
		return submitted
	}

	merged := submitted

	switch v := submitted.Value.(type) {
	case []any:
		seen := make(map[string]struct{})
		for _, item := range v {
			if s, ok := item.(string); ok {
				seen[s] = struct{}{}
			}
		}
		result := make([]any, 0, len(v)+len(hiddenValues))
		result = append(result, v...)
		for _, hidden := range hiddenValues {
			if _, exists := seen[hidden]; !exists {
				result = append(result, hidden)
			}
		}
		merged.Value = result

	case string:
		if v == "" && len(hiddenValues) > 0 {
			merged.Value = hiddenValues[0]
		}

	case nil:
		if len(hiddenValues) == 1 {
			merged.Value = hiddenValues[0]
		} else if len(hiddenValues) > 1 {
			result := make([]any, 0, len(hiddenValues))
			for _, h := range hiddenValues {
				result = append(result, h)
			}
			merged.Value = result
		}
	}

	return merged
}

// buildCELFromConditions reconstructs a CEL expression from conditions, joined with " && ".
func buildCELFromConditions(conditions []model.Condition) string {
	if len(conditions) == 0 {
		return "true"
	}

	parts := make([]string, 0, len(conditions))
	for _, cond := range conditions {
		cel := conditionToCEL(cond)
		if cel != "" {
			parts = append(parts, cel)
		}
	}

	if len(parts) == 0 {
		return "true"
	}

	return strings.Join(parts, " && ")
}

// conditionToCEL converts a single Condition to its CEL string representation.
func conditionToCEL(cond model.Condition) string {
	attr := cond.Attribute

	switch cond.Operator {
	case "==", "!=", ">", ">=", "<", "<=":
		if cond.Value == nil {
			return ""
		}
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)

	case "in":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		if cond.AttributeType == "multiselect" {
			// multiselect: "v1" in attr && "v2" in attr
			inParts := make([]string, 0, len(values))
			for _, v := range values {
				inParts = append(inParts, celStringLiteral(v)+" in "+attr)
			}
			return strings.Join(inParts, " && ")
		}
		// select: attr in ["v1", "v2"]
		valLiterals := make([]string, 0, len(values))
		for _, v := range values {
			valLiterals = append(valLiterals, celStringLiteral(v))
		}
		return attr + " in [" + strings.Join(valLiterals, ", ") + "]"

	case "hasAnyOf":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		orParts := make([]string, 0, len(values))
		for _, v := range values {
			orParts = append(orParts, celStringLiteral(v)+" in "+attr)
		}
		if len(orParts) == 1 {
			return orParts[0]
		}
		return "(" + strings.Join(orParts, " || ") + ")"

	case "hasAllOf":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		andParts := make([]string, 0, len(values))
		for _, v := range values {
			andParts = append(andParts, celStringLiteral(v)+" in "+attr)
		}
		return strings.Join(andParts, " && ")

	case "contains", "startsWith", "endsWith":
		if cond.Value == nil {
			return ""
		}
		return attr + "." + cond.Operator + "(" + celValueLiteral(cond.Value) + ")"

	default:
		if cond.Value == nil {
			return ""
		}
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)
	}
}

// celStringLiteral wraps s in double quotes with backslash and quote escaping.
func celStringLiteral(s string) string {
	escaped := strings.ReplaceAll(s, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	return `"` + escaped + `"`
}

// celValueLiteral returns the CEL literal for a condition value.
func celValueLiteral(value any) string {
	switch v := value.(type) {
	case string:
		return celStringLiteral(v)
	case float64:
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", v), "0"), ".")
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// ValidateChannelEligibilityForAccessControl checks that a channel is eligible for
// access control policy assignment: must be public or private (DM/GM excluded),
// not group-constrained, not shared, and not a team default channel (e.g. town-square).
func (a *App) ValidateChannelEligibilityForAccessControl(rctx request.CTX, channel *model.Channel) *model.AppError {
	if channel.Type != model.ChannelTypePrivate && channel.Type != model.ChannelTypeOpen {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_type_not_supported",
			nil, "Policies can only be applied to public or private channels", http.StatusBadRequest)
	}

	if channel.IsGroupConstrained() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_group_constrained",
			nil, "Channel is group constrained", http.StatusBadRequest)
	}

	if channel.IsShared() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_shared",
			nil, "Channel is shared", http.StatusBadRequest)
	}

	if slices.Contains(a.DefaultChannelNames(rctx), channel.Name) {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_default",
			nil, "Channel is a team default channel", http.StatusBadRequest)
	}

	return nil
}

// ValidateChannelAccessControlPermission validates if a user has permission to manage access control for a specific channel
func (a *App) ValidateChannelAccessControlPermission(rctx request.CTX, userID, channelID string) *model.AppError {
	// Verify the channel exists
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}

	// Check if user has channel admin permission for the specific channel
	if ok, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionManageChannelAccessRules); !ok {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.insufficient_channel_permissions", nil, "user_id="+userID+" channel_id="+channelID, http.StatusForbidden)
	}

	if appErr := a.ValidateChannelEligibilityForAccessControl(rctx, channel); appErr != nil {
		return appErr
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
		if ok, _ := a.HasPermissionToChannel(rctx, userID, opts.channelID, model.PermissionReadChannel); !ok {
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

// BuildAccessControlSubject creates a fully populated Subject with user attributes and system role
// for use in AccessEvaluation calls. It also ensures the materialized attribute view is
// refreshed periodically (at most once per attributeViewRefreshInterval).
func (a *App) BuildAccessControlSubject(rctx request.CTX, userID string, roles string) (*model.Subject, *model.AppError) {
	a.refreshAttributeViewIfStale(rctx)

	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	subject, storeErr := a.Srv().Store().Attributes().GetSubject(rctx, userID, groupID)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			return &model.Subject{
				ID:         userID,
				Type:       "user",
				Role:       roles,
				Attributes: map[string]any{},
			}, nil
		}

		rctx.Logger().Warn("Failed to get subject for access control subject",
			mlog.String("user_id", userID),
			mlog.String("roles", roles),
			mlog.Err(storeErr),
		)
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.get_subject.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	subject.Role = roles
	return subject, nil
}

// refreshAttributeViewIfStale refreshes the materialized AttributeView if the last
// refresh was more than attributeViewRefreshInterval ago. The refresh is non-blocking:
// if another goroutine is already refreshing, this call returns immediately.
func (a *App) refreshAttributeViewIfStale(rctx request.CTX) {
	ch := a.Srv().Channels()

	if !ch.attributeViewRefreshMut.TryLock() {
		return
	}
	defer ch.attributeViewRefreshMut.Unlock()

	if time.Since(ch.attributeViewRefreshLast) < attributeViewRefreshInterval {
		return
	}

	if err := a.Srv().Store().Attributes().RefreshAttributes(); err != nil {
		rctx.Logger().Warn("Failed to refresh attribute materialized view", mlog.Err(err))
		return
	}

	ch.attributeViewRefreshLast = time.Now()
}
