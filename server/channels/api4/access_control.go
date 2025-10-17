// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitAccessControlPolicy() {
	if !api.srv.Config().FeatureFlags.AttributeBasedAccessControl {
		return
	}
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequired(searchAccessControlPolicies)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/validate_requester", api.APISessionRequired(validateExpressionAgainstRequester)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", api.APISessionRequired(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", api.APISessionRequired(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/activate", api.APISessionRequired(updateActiveStatus)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APISessionRequired(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APISessionRequired(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APISessionRequired(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APISessionRequired(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}

func createAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.AccessControlPolicy
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateAccessControlPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "requested", &policy)

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	case model.AccessControlPolicyTypeChannel:
		// Check if user has system admin permission first
		hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)

		if !hasManageSystemPermission {
			// For non-system admins, check channel-specific permission
			if !model.IsValidId(policy.ID) {
				c.SetInvalidParam("policy.id")
				return
			}

			hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, policy.ID, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}

			// Now do the full validation (channel exists, is private, etc.)
			if appErr := c.App.ValidateChannelAccessControlPolicyCreation(c.AppContext, c.AppContext.Session().UserId, &policy); appErr != nil {
				c.Err = appErr
				return
			}
		}
	default:
		c.SetInvalidParam("type")
		return
	}

	np, appErr := c.App.CreateOrUpdateAccessControlPolicy(c.AppContext, &policy)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("access_control_policy")
	auditRec.AddEventResultState(np)

	js, err := json.Marshal(np)
	if err != nil {
		c.Err = model.NewAppError("createAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	// Extract optional channelId from query parameters for context
	channelID := r.URL.Query().Get("channelId")

	// Check if user has system admin permission OR channel-specific permission
	hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasManageSystemPermission {
		// For non-system admins, validate policy access permission (read-only access for GET requests)
		if appErr := c.App.ValidateAccessControlPolicyPermissionWithChannelContext(c.AppContext, c.AppContext.Session().UserId, policyID, true, channelID); appErr != nil {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	policy, appErr := c.App.GetAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("getAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteAccessControlPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)

	// Check if user has system admin permission OR channel-specific permission
	hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasManageSystemPermission {
		// For non-system admins, validate policy access permission
		if appErr := c.App.ValidateAccessControlPolicyPermission(c.AppContext, c.AppContext.Session().UserId, policyID); appErr != nil {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	appErr := c.App.DeleteAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.Success()
}

func checkExpression(c *Context, w http.ResponseWriter, r *http.Request) {
	// request type reserved for future expansion
	// for now, we only support the expression check
	checkExpressionRequest := struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
	}{}
	if jsonErr := json.NewDecoder(r.Body).Decode(&checkExpressionRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	// Get channelId from request body (required for channel-specific permission check)
	channelId := checkExpressionRequest.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	// Check permissions: system admin OR channel-specific permission
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// For channel admins, channelId is required
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}

		// SECURE: Check specific channel permission
		hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}

	errs, appErr := c.App.CheckExpression(c.AppContext, checkExpressionRequest.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(errs)
	if err != nil {
		c.Err = model.NewAppError("checkExpression", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func testExpression(c *Context, w http.ResponseWriter, r *http.Request) {
	var checkExpressionRequest model.QueryExpressionParams
	if jsonErr := json.NewDecoder(r.Body).Decode(&checkExpressionRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	// Get channelId from request body (required for channel-specific permission check)
	channelId := checkExpressionRequest.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	// Check permissions: system admin OR channel-specific permission
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// For channel admins, channelId is required
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}

		// SECURE: Check specific channel permission
		hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}

	var users []*model.User
	var count int64
	var appErr *model.AppError

	searchOpts := model.SubjectSearchOptions{
		Term:  checkExpressionRequest.Term,
		Limit: checkExpressionRequest.Limit,
		Cursor: model.SubjectCursor{
			TargetID: checkExpressionRequest.After,
		},
	}

	if hasSystemPermission {
		// SYSTEM ADMIN: Can see ALL users (no restrictions)
		users, count, appErr = c.App.TestExpression(c.AppContext, checkExpressionRequest.Expression, searchOpts)
	} else {
		// CHANNEL ADMIN: Only see users matching expressions with attributes they possess
		users, count, appErr = c.App.TestExpressionWithChannelContext(c.AppContext, checkExpressionRequest.Expression, searchOpts)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	resp := model.AccessControlPolicyTestResponse{
		Users: users,
		Total: count,
	}

	js, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("checkExpression", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func validateExpressionAgainstRequester(c *Context, w http.ResponseWriter, r *http.Request) {
	var request struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
	}

	if jsonErr := json.NewDecoder(r.Body).Decode(&request); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	// Get channelId from request body (required for channel-specific permission check)
	channelId := request.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	// Check permissions: system admin OR channel-specific permission
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// For channel admins, channelId is required
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}

		// SECURE: Check specific channel permission
		hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}

	// Direct validation against requester
	matches, appErr := c.App.ValidateExpressionAgainstRequester(c.AppContext, request.Expression, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	response := struct {
		RequesterMatches bool `json:"requester_matches"`
	}{
		RequesterMatches: matches,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchAccessControlPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var props *model.AccessControlPolicySearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("access_control_policy_search", err)
		return
	}

	policies, total, appErr := c.App.SearchAccessControlPolicies(c.AppContext, *props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	result := model.AccessControlPoliciesWithCount{
		Policies: policies,
		Total:    total,
	}

	js, err := json.Marshal(result)
	if err != nil {
		c.Err = model.NewAppError("searchAccessControlPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateActiveStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

	policyID := c.Params.PolicyId

	// Check if user has system admin permission OR channel-specific permission for this policy
	hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasManageSystemPermission {
		// For non-system admins, validate policy access permission
		if appErr := c.App.ValidateAccessControlPolicyPermission(c.AppContext, c.AppContext.Session().UserId, policyID); appErr != nil {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateActiveStatus, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)

	active := r.URL.Query().Get("active")
	if active != "true" && active != "false" {
		c.SetInvalidParam("active")
		return
	}
	activeBool, err := strconv.ParseBool(active)
	if err != nil {
		c.SetInvalidParamWithErr("active", err)
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "active", activeBool)

	appErr := c.App.UpdateAccessControlPolicyActive(c.AppContext, policyID, activeBool)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	// Return success response
	response := map[string]any{
		"status": "OK",
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func assignAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	var assignments struct {
		ChannelIds []string `json:"channel_ids"`
	}

	err := json.NewDecoder(r.Body).Decode(&assignments)
	if err != nil {
		c.SetInvalidParamWithErr("assignments", err)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAssignAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIds)

	if len(assignments.ChannelIds) != 0 {
		_, appErr := c.App.AssignAccessControlPolicyToChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	auditRec.Success()
}

func unassignAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	var assignments struct {
		ChannelIds []string `json:"channel_ids"`
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUnassignAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIds)

	err := json.NewDecoder(r.Body).Decode(&assignments)
	if err != nil {
		c.SetInvalidParamWithErr("assignments", err)
		return
	}

	if len(assignments.ChannelIds) != 0 {
		appErr := c.App.UnassignPoliciesFromChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	auditRec.Success()
}

func getChannelsForAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	afterID := r.URL.Query().Get("after")
	if afterID != "" && !model.IsValidId(afterID) {
		c.SetInvalidParam("after")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.Err = model.NewAppError("getChannelsForAccessControlPolicy", "api.access_control_policy.get_channels.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	channels, total, appErr := c.App.GetChannelsForPolicy(c.AppContext, policyID, model.AccessControlPolicyCursor{
		ID: afterID,
	}, limit)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data := model.ChannelsWithCount{Channels: channels, TotalCount: total}

	js, err := json.Marshal(data)
	if err != nil {
		c.Err = model.NewAppError("getChannelsForAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchChannelsForAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	policyID := c.Params.PolicyId

	c.RequirePolicyId()

	opts := model.ChannelSearchOpts{
		Deleted:                     props.Deleted,
		IncludeDeleted:              props.IncludeDeleted,
		Private:                     true,
		ExcludeGroupConstrained:     true,
		TeamIds:                     props.TeamIds,
		ParentAccessControlPolicyId: policyID,
	}

	channels, total, appErr := c.App.SearchAllChannels(c.AppContext, props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data := model.ChannelsWithCount{Channels: channels, TotalCount: total}

	channelsJSON, jsonErr := json.Marshal(data)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchChannelsInPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	if _, err := w.Write(channelsJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getFieldsAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	// Get channelId from query parameters (required for channel-specific permission check)
	channelId := r.URL.Query().Get("channelId")
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	// Check permissions: system admin OR channel-specific permission
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// For channel admins, channelId is required
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}

		// SECURE: Check specific channel permission
		hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}

	after := r.URL.Query().Get("after")
	if after != "" && !model.IsValidId(after) {
		c.SetInvalidParam("after")
		return
	} else if after == "" {
		after = strings.Repeat("0", 26)
	}

	limitStr := r.URL.Query().Get("limit")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.Err = model.NewAppError("getFieldsAutocomplete", "api.access_control_policy.get_fields.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	if limit <= 0 || limit > 100 {
		c.Err = model.NewAppError("getFieldsAutocomplete", "api.access_control_policy.get_fields.limit.app_error", nil, "", http.StatusBadRequest)
		return
	}

	var ac []*model.PropertyField
	var appErr *model.AppError

	ac, appErr = c.App.GetAccessControlFieldsAutocomplete(c.AppContext, after, limit)

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(ac)
	if err != nil {
		c.Err = model.NewAppError("getExpressionAutocomplete", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func convertToVisualAST(c *Context, w http.ResponseWriter, r *http.Request) {
	var cel struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&cel); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	// Get channelId from request body (required for channel-specific permission check)
	channelId := cel.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	// Check permissions: system admin OR channel-specific permission
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// For channel admins, channelId is required
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}

		// SECURE: Check specific channel permission
		hasChannelPermission := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}
	visualAST, appErr := c.App.ExpressionToVisualAST(c.AppContext, cel.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(visualAST)
	if err != nil {
		c.Err = model.NewAppError("convertToVisualAST", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
