// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"runtime"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/filesstore"
)

func (api *API) InitSystem() {
	api.BaseRoutes.System.Handle("/ping", api.ApiHandler(getSystemPing)).Methods("GET")

	api.BaseRoutes.System.Handle("/timezones", api.ApiSessionRequired(getSupportedTimezones)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(getConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiSessionRequired(updateConfig)).Methods("PUT")
	api.BaseRoutes.ApiRoot.Handle("/config/reload", api.ApiSessionRequired(configReload)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/config/client", api.ApiHandler(getClientConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config/environment", api.ApiSessionRequired(getEnvironmentConfig)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/license", api.ApiSessionRequired(addLicense)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/license", api.ApiSessionRequired(removeLicense)).Methods("DELETE")
	api.BaseRoutes.ApiRoot.Handle("/license/client", api.ApiHandler(getClientLicense)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/audits", api.ApiSessionRequired(getAudits)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/email/test", api.ApiSessionRequired(testEmail)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/file/s3_test", api.ApiSessionRequired(testS3)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/database/recycle", api.ApiSessionRequired(databaseRecycle)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/caches/invalidate", api.ApiSessionRequired(invalidateCaches)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiSessionRequired(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiHandler(postLog)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/analytics/old", api.ApiSessionRequired(getAnalytics)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/redirect_location", api.ApiSessionRequiredTrustRequester(getRedirectLocation)).Methods("GET")
}

func getSystemPing(c *Context, w http.ResponseWriter, r *http.Request) {

	actualGoroutines := runtime.NumGoroutine()
	if *c.App.Config().ServiceSettings.GoroutineHealthThreshold <= 0 || actualGoroutines <= *c.App.Config().ServiceSettings.GoroutineHealthThreshold {
		m := make(map[string]string)
		m[model.STATUS] = model.STATUS_OK

		reqs := c.App.Config().ClientRequirements
		m["AndroidLatestVersion"] = reqs.AndroidLatestVersion
		m["AndroidMinVersion"] = reqs.AndroidMinVersion
		m["DesktopLatestVersion"] = reqs.DesktopLatestVersion
		m["DesktopMinVersion"] = reqs.DesktopMinVersion
		m["IosLatestVersion"] = reqs.IosLatestVersion
		m["IosMinVersion"] = reqs.IosMinVersion

		w.Write([]byte(model.MapToJson(m)))
	} else {
		rdata := map[string]string{}
		rdata["status"] = "unhealthy"

		mlog.Warn(fmt.Sprintf("The number of running goroutines is over the health threshold %v of %v", actualGoroutines, *c.App.Config().ServiceSettings.GoroutineHealthThreshold))

		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(model.MapToJson(rdata)))
	}
}

func testEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		cfg = c.App.Config()
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.TestEmail(c.Session.UserId, cfg)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	cfg := c.App.GetConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func configReload(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	c.App.ReloadConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func updateConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		c.SetInvalidParam("config")
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	// Do not allow plugin uploads to be toggled through the API
	cfg.PluginSettings.EnableUploads = c.App.GetConfig().PluginSettings.EnableUploads

	err := c.App.SaveConfig(cfg, true)
	if err != nil {
		c.Err = err
		return
	}

	c.LogAudit("updateConfig")

	cfg = c.App.GetConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(cfg.ToJson()))
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	audits, err := c.App.GetAuditsPage("", c.Params.Page, c.Params.PerPage)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(audits.ToJson()))
}

func databaseRecycle(c *Context, w http.ResponseWriter, r *http.Request) {

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	c.App.RecycleDatabaseConnection()

	ReturnStatusOK(w)
}

