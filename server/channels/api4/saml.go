// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitSaml() {
	api.BaseRoutes.SAML.Handle("/metadata", api.APIHandler(getSamlMetadata)).Methods("GET")

	api.BaseRoutes.SAML.Handle("/certificate/public", api.APISessionRequired(addSamlPublicCertificate)).Methods("POST")
	api.BaseRoutes.SAML.Handle("/certificate/private", api.APISessionRequired(addSamlPrivateCertificate)).Methods("POST")
	api.BaseRoutes.SAML.Handle("/certificate/idp", api.APISessionRequired(addSamlIdpCertificate)).Methods("POST")

	api.BaseRoutes.SAML.Handle("/certificate/public", api.APISessionRequired(removeSamlPublicCertificate)).Methods("DELETE")
	api.BaseRoutes.SAML.Handle("/certificate/private", api.APISessionRequired(removeSamlPrivateCertificate)).Methods("DELETE")
	api.BaseRoutes.SAML.Handle("/certificate/idp", api.APISessionRequired(removeSamlIdpCertificate)).Methods("DELETE")

	api.BaseRoutes.SAML.Handle("/certificate/status", api.APISessionRequired(getSamlCertificateStatus)).Methods("GET")

	api.BaseRoutes.SAML.Handle("/metadatafromidp", api.APIHandler(getSamlMetadataFromIdp)).Methods("POST")

	api.BaseRoutes.SAML.Handle("/reset_auth_data", api.APISessionRequired(resetAuthDataToEmail)).Methods("POST")
}

func (api *API) InitSamlLocal() {
	api.BaseRoutes.SAML.Handle("/reset_auth_data", api.APILocal(resetAuthDataToEmail)).Methods("POST")
}

func getSamlMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	metadata, err := c.App.GetSamlMetadata()
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	w.Header().Set("Content-Disposition", "attachment; filename=\"metadata.xml\"")
	w.Write([]byte(metadata))
}

func parseSamlCertificateRequest(r *http.Request, maxFileSize int64) (*multipart.FileHeader, *model.AppError) {
	err := r.ParseMultipartForm(maxFileSize)
	if err != nil {
		return nil, model.NewAppError("addSamlCertificate", "api.admin.add_certificate.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	m := r.MultipartForm

	fileArray, ok := m.File["certificate"]
	if !ok {
		return nil, model.NewAppError("addSamlCertificate", "api.admin.add_certificate.no_file.app_error", nil, "", http.StatusBadRequest)
	}

	if len(fileArray) <= 0 {
		return nil, model.NewAppError("addSamlCertificate", "api.admin.add_certificate.array.app_error", nil, "", http.StatusBadRequest)
	}

	return fileArray[0], nil
}

func addSamlPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionAddSamlPublicCert) {
		c.SetPermissionError(model.PermissionAddSamlPublicCert)
		return
	}

	fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("addSamlPublicCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	if err := c.App.AddSamlPublicCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func addSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionAddSamlPrivateCert) {
		c.SetPermissionError(model.PermissionAddSamlPrivateCert)
		return
	}

	fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("addSamlPrivateCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	audit.AddEventParameter(auditRec, "filename", fileData.Filename)

	if err := c.App.AddSamlPrivateCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func addSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionAddSamlIdpCert) {
		c.SetPermissionError(model.PermissionAddSamlIdpCert)
		return
	}

	v := r.Header.Get("Content-Type")
	if v == "" {
		c.Err = model.NewAppError("addSamlIdpCertificate", "api.admin.saml.set_certificate_from_metadata.missing_content_type.app_error", nil, "", http.StatusBadRequest)
		return
	}
	d, _, err := mime.ParseMediaType(v)
	if err != nil {
		c.Err = model.NewAppError("addSamlIdpCertificate", "api.admin.saml.set_certificate_from_metadata.invalid_content_type.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("addSamlIdpCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("type", d)

	if d == "application/x-pem-file" {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			c.Err = model.NewAppError("addSamlIdpCertificate", "api.admin.saml.set_certificate_from_metadata.invalid_body.app_error", nil, err.Error(), http.StatusBadRequest)
			return
		}

		if err := c.App.SetSamlIdpCertificateFromMetadata(body); err != nil {
			c.Err = err
			return
		}
	} else if d == "multipart/form-data" {
		fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
		if err != nil {
			c.Err = err
			return
		}
		audit.AddEventParameter(auditRec, "filename", fileData.Filename)

		if err := c.App.AddSamlIdpCertificate(fileData); err != nil {
			c.Err = err
			return
		}
	} else {
		c.Err = model.NewAppError("addSamlIdpCertificate", "api.admin.saml.set_certificate_from_metadata.invalid_content_type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeSamlPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveSamlPublicCert) {
		c.SetPermissionError(model.PermissionRemoveSamlPublicCert)
		return
	}

	auditRec := c.MakeAuditRecord("removeSamlPublicCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveSamlPublicCertificate(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveSamlPrivateCert) {
		c.SetPermissionError(model.PermissionRemoveSamlPrivateCert)
		return
	}

	auditRec := c.MakeAuditRecord("removeSamlPrivateCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveSamlPrivateCertificate(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionRemoveSamlIdpCert) {
		c.SetPermissionError(model.PermissionRemoveSamlIdpCert)
		return
	}

	auditRec := c.MakeAuditRecord("removeSamlIdpCertificate", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if err := c.App.RemoveSamlIdpCertificate(); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getSamlCertificateStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionGetSamlCertStatus) {
		c.SetPermissionError(model.PermissionGetSamlCertStatus)
		return
	}

	status := c.App.GetSamlCertificateStatus()
	if err := json.NewEncoder(w).Encode(status); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getSamlMetadataFromIdp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionGetSamlMetadataFromIdp) {
		c.SetPermissionError(model.PermissionGetSamlMetadataFromIdp)
		return
	}

	props := model.MapFromJSON(r.Body)
	url := props["saml_metadata_url"]
	if url == "" {
		c.SetInvalidParam("saml_metadata_url")
		return
	}

	metadata, err := c.App.GetSamlMetadataFromIdp(url)
	if err != nil {
		c.Err = model.NewAppError("getSamlMetadataFromIdp", "api.admin.saml.failure_get_metadata_from_idp.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	if err := json.NewEncoder(w).Encode(metadata); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func resetAuthDataToEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}
	type ResetAuthDataParams struct {
		IncludeDeleted   bool     `json:"include_deleted"`
		DryRun           bool     `json:"dry_run"`
		SpecifiedUserIDs []string `json:"user_ids"`
	}
	var params *ResetAuthDataParams
	jsonErr := json.NewDecoder(r.Body).Decode(&params)
	if jsonErr != nil {
		c.Err = model.NewAppError("resetAuthDataToEmail", "model.utils.decode_json.app_error", nil, "", http.StatusBadRequest).Wrap(jsonErr)
		return
	}
	numAffected, appErr := c.App.ResetSamlAuthDataToEmail(params.IncludeDeleted, params.DryRun, params.SpecifiedUserIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	n := struct {
		NumAffected int `json:"num_affected"`
	}{
		NumAffected: numAffected,
	}

	if err := json.NewEncoder(w).Encode(n); err != nil {
		c.Logger.Warn("Error writing response", mlog.Err(err))
	}
}
