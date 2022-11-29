// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

// APIs for self-hosted workspaces to communicate with the backing customer & payments system.
// Endpoints for cloud installations should not go in this file.
func (api *API) InitHostedCustomer() {
	// POST /api/v4/hosted_customer/available
	api.BaseRoutes.HostedCustomer.Handle("/signup_available", api.APISessionRequired(handleSignupAvailable)).Methods("GET")
	// POST /api/v4/hosted_customer/bootstrap
	api.BaseRoutes.HostedCustomer.Handle("/bootstrap", api.APISessionRequired(selfHostedBootstrap)).Methods("POST")
	// POST /api/v4/hosted_customer/customer
	api.BaseRoutes.HostedCustomer.Handle("/customer", api.APISessionRequired(selfHostedCustomer)).Methods("POST")
	// POST /api/v4/hosted_customer/confirm
	api.BaseRoutes.HostedCustomer.Handle("/confirm", api.APISessionRequired(selfHostedConfirm)).Methods("POST")
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

func checkSelfHostedPurchaseEnabled(c *Context) bool {
	config := c.App.Config()
	if config == nil {
		return false
	}
	enabled := config.ServiceSettings.SelfHostedPurchase
	return enabled != nil && *enabled
}

func selfHostedBootstrap(c *Context, w http.ResponseWriter, r *http.Request) {
	where := "Api4.selfHostedBootstrap"
	if !checkSelfHostedPurchaseEnabled(c) {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusNotImplemented)
		return
	}
	reset := r.URL.Query().Get("reset") == "true"
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}

	user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
	if userErr != nil {
		c.Err = userErr
		return
	}

	signupProgress, err := c.App.Cloud().BootstrapSelfHostedSignup(model.BootstrapSelfHostedSignupRequest{Email: user.Email, Reset: reset})
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

func selfHostedCustomer(c *Context, w http.ResponseWriter, r *http.Request) {
	where := "Api4.selfHostedPayment"
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}
	if !checkSelfHostedPurchaseEnabled(c) {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	var form *model.SelfHostedCustomerForm
	if err = json.Unmarshal(bodyBytes, &form); err != nil {
		fmt.Printf("%s\n", bodyBytes)
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	confirmResponse, err := c.App.Cloud().CreateCustomerSelfHostedSignup(*form)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	json, err := json.Marshal(confirmResponse)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}

func selfHostedConfirm(c *Context, w http.ResponseWriter, r *http.Request) {
	where := "Api4.selfHostedConfirm"
	fmt.Println(where + " A")
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}
	if !checkSelfHostedPurchaseEnabled(c) {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	fmt.Println(where + " B")
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	var confirm model.SelfHostedConfirmPaymentMethodRequest
	err = json.Unmarshal(bodyBytes, &confirm)
	fmt.Println(where + " C")
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.request_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	confirmResponse, err := c.App.Cloud().ConfirmSelfHostedSignup(confirm)
	fmt.Println(where + " D")
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	license, err := c.App.Srv().Platform().SaveLicense([]byte(confirmResponse.License))
	fmt.Println(where + " E")
	if err != nil {
		valErr := reflect.ValueOf(err)
		if !valErr.IsNil() {
			fmt.Println(where + " E1")
			c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}
	}
	clientResponse, err := json.Marshal(model.SelfHostedSignupConfirmClientResponse{
		License:  utils.GetClientLicense(license),
		Progress: confirmResponse.Progress,
	})
	fmt.Println(where + " F")
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	_, _ = w.Write(clientResponse)
}

func handleSignupAvailable(c *Context, w http.ResponseWriter, r *http.Request) {
	where := "Api4.handleCWSHealthCheck"
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}
	if !checkSelfHostedPurchaseEnabled(c) {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusNotImplemented)
		return
	}
	if err := c.App.Cloud().SelfHostedSignupAvailable(); err != nil {
		c.Err = model.NewAppError(where, "api.server.hosted_signup_unavailable.error", nil, "", http.StatusNotImplemented)
		return
	}

	ReturnStatusOK(w)
}
