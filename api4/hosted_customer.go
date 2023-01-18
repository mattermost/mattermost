// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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
	// GET /api/v4/hosted_customer/invoices
	api.BaseRoutes.HostedCustomer.Handle("/invoices", api.APISessionRequired(selfHostedInvoices)).Methods("GET")
	// GET /api/v4/hosted_customer/invoices/{invoice_id:in_[A-Za-z0-9]+}/pdf
	api.BaseRoutes.HostedCustomer.Handle("/invoices/{invoice_id:in_[A-Za-z0-9]+}/pdf", api.APISessionRequired(selfHostedInvoicePDF)).Methods("GET")
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
	const where = "Api4.selfHostedBootstrap"
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
	const where = "Api4.selfHostedCustomer"
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
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
	if userErr != nil {
		c.Err = userErr
		return
	}
	customerResponse, err := c.App.Cloud().CreateCustomerSelfHostedSignup(*form, user.Email)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	json, err := json.Marshal(customerResponse)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.request_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}

func selfHostedConfirm(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.selfHostedConfirm"
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

	var confirm model.SelfHostedConfirmPaymentMethodRequest
	err = json.Unmarshal(bodyBytes, &confirm)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.request_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
	if userErr != nil {
		c.Err = userErr
		return
	}
	confirmResponse, err := c.App.Cloud().ConfirmSelfHostedSignup(confirm, user.Email)
	if err != nil {
		if confirmResponse != nil {
			c.App.NotifySelfHostedSignupProgress(confirmResponse.Progress, user.Id)
		}

		if err.Error() == fmt.Sprintf("%d", http.StatusUnprocessableEntity) {
			c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusUnprocessableEntity).Wrap(err)
			return
		}
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	license, err := c.App.Srv().Platform().SaveLicense([]byte(confirmResponse.License))
	// dealing with an AppError
	if !(reflect.ValueOf(err).Kind() == reflect.Ptr && reflect.ValueOf(err).IsNil()) {
		if confirmResponse != nil {
			c.App.NotifySelfHostedSignupProgress(confirmResponse.Progress, user.Id)
		}
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	clientResponse, err := json.Marshal(model.SelfHostedSignupConfirmClientResponse{
		License:  utils.GetClientLicense(license),
		Progress: confirmResponse.Progress,
	})
	if err != nil {
		if confirmResponse != nil {
			c.App.NotifySelfHostedSignupProgress(confirmResponse.Progress, user.Id)
		}
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	go func() {
		err := c.App.Cloud().ConfirmSelfHostedSignupLicenseApplication()
		if err != nil {
			c.Logger.Warn("Unable to confirm license application", mlog.Err(err))
		}
	}()

	_, _ = w.Write(clientResponse)
}

func handleSignupAvailable(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.handleSignupAvailable"
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
	systemValue, err := c.App.Srv().Store().System().GetByName(model.SystemHostedPurchaseNeedsScreening)
	if err == nil && systemValue != nil {
		c.Err = model.NewAppError(where, "api.server.hosted_signup_unavailable.error", nil, "", http.StatusTooEarly)
		return
	}

	ReturnStatusOK(w)
}

func selfHostedInvoices(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.selfHostedInvoices"
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}

	invoices, err := c.App.Cloud().GetSelfHostedInvoices()

	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	json, err := json.Marshal(invoices)
	if err != nil {
		c.Err = model.NewAppError(where, "api.cloud.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Write(json)
}

func selfHostedInvoicePDF(c *Context, w http.ResponseWriter, r *http.Request) {
	const where = "Api4.selfHostedInvoicePDF"
	ensureSelfHostedAdmin(c, where)
	if c.Err != nil {
		return
	}

	pdfData, filename, appErr := c.App.Cloud().GetSelfHostedInvoicePDF(c.Params.InvoiceId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getSubscriptionInvoicePDF", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	writeFileResponse(
		filename,
		"application/pdf",
		int64(binary.Size(pdfData)),
		time.Now(),
		*c.App.Config().ServiceSettings.WebserverMode,
		bytes.NewReader(pdfData),
		false,
		w,
		r,
	)
}
