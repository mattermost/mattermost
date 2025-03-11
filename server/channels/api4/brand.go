// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/api4/validation"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

func (api *API) InitBrand() {
	api.BaseRoutes.Brand.Handle("/image", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/image", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/image", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	// Validate request
	validator := &validation.GetBrandImageValidator{}
	if err := validator.Validate(r); err != nil {
		c.Err = err
		return
	}

	// No permission check required

	img, err := c.App.GetBrandImage(c.AppContext)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		if _, err := w.Write(nil); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	w.Header().Set("Content-Type", "image/png")
	if _, err := w.Write(img); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer func() {
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			c.Logger.Warn("Error discarding request body", mlog.Err(err))
		}
	}()

	// Validate request
	validator := &validation.UploadBrandImageValidator{
		MaxFileSize: *c.App.Config().FileSettings.MaxFileSize,
	}
	if err := validator.Validate(r); err != nil {
		c.Err = err
		return
	}

	m := r.MultipartForm
	imageArray := m.File["image"]

	auditRec := c.MakeAuditRecord("uploadBrandImage", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionEditBrand) {
		c.SetPermissionError(model.PermissionEditBrand)
		return
	}

	if err := c.App.SaveBrandImage(c.AppContext, imageArray[0]); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	ReturnStatusOK(w)
}

func deleteBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	// Validate request
	validator := &validation.DeleteBrandImageValidator{}
	if err := validator.Validate(r); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord("deleteBrandImage", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionEditBrand) {
		c.SetPermissionError(model.PermissionEditBrand)
		return
	}

	if err := c.App.DeleteBrandImage(c.AppContext); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
