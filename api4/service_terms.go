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
	props := model.MapFromJson(r.Body)
	text := props["text"]
	userId := c.Session.UserId

	oldServiceTerms, err := c.App.GetLatestServiceTerms()
	if err != nil && err.Id != app.ERROR_SERVICE_TERMS_NO_ROWS_FOUND {
		c.Err = err
		return
	}

	if oldServiceTerms.Text != text {
		serviceTerms, err := c.App.CreateServiceTerms(text, userId)
		if err != nil {
			c.Err = err
			return
		}

		w.Write([]byte(serviceTerms.ToJson()))
	} else {
		ReturnStatusOK(w)
	}
}
