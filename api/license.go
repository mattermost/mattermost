// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"net/http"
	"strings"
)

func InitLicense(r *mux.Router) {
	l4g.Debug(utils.T("api.license.init.debug"))

	sr := r.PathPrefix("/license").Subrouter()
	sr.Handle("/add", ApiAdminSystemRequired(addLicense)).Methods("POST")
	sr.Handle("/remove", ApiAdminSystemRequired(removeLicense)).Methods("POST")
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")
	err := r.ParseMultipartForm(model.MAX_FILE_SIZE)
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

	data := buf.Bytes()

	var license *model.License
	if success, licenseStr := utils.ValidateLicense(data); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if result := <-Srv.Store.User().AnalyticsUniqueUserCount(""); result.Err != nil {
			c.Err = model.NewLocAppError("addLicense", api.license.add_license.invalid_count.app_error, nil, result.Err.Error())
			return
		} else {
			uniqueUserCount := result.Data.(int64)

			if uniqueUserCount > int64(*license.Features.Users) {
				c.Err = model.NewAppError("addLicense", api.license.add_license.unique_users.app_error, map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount})
				return
			}
		}

		if ok := utils.SetLicense(license); !ok {
			c.LogAudit("failed - expired or non-started license")
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.expired.app_error", nil, "")
			return
		}

		if err := writeFileLocally(data, utils.LicenseLocation()); err != nil {
			c.LogAudit("failed - could not save license file")
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.save.app_error", nil, "path="+utils.LicenseLocation())
			utils.RemoveLicense()
			return
		}
	} else {
		c.LogAudit("failed - invalid license")
		c.Err = model.NewLocAppError("addLicense", "api.license.add_license.invalid.app_error", nil, "")
		return
	}

	c.LogAudit("success")
	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")

	if ok := utils.RemoveLicense(); !ok {
		c.LogAudit("failed - could not remove license file")
		c.Err = model.NewLocAppError("removeLicense", "api.license.remove_license.remove.app_error", nil, "")
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}
