// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

// APIs for self-hosted workspaces to communicate with the backing customer & payments system.
// Endpoints for cloud installations should not go in this file.
func (api *API) InitHostedCustomer() {

	// POST /api/v4/hosted_customer/bootstrap
	api.BaseRoutes.HostedCustomer.Handle("/bootstrap", api.APISessionRequired(selfHostedBootstrap)).Methods("POST")

	// GET /api/v4/cloud/cws-health-check
	api.BaseRoutes.HostedCustomer.Handle("/cws-health-check", api.APIHandler(handleCWSHealthCheck)).Methods("GET")
}

func ensureSelfHostedAdmin(c *Context, where string) {
	license := c.App.Channels().License()

	if license.IsCloud() {
		c.Err = model.NewAppError(where, "api.cloud.license_error", nil, "Cloud installations do not use this endpoint", http.StatusBadRequest)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteBilling) {
		c.SetPermissionError(model.PermissionSysconsoleWriteBilling)
		return
	}
}

func checkSelfHostedFirstTimePurchaseEnabled(c *Context) bool {
	config := c.App.Config()
	if config == nil {
		return false
	}
	enabled := config.ServiceSettings.SelfHostedFirstTimePurchase
	return enabled != nil && *enabled
}

func selfHostedBootstrap(c *Context, w http.ResponseWriter, r *http.Request) {
	where := "Api4.selfHostedBootstrap"
	if !checkSelfHostedFirstTimePurchaseEnabled(c) {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusNotImplemented)
		return
	}
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}

	user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
	if userErr != nil {
		c.Err = userErr
		return
	}

	signupProgress, err := c.App.Cloud().BootstrapSelfHostedSignup(model.BootstrapSelfHostedSignupRequest{Email: user.Email})
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError)
		return
	}
	json, err := json.Marshal(signupProgress)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func handleCWSHealthCheck(c *Context, w http.ResponseWriter, r *http.Request) {
	if err := c.App.Cloud().CWSHealthCheck(c.AppContext.Session().UserId); err != nil {
		c.Err = model.NewAppError("Api4.handleCWSHealthCheck", "api.server.cws.health_check.app_error", nil, "", http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
}
