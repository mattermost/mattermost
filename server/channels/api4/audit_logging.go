// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitAuditLogging() {
	api.BaseRoutes.AuditLogs.Handle("/certificate", api.APISessionRequired(addAuditLogCertificate)).Methods(http.MethodPost)
	api.BaseRoutes.AuditLogs.Handle("/certificate", api.APISessionRequired(removeAuditLogCertificate)).Methods(http.MethodDelete)
}

func parseAuditLogCertificateRequest(r *http.Request, maxFileSize int64) (*multipart.FileHeader, *model.AppError) {
	err := r.ParseMultipartForm(maxFileSize)
	if err != nil {
		return nil, model.NewAppError("addAuditLogCertificate", "api.admin.add_certificate.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	m := r.MultipartForm

	fileArray, ok := m.File["certificate"]
	if !ok || len(fileArray) == 0 {
		return nil, model.NewAppError("addAuditLogCertificate", "api.admin.add_certificate.no_file.app_error", nil, "", http.StatusBadRequest)
	}

	if len(fileArray) > 1 {
		return nil, model.NewAppError("addAuditLogCertificate", "api.admin.add_certificate.multiple_files.app_error", nil, "", http.StatusBadRequest)
	}

	return fileArray[0], nil
}

func addAuditLogCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Logger.Debug("addAuditLogCertificate")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteExperimentalFeatures) {
		c.SetPermissionError(model.PermissionSysconsoleWriteExperimentalFeatures)
		return
	}

	fileData, err := parseAuditLogCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("addAuditLogCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	if err := c.App.AddAuditLogCertificate(c.AppContext, fileData); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeAuditLogCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Logger.Debug("removeAuditLogCertificate")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteExperimentalFeatures) {
		c.SetPermissionError(model.PermissionSysconsoleWriteExperimentalFeatures)
		return
	}

	auditRec := c.MakeAuditRecord("removeAuditLogCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveAuditLogCertificate(c.AppContext); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}
