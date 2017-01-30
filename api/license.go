// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	EXPIRED_LICENSE_ERROR = "api.license.add_license.expired.app_error"
	INVALID_LICENSE_ERROR = "api.license.add_license.invalid.app_error"
)

func InitLicense() {
	l4g.Debug(utils.T("api.license.init.debug"))

	BaseRoutes.License.Handle("/add", ApiAdminSystemRequired(addLicense)).Methods("POST")
	BaseRoutes.License.Handle("/remove", ApiAdminSystemRequired(removeLicense)).Methods("POST")
	BaseRoutes.License.Handle("/client_config", ApiAppHandler(getClientLicenceConfig)).Methods("GET")
}

func LoadLicense() {
	licenseId := ""
	if result := <-app.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if len(licenseId) != 26 {
		l4g.Info(utils.T("mattermost.load_license.find.warn"))
		return
	}

	if result := <-app.Srv.Store.License().Get(licenseId); result.Err == nil {
		record := result.Data.(*model.LicenseRecord)
		utils.LoadLicense([]byte(record.Bytes))
	} else {
		l4g.Info(utils.T("mattermost.load_license.find.warn"))
	}
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

	if license, err := SaveLicense(buf.Bytes()); err != nil {
		if err.Id == EXPIRED_LICENSE_ERROR {
			c.LogAudit("failed - expired or non-started license")
		} else if err.Id == INVALID_LICENSE_ERROR {
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

func SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	var license *model.License

	if success, licenseStr := utils.ValidateLicense(licenseBytes); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if result := <-app.Srv.Store.User().AnalyticsUniqueUserCount(""); result.Err != nil {
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, result.Err.Error())
		} else {
			uniqueUserCount := result.Data.(int64)

			if uniqueUserCount > int64(*license.Features.Users) {
				return nil, model.NewLocAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "")
			}
		}

		if ok := utils.SetLicense(license); !ok {
			return nil, model.NewLocAppError("addLicense", EXPIRED_LICENSE_ERROR, nil, "")
		}

		record := &model.LicenseRecord{}
		record.Id = license.Id
		record.Bytes = string(licenseBytes)
		rchan := app.Srv.Store.License().Save(record)

		sysVar := &model.System{}
		sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
		sysVar.Value = license.Id
		schan := app.Srv.Store.System().SaveOrUpdate(sysVar)

		if result := <-rchan; result.Err != nil {
			RemoveLicense()
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.save.app_error", nil, "err="+result.Err.Error())
		}

		if result := <-schan; result.Err != nil {
			RemoveLicense()
			return nil, model.NewLocAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "")
		}
	} else {
		return nil, model.NewLocAppError("addLicense", INVALID_LICENSE_ERROR, nil, "")
	}

	return license, nil
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")

	if err := RemoveLicense(); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func RemoveLicense() *model.AppError {
	utils.RemoveLicense()

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if result := <-app.Srv.Store.System().SaveOrUpdate(sysVar); result.Err != nil {
		utils.RemoveLicense()
		return result.Err
	}

	return nil
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