func invalidateCaches(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.InvalidateAllCaches()
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ReturnStatusOK(w)
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	lines, err := c.App.GetLogs(c.Params.Page, c.Params.LogsPerPage)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func postLog(c *Context, w http.ResponseWriter, r *http.Request) {
	forceToDebug := false

	if !*c.App.Config().ServiceSettings.EnableDeveloper {
		if c.Session.UserId == "" {
			c.Err = model.NewAppError("postLog", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			return
		}

		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			forceToDebug = true
		}
	}

	m := model.MapFromJson(r.Body)
	lvl := m["level"]
	msg := m["message"]

	if len(msg) > 400 {
		msg = msg[0:399]
	}

	if !forceToDebug && lvl == "ERROR" {
		err := &model.AppError{}
		err.Message = msg
		err.Id = msg
		err.Where = "client"
		c.LogError(err)
	} else {
		mlog.Debug(fmt.Sprint(msg))
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

	var config map[string]string
	if *c.App.Config().ServiceSettings.ExperimentalLimitClientConfig && len(c.Session.UserId) == 0 {
		config = c.App.LimitedClientConfigWithComputed()
	} else {
		config = c.App.ClientConfigWithComputed()
	}

	w.Write([]byte(model.MapToJson(config)))
}

func getEnvironmentConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	envConfig := c.App.GetEnvironmentConfig()

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(model.StringInterfaceToJson(envConfig)))
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

	etag := c.App.GetClientLicenseEtag(true)
	if c.HandleEtag(etag, "Get Client License", w, r) {
		return
	}

	var clientLicense map[string]string

	if c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		clientLicense = c.App.ClientLicense()
	} else {
		clientLicense = c.App.GetSanitizedClientLicense()
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(model.MapToJson(clientLicense)))
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize)
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
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	license, appErr := c.App.SaveLicense(buf.Bytes())
	if appErr != nil {
		if appErr.Id == model.EXPIRED_LICENSE_ERROR {
			c.LogAudit("failed - expired or non-started license")
		} else if appErr.Id == model.INVALID_LICENSE_ERROR {
			c.LogAudit("failed - invalid license")
		} else {
			c.LogAudit("failed - unable to save license")
		}
		c.Err = appErr
		return
	}

	c.LogAudit("success")
	w.Write([]byte(license.ToJson()))
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.RemoveLicense(); err != nil {
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

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	rows, err := c.App.GetAnalytics(name, teamId)
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

func getSupportedTimezones(c *Context, w http.ResponseWriter, r *http.Request) {
	supportedTimezones := c.App.Timezones()

	if supportedTimezones != nil {
		w.Write([]byte(model.TimezonesToJson(supportedTimezones)))
		return
	}

	emptyTimezones := make([]string, 0)
	w.Write([]byte(model.TimezonesToJson(emptyTimezones)))
}

func testS3(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		cfg = c.App.Config()
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := filesstore.CheckMandatoryS3Fields(&cfg.FileSettings)
	if err != nil {
		c.Err = err
		return
	}

	if cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		cfg.FileSettings.AmazonS3SecretAccessKey = c.App.Config().FileSettings.AmazonS3SecretAccessKey
	}

	license := c.App.License()
	backend, appErr := filesstore.NewFileBackend(&cfg.FileSettings, license != nil && *license.Features.Compliance)
	if appErr == nil {
		appErr = backend.TestConnection()
	}
	if appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func getRedirectLocation(c *Context, w http.ResponseWriter, r *http.Request) {
	m := make(map[string]string)
	m["location"] = ""
	cfg := c.App.GetConfig()
	if !*cfg.ServiceSettings.EnableLinkPreviews {
		w.Write([]byte(model.MapToJson(m)))
		return
	}
	url := r.URL.Query().Get("url")
	if len(url) == 0 {
		c.SetInvalidParam("url")
		return
	}

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	res, err := client.Head(url)
	if err != nil {
		// Always return a success status and a JSON string to limit the amount of information returned to a
		// hacker attempting to use Mattermost to probe a private network.
		w.Write([]byte(model.MapToJson(m)))
		return
	}

	m["location"] = res.Header.Get("Location")

	w.Write([]byte(model.MapToJson(m)))
	return
}
