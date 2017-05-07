// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitLicense() {
	l4g.Debug(utils.T("api.license.init.debug"))

	BaseRoutes.License.Handle("/add", ApiAdminSystemRequired(addLicense)).Methods("POST")
	BaseRoutes.License.Handle("/remove", ApiAdminSystemRequired(removeLicense)).Methods("POST")
	BaseRoutes.License.Handle("/client_config", ApiAppHandler(getClientLicenceConfig)).Methods("GET")
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")
	err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewLocAppError("addLicense", "api.license.add_license.no_file.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewLocAppError("addLicense", "api.license.add_license.array.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	fileData := fileArray[0]

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewLocAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error())
		return
	}

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	if license, err := app.SaveLicense(buf.Bytes()); err != nil {
		if err.Id == model.EXPIRED_LICENSE_ERROR {
			c.LogAudit("failed - expired or non-started license")
		} else if err.Id == model.INVALID_LICENSE_ERROR {
			c.LogAudit("failed - invalid license")
		} else {
			c.LogAudit("failed - unable to save license")
		}
		c.Err = err
		return
	} else {
		c.LogAudit("success")
		w.Write([]byte(license.ToJson()))
	}
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")

	if err := app.RemoveLicense(); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func getClientLicenceConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	useSanitizedLicense := !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM)

	etag := utils.GetClientLicenseEtag(useSanitizedLicense)
	if HandleEtag(etag, "Get Client License Config", w, r) {
		return
	}

	var clientLicense map[string]string

	if useSanitizedLicense {
		clientLicense = utils.ClientLicense
	} else {
		clientLicense = utils.GetSanitizedClientLicense()
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(model.MapToJson(clientLicense)))
}
