// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"net/http"
)

func (api *API) InitServiceTerms() {
	api.BaseRoutes.ServiceTerms.Handle("", api.ApiSessionRequired(getServiceTerms)).Methods("GET")
	api.BaseRoutes.ServiceTerms.Handle("", api.ApiSessionRequired(createServiceTerms)).Methods("POST")
}

func getServiceTerms(c *Context, w http.ResponseWriter, r *http.Request) {
	serviceTerms, err := c.App.GetLatestServiceTerms()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(serviceTerms.ToJson()))
}

func createServiceTerms(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if license := c.App.License(); license == nil || !*license.Features.CustomTermsOfService {
		c.Err = model.NewAppError("createServiceTerms", "api.create_service_terms.custom_service_terms_disabled.app_error", nil, "", http.StatusBadRequest)
		return
	}

	props := model.MapFromJson(r.Body)
	text := props["text"]
	userId := c.Session.UserId

	if text == "" {
		c.Err = model.NewAppError("Config.IsValid", "api.create_service_terms.empty_text.app_error", nil, "", http.StatusBadRequest)
		return
	}

	oldServiceTerms, err := c.App.GetLatestServiceTerms()
	if err != nil && err.Id != app.ERROR_SERVICE_TERMS_NO_ROWS_FOUND {
		c.Err = err
		return
	}

	if oldServiceTerms == nil || oldServiceTerms.Text != text {
		serviceTerms, err := c.App.CreateServiceTerms(text, userId)
		if err != nil {
			c.Err = err
			return
		}

		w.Write([]byte(serviceTerms.ToJson()))
	} else {
		w.Write([]byte(oldServiceTerms.ToJson()))
	}
}
