// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitSystemLocal() {
	api.BaseRoutes.System.Handle("/ping", api.ApiLocal(getSystemPing)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiLocal(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(setServerBusy)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(getServerBusyExpires)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(clearServerBusy)).Methods("DELETE")
	api.BaseRoutes.ApiRoot.Handle("/integrity", api.ApiLocal(localCheckIntegrity)).Methods("POST")
}

func localCheckIntegrity(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("localCheckIntegrity", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var results []model.IntegrityCheckResult
	resultsChan := c.App.Srv().Store.CheckIntegrity()
	for result := range resultsChan {
		results = append(results, result)
	}

	data, err := json.Marshal(results)
	if err != nil {
		c.Err = model.NewAppError("Api4.localCheckIntegrity", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	auditRec.Success()
	w.Write(data)
}
