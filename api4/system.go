// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"io"
	"net/http"
	"runtime"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitSystem() {
	l4g.Debug(utils.T("api.system.init.debug"))

	BaseRoutes.System.Handle("/ping", ApiHandler(getSystemPing)).Methods("GET")

	BaseRoutes.ApiRoot.Handle("/config", ApiSessionRequired(getConfig)).Methods("GET")
	BaseRoutes.ApiRoot.Handle("/config", ApiSessionRequired(updateConfig)).Methods("PUT")
	BaseRoutes.ApiRoot.Handle("/config/reload", ApiSessionRequired(configReload)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/config/client", ApiHandler(getClientConfig)).Methods("GET")

	BaseRoutes.ApiRoot.Handle("/license", ApiSessionRequired(addLicense)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/license", ApiSessionRequired(removeLicense)).Methods("DELETE")
	BaseRoutes.ApiRoot.Handle("/license/client", ApiHandler(getClientLicense)).Methods("GET")

	BaseRoutes.ApiRoot.Handle("/audits", ApiSessionRequired(getAudits)).Methods("GET")
	BaseRoutes.ApiRoot.Handle("/email/test", ApiSessionRequired(testEmail)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/database/recycle", ApiSessionRequired(databaseRecycle)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/caches/invalidate", ApiSessionRequired(invalidateCaches)).Methods("POST")

	BaseRoutes.ApiRoot.Handle("/logs", ApiSessionRequired(getLogs)).Methods("GET")
	BaseRoutes.ApiRoot.Handle("/logs", ApiSessionRequired(postLog)).Methods("POST")

	BaseRoutes.ApiRoot.Handle("/analytics/old", ApiSessionRequired(getAnalytics)).Methods("GET")
}

func getSystemPing(c *Context, w http.ResponseWriter, r *http.Request) {

	actualGoroutines := runtime.NumGoroutine()
	if *utils.Cfg.ServiceSettings.GoroutineHealthThreshold <= 0 || actualGoroutines <= *utils.Cfg.ServiceSettings.GoroutineHealthThreshold {
		ReturnStatusOK(w)
	} else {
		rdata := map[string]string{}
		rdata["status"] = "unhealthy"

		l4g.Warn(utils.T("api.system.go_routines"), actualGoroutines, *utils.Cfg.ServiceSettings.GoroutineHealthThreshold)

		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(model.MapToJson(rdata)))
	}
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		cfg = utils.Cfg
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := app.TestEmail(c.Session.UserId, cfg)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	cfg := app.GetConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	app.ReloadConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func updateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := app.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("updateConfig")

	cfg = app.GetConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	audits, err := app.GetAuditsPage("", c.Params.Page, c.Params.PerPage)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(audits.ToJson()))
}

func databaseRecycle(c *Context, w http.ResponseWriter, r *http.Request) {

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	app.RecycleDatabaseConnection()

	ReturnStatusOK(w)
}

func invalidateCaches(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := app.InvalidateAllCaches()
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	lines, err := app.GetLogs(c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func postLog(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableDeveloper && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	m := model.MapFromJson(r.Body)
	lvl := m["level"]
	msg := m["message"]

	if len(msg) > 400 {
		msg = msg[0:399]
	}

	if lvl == "ERROR" {
		err := &model.AppError{}
		err.Message = msg
		err.Id = msg
		err.Where = "client"
		c.LogError(err)
	} else {
		l4g.Debug(msg)
	}

	m["message"] = msg
	w.Write([]byte(model.MapToJson(m)))
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientConfig", "api.config.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	respCfg := map[string]string{}
	for k, v := range utils.ClientCfg {
		respCfg[k] = v
	}

	respCfg["NoAccounts"] = strconv.FormatBool(app.IsFirstUserAccount())

	w.Write([]byte(model.MapToJson(respCfg)))
}

func getClientLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")

	if format == "" {
		c.Err = model.NewAppError("getClientLicense", "api.license.client.old_format.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if format != "old" {
		c.SetInvalidParam("format")
		return
	}

	etag := utils.GetClientLicenseEtag(true)
	if HandleEtag(etag, "Get Client License", w, r) {
		return
	}

	var clientLicense map[string]string

	if app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		clientLicense = utils.ClientLicense
	} else {
		clientLicense = utils.GetSanitizedClientLicense()
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(model.MapToJson(clientLicense)))
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := r.ParseMultipartForm(*utils.Cfg.FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileData := fileArray[0]

	file, err := fileData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error(), http.StatusBadRequest)
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
	c.LogAudit("attempt")

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := app.RemoveLicense(); err != nil {
		c.Err = err
		return
	}

	c.LogAudit("success")
	ReturnStatusOK(w)
}

func getAnalytics(c *Context, w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	teamId := r.URL.Query().Get("team_id")

	if name == "" {
		name = "standard"
	}

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	rows, err := app.GetAnalytics(name, teamId)
	if err != nil {
		c.Err = err
		return
	}

	if rows == nil {
		c.SetInvalidParam("name")
		return
	}

	w.Write([]byte(rows.ToJson()))
}
