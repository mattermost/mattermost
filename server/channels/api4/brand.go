// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

const (
	loginImageType     = "image.png"
	lightThemeLogoType = "light-logo.png"
	darkThemeLogoType  = "dark-logo.png"
	faviconLogoType    = "favicon.png"
	backgroundLogoType = "background.png"
)

func (api *API) InitBrand() {
	api.BaseRoutes.Brand.Handle("/image", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/image", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/image", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
	api.BaseRoutes.Brand.Handle("/light-logo", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/light-logo", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/light-logo", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
	api.BaseRoutes.Brand.Handle("/dark-logo", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/dark-logo", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/dark-logo", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
	api.BaseRoutes.Brand.Handle("/favicon", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/favicon", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/favicon", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
	api.BaseRoutes.Brand.Handle("/background", api.APIHandlerTrustRequester(getBrandImage)).Methods(http.MethodGet)
	api.BaseRoutes.Brand.Handle("/background", api.APISessionRequired(uploadBrandImage, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Brand.Handle("/background", api.APISessionRequired(deleteBrandImage)).Methods(http.MethodDelete)
}

func getImageType(r *http.Request) string {
	// No permission check required
	if strings.HasSuffix(r.URL.Path, "/light-logo") {
		return lightThemeLogoType
	} else if strings.HasSuffix(r.URL.Path, "/dark-logo") {
		return darkThemeLogoType
	} else if strings.HasSuffix(r.URL.Path, "/favicon") {
		return faviconLogoType
	} else if strings.HasSuffix(r.URL.Path, "/background") {
		return backgroundLogoType
	}
	return loginImageType
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	imageType := getImageType(r)
	img, err := c.App.GetBrandImage(c.AppContext, imageType)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		w.Write(nil)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Write(img)
}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(io.Discard, r.Body)

	if r.ContentLength > *c.App.Config().FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize); err != nil {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.parse.app_error", nil, "", http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	auditRec := c.MakeAuditRecord("uploadBrandImage", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionEditBrand) {
		c.SetPermissionError(model.PermissionEditBrand)
		return
	}

	imageType := getImageType(r)
	if err := c.App.SaveBrandImage(c.AppContext, imageArray[0], imageType); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	ReturnStatusOK(w)
}

func deleteBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("deleteBrandImage", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionEditBrand) {
		c.SetPermissionError(model.PermissionEditBrand)
		return
	}

	imageType := getImageType(r)
	if err := c.App.DeleteBrandImage(c.AppContext, imageType); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()

	ReturnStatusOK(w)
}
