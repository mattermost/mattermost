// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/cache/lru"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
)

const (
	REDIRECT_LOCATION_CACHE_SIZE = 10000
	DEFAULT_SERVER_BUSY_SECONDS  = 3600
	MAX_SERVER_BUSY_SECONDS      = 86400
)

var redirectLocationDataCache = lru.New(REDIRECT_LOCATION_CACHE_SIZE)

func (api *API) InitSystem() {
	api.BaseRoutes.System.Handle("/ping", api.ApiHandler(getSystemPing)).Methods("GET")

	api.BaseRoutes.System.Handle("/timezones", api.ApiSessionRequired(getSupportedTimezones)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/audits", api.ApiSessionRequired(getAudits)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/email/test", api.ApiSessionRequired(testEmail)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/site_url/test", api.ApiSessionRequired(testSiteURL)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/file/s3_test", api.ApiSessionRequired(testS3)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/database/recycle", api.ApiSessionRequired(databaseRecycle)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/caches/invalidate", api.ApiSessionRequired(invalidateCaches)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiSessionRequired(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiHandler(postLog)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/analytics/old", api.ApiSessionRequired(getAnalytics)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/redirect_location", api.ApiSessionRequiredTrustRequester(getRedirectLocation)).Methods("GET")

	api.BaseRoutes.ApiRoot.Handle("/notifications/ack", api.ApiSessionRequired(pushNotificationAck)).Methods("POST")

	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiSessionRequired(setServerBusy)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiSessionRequired(getServerBusyExpires)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiSessionRequired(clearServerBusy)).Methods("DELETE")
}

