// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
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

	BaseRoutes.ApiRoot.Handle("/license/client", ApiHandler(getClientLicense)).Methods("GET")

	BaseRoutes.ApiRoot.Handle("/audits", ApiSessionRequired(getAudits)).Methods("GET")
	BaseRoutes.ApiRoot.Handle("/email/test", ApiSessionRequired(testEmail)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/database/recycle", ApiSessionRequired(databaseRecycle)).Methods("POST")
	BaseRoutes.ApiRoot.Handle("/caches/invalidate", ApiSessionRequired(invalidateCaches)).Methods("POST")

	BaseRoutes.ApiRoot.Handle("/logs", ApiSessionRequired(getLogs)).Methods("GET")
	BaseRoutes.ApiRoot.Handle("/logs", ApiSessionRequired(postLog)).Methods("POST")
}

func getSystemPing(c *Context, w http.ResponseWriter, r *http.Request) {
	ReturnStatusOK(w)
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {

	if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := app.TestEmail(c.Session.UserId, utils.Cfg)
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

	err := app.SaveConfig(cfg)
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
