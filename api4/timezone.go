// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitTimezone() {
	api.BaseRoutes.Timezones.Handle("", api.ApiSessionRequired(getSupportedTimezones)).Methods("GET")
}

func getSupportedTimezones(c *Context, w http.ResponseWriter, r *http.Request) {
	supportedTimezones := c.App.Config().SupportedTimezones

	if len(supportedTimezones) == 0 {
		emptyTimezones := make([]string, 0)
		w.Write([]byte(model.TimezonesToJson(emptyTimezones)))
		return
	}

	w.Write([]byte(model.TimezonesToJson(supportedTimezones)))
}