func getSystemPing(c *Context, w http.ResponseWriter, r *http.Request) {
	reqs := c.App.Config().ClientRequirements

	s := make(map[string]string)
	s[model.STATUS] = model.STATUS_OK
	s["AndroidLatestVersion"] = reqs.AndroidLatestVersion
	s["AndroidMinVersion"] = reqs.AndroidMinVersion
	s["DesktopLatestVersion"] = reqs.DesktopLatestVersion
	s["DesktopMinVersion"] = reqs.DesktopMinVersion
	s["IosLatestVersion"] = reqs.IosLatestVersion
	s["IosMinVersion"] = reqs.IosMinVersion

	actualGoroutines := runtime.NumGoroutine()
	if *c.App.Config().ServiceSettings.GoroutineHealthThreshold > 0 && actualGoroutines >= *c.App.Config().ServiceSettings.GoroutineHealthThreshold {
		mlog.Warn("The number of running goroutines is over the health threshold", mlog.Int("goroutines", actualGoroutines), mlog.Int("health_threshold", *c.App.Config().ServiceSettings.GoroutineHealthThreshold))
		s[model.STATUS] = model.STATUS_UNHEALTHY
	}

	// Enhanced ping health check:
	// If an extra form value is provided then perform extra health checks for
	// database and file storage backends.
	if r.FormValue("get_server_status") != "" {
		dbStatusKey := "database_status"
		s[dbStatusKey] = model.STATUS_OK

		// Database Write/Read Check
		currentTime := fmt.Sprintf("%d", time.Now().Unix())
		healthCheckKey := "health_check"

		writeErr := c.App.Srv.Store.System().SaveOrUpdate(&model.System{
			Name:  healthCheckKey,
			Value: currentTime,
		})
		if writeErr != nil {
			mlog.Debug("Unable to write to database.", mlog.Err(writeErr))
			s[dbStatusKey] = model.STATUS_UNHEALTHY
			s[model.STATUS] = model.STATUS_UNHEALTHY
		} else {
			healthCheck, readErr := c.App.Srv.Store.System().GetByName(healthCheckKey)
			if readErr != nil {
				mlog.Debug("Unable to read from database.", mlog.Err(readErr))
				s[dbStatusKey] = model.STATUS_UNHEALTHY
				s[model.STATUS] = model.STATUS_UNHEALTHY
			} else if healthCheck.Value != currentTime {
				mlog.Debug("Incorrect healthcheck value", mlog.String("expected", currentTime), mlog.String("got", healthCheck.Value))
				s[dbStatusKey] = model.STATUS_UNHEALTHY
				s[model.STATUS] = model.STATUS_UNHEALTHY
			} else {
				mlog.Debug("Able to write/read files to database")
			}
		}

		filestoreStatusKey := "filestore_status"
		s[filestoreStatusKey] = model.STATUS_OK
		license := c.App.License()
		backend, appErr := filesstore.NewFileBackend(&c.App.Config().FileSettings, license != nil && *license.Features.Compliance)
		if appErr == nil {
			appErr = backend.TestConnection()
			if appErr != nil {
				s[filestoreStatusKey] = model.STATUS_UNHEALTHY
				s[model.STATUS] = model.STATUS_UNHEALTHY
			}
		} else {
			mlog.Debug("Unable to get filestore for ping status.", mlog.Err(appErr))
			s[filestoreStatusKey] = model.STATUS_UNHEALTHY
			s[model.STATUS] = model.STATUS_UNHEALTHY
		}

		w.Header().Set(model.STATUS, s[model.STATUS])
		w.Header().Set(dbStatusKey, s[dbStatusKey])
		w.Header().Set(filestoreStatusKey, s[filestoreStatusKey])
	}

	if s[model.STATUS] != model.STATUS_OK {
		w.WriteHeader(http.StatusInternalServerError)
	}
	w.Write([]byte(model.MapToJson(s)))
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

func testSiteURL(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if *c.App.Config().ExperimentalSettings.RestrictSystemAdmin {
		c.Err = model.NewAppError("testSiteURL", "api.restricted_system_admin", nil, "", http.StatusForbidden)
		return
	}

	props := model.MapFromJson(r.Body)
	siteURL := props["site_url"]
	if siteURL == "" {
		c.SetInvalidParam("site_url")
		return
	}
	err := c.App.TestSiteURL(siteURL)
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

	msg = "Client Logs API Endpoint Message: " + msg
	fields := []mlog.Field{
		mlog.String("type", "client_message"),
		mlog.String("user_agent", c.App.UserAgent),
	}

	if !forceToDebug && lvl == "ERROR" {
		mlog.Error(msg, fields...)
	} else {
		mlog.Debug(msg, fields...)
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
}

func pushNotificationAck(c *Context, w http.ResponseWriter, r *http.Request) {
	ack := model.PushNotificationAckFromJson(r.Body)

	if !*c.App.Config().EmailSettings.SendPushNotifications {
		c.Err = model.NewAppError("pushNotificationAck", "api.push_notification.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	err := c.App.SendAckToPushProxy(ack)
	if ack.IsIdLoaded {
		if err != nil {
			// Log the error only, then continue to fetch notification message
			c.App.NotificationsLog.Error("Notification ack not sent to push proxy",
				mlog.String("ackId", ack.Id),
				mlog.String("type", ack.NotificationType),
				mlog.String("postId", ack.PostId),
				mlog.String("status", err.Error()),
			)
		}

		notificationInterface := c.App.Notification

		if notificationInterface == nil {
			c.Err = model.NewAppError("pushNotificationAck", "api.system.id_loaded.not_available.app_error", nil, "", http.StatusFound)
			return
		}

		msg, appError := notificationInterface.GetNotificationMessage(ack, c.App.Session.UserId)
		if appError != nil {
			c.Err = model.NewAppError("pushNotificationAck", "api.push_notification.id_loaded.fetch.app_error", nil, appError.Error(), http.StatusInternalServerError)
			return
		}

		w.Write([]byte(msg.ToJson()))

		return
	} else if err != nil {
		c.Err = model.NewAppError("pushNotificationAck", "api.push_notifications_ack.forward.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
}

func setServerBusy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	// number of seconds to keep server marked busy
	secs := r.URL.Query().Get("seconds")
	if secs == "" {
		secs = strconv.FormatInt(DEFAULT_SERVER_BUSY_SECONDS, 10)
	}

	i, err := strconv.ParseInt(secs, 10, 64)
	if err != nil || i <= 0 || i > MAX_SERVER_BUSY_SECONDS {
		c.SetInvalidUrlParam(fmt.Sprintf("seconds must be 1 - %d", MAX_SERVER_BUSY_SECONDS))
		return
	}

	c.App.Srv.Busy.Set(time.Second * time.Duration(i))
	mlog.Warn("server busy state activated - non-critical services disabled", mlog.Int64("seconds", i))
	ReturnStatusOK(w)
}

func clearServerBusy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}
	c.App.Srv.Busy.Clear()
	mlog.Info("server busy state cleared - non-critical services enabled")
	ReturnStatusOK(w)
}

func getServerBusyExpires(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(c.App.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}
	w.Write([]byte(c.App.Srv.Busy.ToJson()))
}
