// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io/ioutil"
	"net/http"

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
