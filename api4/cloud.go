// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitCloud() {
	// GET /api/v4/cloud/products
	api.BaseRoutes.Cloud.Handle("/products", api.ApiSessionRequired(getCloudProducts)).Methods("GET")

	// POST /api/v4/cloud/payment
	// POST /api/v4/cloud/payment/confirm
	api.BaseRoutes.Cloud.Handle("/payment", api.ApiSessionRequired(createCustomerPayment)).Methods("POST")
	api.BaseRoutes.Cloud.Handle("/payment/confirm", api.ApiSessionRequired(confirmCustomerPayment)).Methods("POST")

	// GET /api/v4/cloud/customer
	// PUT /api/v4/cloud/customer
	// PUT /api/v4/cloud/customer/address
	api.BaseRoutes.Cloud.Handle("/customer", api.ApiSessionRequired(getCloudCustomer)).Methods("GET")
	api.BaseRoutes.Cloud.Handle("/customer", api.ApiSessionRequired(updateCloudCustomer)).Methods("PUT")
	api.BaseRoutes.Cloud.Handle("/customer/address", api.ApiSessionRequired(updateCloudCustomerAddress)).Methods("PUT")

	// GET /api/v4/cloud/subscription
	api.BaseRoutes.Cloud.Handle("/subscription", api.ApiSessionRequired(getSubscription)).Methods("GET")
	api.BaseRoutes.Cloud.Handle("/subscription/invoices", api.ApiSessionRequired(getInvoicesForSubscription)).Methods("GET")
	api.BaseRoutes.Cloud.Handle("/subscription/invoices/{invoice_id:in_[A-Za-z0-9]+}/pdf", api.ApiSessionRequired(getSubscriptionInvoicePDF)).Methods("GET")
}

func getSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	subscription, appErr := c.App.Cloud().GetSubscription()

	if appErr != nil {
		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(subscription)
	if err != nil {
		c.Err = model.NewAppError("Api4.getSubscription", "api.cloud.request_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func getCloudProducts(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	products, appErr := c.App.Cloud().GetCloudProducts()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(products)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudProducts", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func getCloudCustomer(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.getCloudCustomer", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	customer, appErr := c.App.Cloud().GetCloudCustomer()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getCloudCustomer", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.getCloudCustomer", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func updateCloudCustomer(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	bodyBytes, err := ioutil.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	var customerInfo *model.CloudCustomerInfo
	if err = json.Unmarshal(bodyBytes, &customerInfo); err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	customer, appErr := c.App.Cloud().UpdateCloudCustomer(customerInfo)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomer", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func updateCloudCustomerAddress(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	bodyBytes, err := ioutil.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	var address *model.Address
	if err = json.Unmarshal(bodyBytes, &address); err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	customer, appErr := c.App.Cloud().UpdateCloudCustomerAddress(address)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(customer)
	if err != nil {
		c.Err = model.NewAppError("Api4.updateCloudCustomerAddress", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func createCustomerPayment(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.createCustomerPayment", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	auditRec := c.MakeAuditRecord("createCustomerPayment", audit.Fail)
	defer c.LogAuditRec(auditRec)

	intent, appErr := c.App.Cloud().CreateCustomerPayment()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.createCustomerPayment", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(intent)
	if err != nil {
		c.Err = model.NewAppError("Api4.createCustomerPayment", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	w.Write(json)
}

func confirmCustomerPayment(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.confirmCustomerPayment", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	auditRec := c.MakeAuditRecord("confirmCustomerPayment", audit.Fail)
	defer c.LogAuditRec(auditRec)

	bodyBytes, err := ioutil.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.confirmCustomerPayment", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	var confirmRequest *model.ConfirmPaymentMethodRequest
	if err = json.Unmarshal(bodyBytes, &confirmRequest); err != nil {
		c.Err = model.NewAppError("Api4.confirmCustomerPayment", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	appErr := c.App.Cloud().ConfirmCustomerPayment(confirmRequest)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.createCustomerPayment", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}

func getInvoicesForSubscription(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.getInvoicesForSubscription", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	invoices, appErr := c.App.Cloud().GetInvoicesForSubscription()
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getInvoicesForSubscription", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(invoices)
	if err != nil {
		c.Err = model.NewAppError("Api4.getInvoicesForSubscription", "api.cloud.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func getSubscriptionInvoicePDF(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.App.Srv().License() == nil || !*c.App.Srv().License().Features.Cloud {
		c.Err = model.NewAppError("Api4.getSuscriptionInvoicePDF", "api.cloud.license_error", nil, "", http.StatusNotImplemented)
		return
	}

	c.RequireInvoiceId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	pdfData, appErr := c.App.Cloud().GetInvoicePDF(c.Params.InvoiceId)
	if appErr != nil {
		c.Err = model.NewAppError("Api4.getSuscriptionInvoicePDF", "api.cloud.request_error", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	err := writeFileResponse(
		fmt.Sprintf("%s.pdf", c.Params.InvoiceId),
		"application/pdf",
		int64(binary.Size(pdfData)),
		time.Now(),
		*c.App.Config().ServiceSettings.WebserverMode,
		bytes.NewReader(pdfData),
		false,
		w,
		r,
	)
	if err != nil {
		c.Err = err
		return
	}
}
