// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitExport() {
	api.BaseRoutes.Exports.Handle("", api.APISessionRequired(listExports)).Methods(http.MethodGet)
	api.BaseRoutes.Export.Handle("", api.APISessionRequired(deleteExport)).Methods(http.MethodDelete)
	api.BaseRoutes.Export.Handle("", api.APISessionRequired(downloadExport)).Methods(http.MethodGet)
	api.BaseRoutes.Export.Handle("/presign-url", api.APISessionRequired(generatePresignURLExport)).Methods(http.MethodPost)
}

func listExports(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	exports, appErr := c.App.ListExports()
	if appErr != nil {
		c.Err = appErr
		return
	}

	data, err := json.Marshal(exports)
	if err != nil {
		c.Err = model.NewAppError("listImports", "app.export.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteExport(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("deleteExport", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "export_name", c.Params.ExportName)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if err := c.App.DeleteExport(c.Params.ExportName); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func downloadExport(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	filePath := filepath.Join(*c.App.Config().ExportSettings.Directory, c.Params.ExportName)
	if ok, err := c.App.ExportFileExists(filePath); err != nil {
		c.Err = err
		return
	} else if !ok {
		c.Err = model.NewAppError("downloadExport", "api.export.export_not_found.app_error", nil, "", http.StatusNotFound)
		return
	}

	file, err := c.App.ExportFileReader(filePath)
	if err != nil {
		c.Err = err
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "application/zip")
	http.ServeContent(w, r, c.Params.ExportName, time.Time{}, file)
}

func generatePresignURLExport(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("generatePresignURLExport", audit.Fail)
	defer c.LogAuditRec(auditRec)

	audit.AddEventParameter(auditRec, "export_name", c.Params.ExportName)

	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	res, appErr := c.App.GeneratePresignURLForExport(c.Params.ExportName)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data, err := json.Marshal(res)
	if err != nil {
		c.Err = model.NewAppError("generatePresignURLExport", "app.export.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	auditRec.Success()
	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
