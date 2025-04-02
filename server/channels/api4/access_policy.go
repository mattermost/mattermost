// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

var policies = []*model.AccessControlPolicy{
	{
		ID:       model.NewId(),
		Name:     "Confidential DS-BP",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		CreateAt: model.GetMillis(),
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"join_channel"},
				Expression: "(user.attributes.Program == \"Dragon Spacecraft\" || user.attributes.Program == \"Black Phoenix\") && user.attributes.Clearance == \"L3\"",
			},
		},
	},
	{
		ID:       model.NewId(),
		Name:     "Northern Command",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		CreateAt: model.GetMillis(),
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"join_channel"},
				Expression: "user.attributes.Program == \"Northern Command\"",
			},
		},
	},
	{
		ID:       model.NewId(),
		Name:     "Dragon Spacecraft",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		CreateAt: model.GetMillis(),
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"join_channel"},
				Expression: "user.attributes.Program == \"Dragon Spacecraft\"",
			},
		},
	},
	{
		ID:       model.NewId(),
		Name:     "Top Secret",
		Type:     model.AccessControlPolicyTypeParent,
		Active:   true,
		CreateAt: model.GetMillis(),
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_1,
		Rules: []model.AccessControlPolicyRule{
			{
				Actions:    []string{"join_channel"},
				Expression: "user.attributes.Clearance >= \"L4\"",
			},
		},
	},
}

func (api *API) InitAccessControlPolicy() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(getAccessPolicies)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchAccessPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APISessionRequired(assignAccessPolicy)).Methods(http.MethodPost)
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

	if appErr := policy.IsValid(); appErr != nil {
		c.Err = appErr
		return
	}

	policies = append(policies, &policy)
	w.WriteHeader(http.StatusCreated)
}

func getAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	fmt.Println("getAccessPolicy")

	js, err := json.Marshal(policies[0])
	if err != nil {
		c.Err = model.NewAppError("getAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAccessPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	// TODO: Implement pagination
	// TODO: Implement filtering by type and also check permissions

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	js, err := json.Marshal(policies)
	if err != nil {
		c.Err = model.NewAppError("getAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	fields, appErr := c.App.ListCPAFields()
	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, field := range fields {
		fmt.Printf("Field ID: %s", field.ID)
		fmt.Printf(" Field Name: %s", field.Name)
		fmt.Printf(" Field Type: %s\n", field.Type)
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchAccessPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	// search should be implemented
	// - search by name
	// - search by attribute
	// - search by channel
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

	users, attributes, appErr := c.App.TestExpression(c.AppContext, checkExpressionRequest.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	resp := model.AccessControlPolicyTestResponse{
		Users:      users,
		Attributes: attributes,
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
	// assign access policy to channel
	// assign access policy to user
	// assign access policy to group
}
