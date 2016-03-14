// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
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
	sr.Handle("/client_config", ApiAppHandler(getClientLicenceConfig)).Methods("GET")
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
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, result.Err.Error())
			return
		} else {
			uniqueUserCount := result.Data.(int64)

			if uniqueUserCount > int64(*license.Features.Users) {
				c.Err = model.NewLocAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "")
				return
			}
		}

		if ok := utils.SetLicense(license); !ok {
			c.LogAudit("failed - expired or non-started license")
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.expired.app_error", nil, "")
			return
		}

		record := &model.LicenseRecord{}
		record.Id = license.Id
		record.Bytes = string(data)
		rchan := Srv.Store.License().Save(record)

		sysVar := &model.System{}
		sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
		sysVar.Value = license.Id
		schan := Srv.Store.System().SaveOrUpdate(sysVar)

		if result := <-rchan; result.Err != nil {
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.save.app_error", nil, "err="+result.Err.Error())
			utils.RemoveLicense()
			return
		}

		if result := <-schan; result.Err != nil {
			c.Err = model.NewLocAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "")
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

	utils.RemoveLicense()

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if result := <-Srv.Store.System().Update(sysVar); result.Err != nil {
		c.Err = model.NewLocAppError("removeLicense", "api.license.remove_license.update.app_error", nil, "")
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func getClientLicenceConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	config := utils.ClientLicense

	var etag string
	if config["IsLicensed"] == "false" {
		etag = model.Etag(config["IsLicensed"])
	} else {
		etag = model.Etag(config["IsLicensed"], config["IssuedAt"])
	}

	if HandleEtag(etag, w, r) {
		return
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, etag)

	w.Write([]byte(model.MapToJson(config)))
}
