// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"net/http"
)

func (api *API) InitTermsOfService() {
	api.BaseRoutes.TermsOfService.Handle("", api.ApiSessionRequired(getTermsOfService)).Methods("GET")
	api.BaseRoutes.TermsOfService.Handle("", api.ApiSessionRequired(createTermsOfService)).Methods("POST")
}

func getTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	termsOfService, err := c.App.GetLatestTermsOfService()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(termsOfService.ToJson()))
}

func createTermsOfService(c *Context, w http.ResponseWriter, r *http.Request) {
	//if license := c.App.License(); license == nil || !*license.Features.CustomTermsOfService {
	//	c.Err = model.NewAppError("createTermsOfService", "api.create_service_terms.custom_service_terms_disabled.app_error", nil, "", http.StatusBadRequest)
	//	return
	//}

	props := model.MapFromJson(r.Body)
	text := props["text"]
	userId := c.Session.UserId

	if text == "" {
		c.Err = model.NewAppError("Config.IsValid", "api.create_service_terms.empty_text.app_error", nil, "", http.StatusBadRequest)
		return
	}

	oldTermsOfService, err := c.App.GetLatestTermsOfService()
	if err != nil && err.Id != app.ERROR_SERVICE_TERMS_NO_ROWS_FOUND {
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
