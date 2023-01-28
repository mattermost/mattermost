// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitImport() {
	api.BaseRoutes.Imports.Handle("", api.APISessionRequired(listImports)).Methods("GET")
	api.BaseRoutes.Imports.Handle("", api.APISessionRequired(importDelete)).Methods("DELETE")
}

func listImports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	imports, appErr := c.App.ListImports()
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(imports); err != nil {
		c.Logger.Warn("Error writing imports", mlog.Err(err))
	}
}

func importDelete(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("deleteImport", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("import_name", c.Params.ImportName)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.DeleteImport(c.Params.ImportName); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
