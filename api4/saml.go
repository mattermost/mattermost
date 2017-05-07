// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"mime/multipart"
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitSaml() {
	l4g.Debug(utils.T("api.saml.init.debug"))

	BaseRoutes.SAML.Handle("/metadata", ApiHandler(getSamlMetadata)).Methods("GET")

	BaseRoutes.SAML.Handle("/certificate/public", ApiSessionRequired(addSamlPublicCertificate)).Methods("POST")
	BaseRoutes.SAML.Handle("/certificate/private", ApiSessionRequired(addSamlPrivateCertificate)).Methods("POST")
	BaseRoutes.SAML.Handle("/certificate/idp", ApiSessionRequired(addSamlIdpCertificate)).Methods("POST")

	BaseRoutes.SAML.Handle("/certificate/public", ApiSessionRequired(removeSamlPublicCertificate)).Methods("DELETE")
	BaseRoutes.SAML.Handle("/certificate/private", ApiSessionRequired(removeSamlPrivateCertificate)).Methods("DELETE")
	BaseRoutes.SAML.Handle("/certificate/idp", ApiSessionRequired(removeSamlIdpCertificate)).Methods("DELETE")

	BaseRoutes.SAML.Handle("/certificate/status", ApiSessionRequired(getSamlCertificateStatus)).Methods("GET")
}

func getSamlMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	metadata, err := app.GetSamlMetadata()
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "application/xml")
	w.Header().Set("Content-Disposition", "attachment; filename=\"metadata.xml\"")
	w.Write([]byte(metadata))
}

func parseSamlCertificateRequest(r *http.Request) (*multipart.FileHeader, *model.AppError) {
	err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize)
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
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r)
	if err != nil {
		c.Err = err
		return
	}

	if err := app.AddSamlPublicCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func addSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r)
	if err != nil {
		c.Err = err
		return
	}

	if err := app.AddSamlPrivateCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func addSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	fileData, err := parseSamlCertificateRequest(r)
	if err != nil {
		c.Err = err
		return
	}

	if err := app.AddSamlIdpCertificate(fileData); err != nil {
		c.Err = err
		return
	}
	ReturnStatusOK(w)
}

func removeSamlPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.RemoveSamlPublicCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeSamlPrivateCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.RemoveSamlPrivateCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func removeSamlIdpCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.RemoveSamlIdpCertificate(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getSamlCertificateStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	status := app.GetSamlCertificateStatus()
	w.Write([]byte(status.ToJson()))
}
