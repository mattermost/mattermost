// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/filesstore"
	"github.com/mattermost/mattermost-server/utils"
)

const REDIRECT_LOCATION_CACHE_SIZE = 10000

var redirectLocationDataCache = utils.NewLru(REDIRECT_LOCATION_CACHE_SIZE)

func (api *API) InitSystem() {
	api.BaseRoutes.System.Handle("/ping", api.ApiHandler(getSystemPing)).Methods("GET")

	api.BaseRoutes.System.Handle("/timezones", api.ApiSessionRequired(getSupportedTimezones)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/audits", api.ApiSessionRequired(getAudits)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/email/test", api.ApiSessionRequired(testEmail)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/file/s3_test", api.ApiSessionRequired(testS3)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/database/recycle", api.ApiSessionRequired(databaseRecycle)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/caches/invalidate", api.ApiSessionRequired(invalidateCaches)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiSessionRequired(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiHandler(postLog)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/analytics/old", api.ApiSessionRequired(getAnalytics)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/redirect_location", api.ApiSessionRequiredTrustRequester(getRedirectLocation)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/notifications/ack", api.ApiSessionRequired(pushNotificationAck)).Methods("POST")
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

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testEmail", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	err := c.App.TestEmail(c.App.Session.UserId, cfg)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("databaseRecycle", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	c.App.RecycleDatabaseConnection()

	ReturnStatusOK(w)
}

func invalidateCaches(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("invalidateCaches", "api.restricted_system_admin", nil, "", http.StatusForbidden)
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
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
		if c.App.Session.UserId == "" {
			c.Err = model.NewAppError("postLog", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			return
		}

		if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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

func getAnalytics(c *Context, w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	teamId := r.URL.Query().Get("team_id")

	if name == "" {
		name = "standard"
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
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
	supportedTimezones := c.App.Timezones.GetSupported()
	if supportedTimezones == nil {
		supportedTimezones = make([]string, 0)
	}

	b, err := json.Marshal(supportedTimezones)
	if err != nil {
		c.Log.Warn("Unable to marshal JSON in timezones.", mlog.Err(err))
		w.WriteHeader(http.StatusInternalServerError)
	}

	w.Write(b)
}

func testS3(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := model.ConfigFromJson(r.Body)
	if cfg == nil {
		cfg = c.App.Config()
	}

	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testS3", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	err := filesstore.CheckMandatoryS3Fields(&cfg.FileSettings)
	if err != nil {
		c.Err = err
		return
	}

	if *cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
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

	if !*c.App.Config().ServiceSettings.EnableLinkPreviews {
		w.Write([]byte(model.MapToJson(m)))
		return
	}

	url := r.URL.Query().Get("url")
	if len(url) == 0 {
		c.SetInvalidParam("url")
		return
	}

	if location, ok := redirectLocationDataCache.Get(url); ok {
		m["location"] = location.(string)
		w.Write([]byte(model.MapToJson(m)))
		return
	}

	client := c.App.HTTPService.MakeClient(false)
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}

	res, err := client.Head(url)
	if err != nil {
		// Cache failures to prevent retries.
		redirectLocationDataCache.AddWithExpiresInSecs(url, "", 3600) // Expires after 1 hour
		// Always return a success status and a JSON string to limit information returned to client.
		w.Write([]byte(model.MapToJson(m)))
		return
	}

	location := res.Header.Get("Location")
	redirectLocationDataCache.AddWithExpiresInSecs(url, location, 3600) // Expires after 1 hour
	m["location"] = location

	w.Write([]byte(model.MapToJson(m)))
	return
}

func pushNotificationAck(c *Context, w http.ResponseWriter, r *http.Request) {
	ack := model.PushNotificationAckFromJson(r.Body)

	if !*c.App.Config().EmailSettings.SendPushNotifications {
		c.Err = model.NewAppError("pushNotificationAck", "api.push_notification.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	err := c.App.SendAckToPushProxy(ack)
	if err != nil {
		c.Err = model.NewAppError("pushNotificationAck", "api.push_notifications_ack.forward.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
	return
}
