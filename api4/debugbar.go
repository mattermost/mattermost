// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitDebugBar() {
	api.BaseRoutes.DebugBar.Handle("/systeminfo", api.APISessionRequired(getSystemInfo)).Methods("GET")
	api.BaseRoutes.DebugBar.Handle("/queryexplain", api.APISessionRequired(getQueryExplain)).Methods("POST")
	api.BaseRoutes.DebugBar.Handle("/generatereport", api.APISessionRequired(enableReportToFile)).Methods("POST")
}

func getSystemInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Srv().DebugBar().IsEnabled() {
		c.Err = model.NewAppError("Api4.GetSystemInfo", "api.debugbar.getSystemInfo.disabled_debugbar.error", nil, "", http.StatusNotImplemented)
		return
	}

	info, err := c.App.GetDebugBarInfo()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getQueryExplain(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Srv().DebugBar().IsEnabled() {
		c.Err = model.NewAppError("Api4.GetSystemInfo", "api.debugbar.getSystemInfo.disabled_debugbar.error", nil, "", http.StatusNotImplemented)
		return
	}

	var requestBody struct {
		Query string
		Args  []any
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&requestBody); jsonErr != nil {
		c.SetInvalidParamWithErr("explain_request", jsonErr)
		return
	}

	explain, err := c.App.GetQueryExplain(requestBody.Query, requestBody.Args)
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(map[string]string{"explain": explain}); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func enableReportToFile(c *Context, w http.ResponseWriter, r *http.Request) {
	// Only admins can enable report to file
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageLicenseInformation)
		return
	}

	var requestBody struct {
		Seconds int
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&requestBody); jsonErr != nil {
		c.SetInvalidParamWithErr("seconds", jsonErr)
		return
	}

	if requestBody.Seconds <= 0 {
		c.SetInvalidParam("seconds")
		return
	}

	filename := fmt.Sprintf("debug-report-%d-%s.jsonl", model.GetMillis(), model.NewId())
	c.App.FileBackend().WriteFile(bytes.NewReader([]byte{}), filename)

	c.App.Srv().Platform().DebugBar.AddPublisher("debug-report", func(e *model.WebSocketEvent) {
		data := e.GetData()
		if data["type"] == "sql-query" {
			explain, err := c.App.GetQueryExplain(data["query"].(string), data["args"].([]any))
			if err == nil {
				data["explain"] = explain
			}
		}
		jsondata, err := json.Marshal(data)
		if err != nil {
			return
		}
		c.App.FileBackend().AppendFile(bytes.NewReader(append(jsondata, '\n')), filename)
	})

	model.CreateTask("DebugBarRestore", func() {
		c.App.Srv().Platform().DebugBar.RemovePublisher("debug-report")
	}, time.Duration(requestBody.Seconds)*time.Second)
}
