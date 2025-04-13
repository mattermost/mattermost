// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitAccessControlPolicy() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(getAccessPolicies)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(deleteAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicies.Handle("/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APISessionRequired(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APISessionRequired(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APISessionRequired(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}

func createAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.AccessControlPolicy
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord("createAccessPolicy", audit.Fail)
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
		c.Err = model.NewAppError("getAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
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
		c.Err = model.NewAppError("getAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAccessPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var policies []*model.AccessControlPolicy
	var appErr *model.AppError

	parentID := r.URL.Query().Get("parent")
	if parentID == "" {
		policies, appErr = c.App.GetAllParentPolicies(c.AppContext, 0, 0)
	} else {
		policies, appErr = c.App.GetAllChildPolicies(c.AppContext, parentID, 0, 0)
	}
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policies)
	if err != nil {
		c.Err = model.NewAppError("getAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
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

func searchChannelsForAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	var props *model.ChannelSearch
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

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

	channels, _, appErr := c.App.SearchAllChannels(c.AppContext, props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelsJSON, jsonErr := json.Marshal(channels)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchChannelsInPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	w.Write(channelsJSON)
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

	users, appErr := c.App.TestExpression(c.AppContext, checkExpressionRequest.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	resp := model.AccessControlPolicyTestResponse{
		Users: users,
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

func assignAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	// assign access policy to channel
	// assign access policy to user
	// assign access policy to group
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
	page := c.Params.Page
	perPage := c.Params.PerPage

	channels, appErr := c.App.GetChannelsForPolicy(c.AppContext, policyID, page, perPage)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(channels)
	if err != nil {
		c.Err = model.NewAppError("getChannelsForAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
