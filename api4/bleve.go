// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitBleve() {
	api.BaseRoutes.Bleve.Handle("/purge_indexes", api.ApiSessionRequired(purgeBleveIndexes)).Methods("POST")
}

func purgeBleveIndexes(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("purgeBleveIndexes", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_PURGE_BLEVE_INDEXES) {
		c.SetPermissionError(model.PERMISSION_PURGE_BLEVE_INDEXES)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("purgeBleveIndexes", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	if err := c.App.PurgeBleveIndexes(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
