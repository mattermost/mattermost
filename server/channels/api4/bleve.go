// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitBleve() {
	api.BaseRoutes.Bleve.Handle("/purge_indexes", api.APISessionRequired(purgeBleveIndexes)).Methods(http.MethodPost)
}

func purgeBleveIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("purgeBleveIndexes", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionPurgeBleveIndexes) {
		c.SetPermissionError(model.PermissionPurgeBleveIndexes)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("purgeBleveIndexes", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.PurgeBleveIndexes(c.AppContext); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
