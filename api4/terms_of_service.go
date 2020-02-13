// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitTermsOfService() {
	api.BaseRoutes.TermsOfService.Handle("", api.ApiSessionRequired(getLatestTermsOfService)).Methods("GET")
	api.BaseRoutes.TermsOfService.Handle("", api.ApiSessionRequired(createTermsOfService)).Methods("POST")
}

func getLatestTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	termsOfService, err := c.App.GetLatestTermsOfService()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(termsOfService.ToJson()))
}

func createTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if license := c.App.License(); license == nil || !*license.Features.CustomTermsOfService {
		c.Err = model.NewAppError("createTermsOfService", "api.create_terms_of_service.custom_terms_of_service_disabled.app_error", nil, "", http.StatusBadRequest)
		return
	}

	props := model.MapFromJson(r.Body)
	text := props["text"]
	userId := c.App.Session.UserId

	if text == "" {
		c.Err = model.NewAppError("Config.IsValid", "api.create_terms_of_service.empty_text.app_error", nil, "", http.StatusBadRequest)
		return
	}

	oldTermsOfService, err := c.App.GetLatestTermsOfService()
	if err != nil && err.Id != app.ERROR_TERMS_OF_SERVICE_NO_ROWS_FOUND {
		c.Err = err
		return
	}

	if oldTermsOfService == nil || oldTermsOfService.Text != text {
		termsOfService, err := c.App.CreateTermsOfService(text, userId)
		if err != nil {
			c.Err = err
			return
		}

		w.Write([]byte(termsOfService.ToJson()))
	} else {
		w.Write([]byte(oldTermsOfService.ToJson()))
	}
}
