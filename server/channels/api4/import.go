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

func (api *API) InitImport() {
	api.BaseRoutes.Imports.Handle("", api.APISessionRequired(listImports)).Methods(http.MethodGet)
	api.BaseRoutes.Imports.Handle("", api.APISessionRequired(deleteImport)).Methods(http.MethodDelete)
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

func deleteImport(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("deleteImport", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("import_name", c.Params.ImportName)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	importName := c.Params.ImportName

	if err := c.App.DeleteImport(importName); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
