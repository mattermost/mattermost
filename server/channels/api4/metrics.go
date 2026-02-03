// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitClientPerformanceMetrics() {
	api.BaseRoutes.APIRoot.Handle("/client_perf", api.APISessionRequiredTrustRequester(submitPerformanceReport)).Methods(http.MethodPost)
}

func submitPerformanceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	// we return early if server does not have any metrics infra available
	if c.App.Metrics() == nil || !*c.App.Config().MetricsSettings.EnableClientMetrics {
		return
	}

	var report model.PerformanceReport
	if jsonErr := json.NewDecoder(r.Body).Decode(&report); jsonErr != nil {
		c.SetInvalidParamWithErr("submitPerformanceReport", jsonErr)
		return
	}

	if err := report.IsValid(); err != nil {
		c.SetInvalidParamWithErr("submitPerformanceReport", err)
		return
	}

	if appErr := c.App.RegisterPerformanceReport(c.AppContext, &report); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}
