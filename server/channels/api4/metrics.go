// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitMetrics() {
	api.BaseRoutes.Metrics.Handle("/", api.APISessionRequired(submitMetrics)).Methods("POST")
}

func submitMetrics(c *Context, w http.ResponseWriter, r *http.Request) {
	// we return early if server does not have any metrics infra available
	if c.App.Metrics() == nil {
		return
	}

	var report model.PerformanceReport
	if jsonErr := json.NewDecoder(r.Body).Decode(&report); jsonErr != nil {
		c.SetInvalidParamWithErr("report", jsonErr)
		return
	}

	if err := report.IsValidTime(); err != nil {
		c.SetInvalidParamWithErr("report", err)
		return
	}

	if appErr := c.App.RegisterPerformanceReport(c.AppContext, &report); appErr != nil {
		c.Err = appErr
		return
	}
}
