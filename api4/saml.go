// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io/ioutil"
	"mime"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
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

	api.BaseRoutes.SAML.Handle("/metadatafromidp", api.ApiHandler(getSamlMetadataFromIdp)).Methods("POST")
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
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

	if d == "application/x-pem-file" {
		body, err := ioutil.ReadAll(r.Body)
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

		if err := c.App.AddSamlIdpCertificate(fileData); err != nil {
			c.Err = err
			return
		}
	} else {
		c.Err = model.NewAppError("addSamlIdpCertificate", "api.admin.saml.set_certificate_from_metadata.invalid_content_type.app_error", nil, "", http.StatusBadRequest)
		return
	}

	ReturnStatusOK(w)
}

func removeSamlPublicCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	status := c.App.GetSamlCertificateStatus()
	w.Write([]byte(status.ToJson()))
}

func getSamlMetadataFromIdp(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	props := model.MapFromJson(r.Body)
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

	w.Write([]byte(metadata.ToJson()))
}
