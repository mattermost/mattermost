// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitBrand() {
	l4g.Debug(utils.T("api.brand.init.debug"))

	BaseRoutes.Brand.Handle("/image", ApiHandlerTrustRequester(getBrandImage)).Methods("GET")
	BaseRoutes.Brand.Handle("/image", ApiSessionRequired(uploadBrandImage)).Methods("POST")
}

func getBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required

	if img, err := app.GetBrandImage(); err != nil {
		w.WriteHeader(http.StatusNotFound)
		w.Write(nil)
	} else {
		w.Header().Set("Content-Type", "image/png")
		w.Write(img)
	}
}

func uploadBrandImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if r.ContentLength > *utils.Cfg.FileSettings.MaxFileSize {
		c.Err = model.NewAppError("uploadBrandImage", "api.admin.upload_brand_image.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize); err != nil {
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

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.SaveBrandImage(imageArray[0]); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("")

	w.WriteHeader(http.StatusCreated)
	ReturnStatusOK(w)
}
