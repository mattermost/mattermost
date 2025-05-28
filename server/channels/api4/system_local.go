// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitSystemLocal() {
	api.BaseRoutes.System.Handle("/ping", api.APILocal(getSystemPing)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/logs", api.APILocal(getLogs)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/server_busy", api.APILocal(setServerBusy)).Methods(http.MethodPost)
	api.BaseRoutes.APIRoot.Handle("/server_busy", api.APILocal(getServerBusyExpires)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/server_busy", api.APILocal(clearServerBusy)).Methods(http.MethodDelete)
	api.BaseRoutes.System.Handle("/support_packet", api.APILocal(generateSupportPacket)).Methods(http.MethodGet)
	api.BaseRoutes.APIRoot.Handle("/integrity", api.APILocal(localCheckIntegrity)).Methods(http.MethodPost)
	api.BaseRoutes.System.Handle("/schema/version", api.APILocal(getAppliedSchemaMigrations)).Methods(http.MethodGet)
}

func localCheckIntegrity(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("localCheckIntegrity", audit.Fail)
	defer c.LogAuditRec(auditRec)

	var results []model.IntegrityCheckResult
	resultsChan := c.App.CheckIntegrity()
	for result := range resultsChan {
		results = append(results, result)
	}

	data, err := json.Marshal(results)
	if err != nil {
		c.Err = model.NewAppError("Api4.localCheckIntegrity", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Failed to write response", mlog.Err(err))
	}
}
