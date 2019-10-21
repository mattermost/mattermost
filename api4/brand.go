// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"io"
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/tracing"
)

func (api *API) InitBrand() {
	api.BaseRoutes.Brand.Handle("/image", api.ApiHandlerTrustRequester(getBrandImage)).Methods("GET")
	api.BaseRoutes.Brand.Handle("/image", api.ApiSessionRequired(uploadBrandImage)).Methods("POST")
	api.BaseRoutes.Brand.Handle("/image", api.ApiSessionRequired(deleteBrandImage)).Methods("DELETE")
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	span,
		// No permission check required
		ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:brand:getBrandImage")
	c.App.Context = ctx
	defer span.Finish()

	img, err := c.App.GetBrandImage()
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		w.Write(nil)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Write(img)
}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:brand:uploadBrandImage")
	c.App.Context = ctx
	defer span.Finish()
	defer io.Copy(ioutil.Discard, r.Body)

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

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.SaveBrandImage(imageArray[0]); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	ReturnStatusOK(w)
}

func deleteBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	span, ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:brand:deleteBrandImage")
	c.App.Context = ctx
	defer span.Finish()
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.DeleteBrandImage(); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
