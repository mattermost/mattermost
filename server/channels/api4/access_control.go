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
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitAccessControlPolicy() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequired(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/autocomplete/fields", api.APISessionRequired(getFieldsAutocomplete)).Methods(http.MethodGet)

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
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createAccessControlPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	np, appErr := c.App.CreateOrUpdateAccessControlPolicy(c.AppContext, &policy)
	if appErr != nil {
		c.Err = appErr
		return
	}

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
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

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
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	appErr := c.App.DeleteAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}
}

func checkExpression(c *Context, w http.ResponseWriter, r *http.Request) {
	checkExpressionRequest := struct {
		Expression string `json:"expression"`
	}{}
	if jsonErr := json.NewDecoder(r.Body).Decode(&checkExpressionRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("checkExpression", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
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

	auditRec := c.MakeAuditRecord("checkExpression", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	users, count, appErr := c.App.TestExpression(c.AppContext, checkExpressionRequest.Expression, model.SubjectSearchOptions{
		Term:  checkExpressionRequest.Term,
		Limit: checkExpressionRequest.Limit,
		Cursor: model.SubjectCursor{
			TargetID: checkExpressionRequest.After,
		},
	})
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
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

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

	policyID := c.Params.PolicyId

	appErr := c.App.UpdateAccessControlPolicyActive(c.AppContext, policyID, activeBool)
	if appErr != nil {
		c.Err = appErr
		return
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

	if len(assignments.ChannelIds) != 0 {
		_, appErr := c.App.AssignAccessControlPolicyToChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}
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

	err := json.NewDecoder(r.Body).Decode(&assignments)
	if err != nil {
		c.SetInvalidParamWithErr("assignments", err)
		return
	}

	if len(assignments.ChannelIds) != 0 {
		appErr := c.App.UnAssignPoliciesFromChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}
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
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
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

	ac, appErr := c.App.GetAccessControlFieldsAutocomplete(c.AppContext, after, limit)
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
