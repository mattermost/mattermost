// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitSaml() {
	api.BaseRoutes.SAML.Handle("/metadata", api.ApiHandler(getSamlMetadata)).Methods("GET")

	api.BaseRoutes.SAML.Handle("/certificate/public", api.ApiSessionRequired(addSamlPublicCertificate)).Methods("POST")
	api.BaseRoutes.SAML.Handle("/certificate/private", api.ApiSessionRequired(addSamlPrivateCertificate)).Methods("POST")
	api.BaseRoutes.SAML.Handle("/certificate/idp", api.ApiSessionRequired(addSamlIdpCertificate)).Methods("POST")

	api.BaseRoutes.SAML.Handle("/certificate/public", api.ApiSessionRequired(removeSamlPublicCertificate)).Methods("DELETE")
	api.BaseRoutes.SAML.Handle("/certificate/private", api.ApiSessionRequired(removeSamlPrivateCertificate)).Methods("DELETE")
	api.BaseRoutes.SAML.Handle("/certificate/idp", api.ApiSessionRequired(removeSamlIdpCertificate)).Methods("DELETE")

	api.BaseRoutes.SAML.Handle("/certificate/status", api.ApiSessionRequired(getSamlCertificateStatus)).Methods("GET")
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
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	if err := c.App.AddSamlPublicCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func addSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	if err := c.App.AddSamlPrivateCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func addSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r, *c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		c.Err = err
		return
	}

	if err := c.App.AddSamlIdpCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func removeSamlPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.RemoveSamlPublicCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.RemoveSamlPrivateCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.RemoveSamlIdpCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getSamlCertificateStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	status := c.App.GetSamlCertificateStatus()
	w.Write([]byte(status.ToJson()))
}
