// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitBotProxy() {
	api.BaseRoutes.BotService.Handle("/attendance/report", api.APISessionRequired(proxyBotAttendanceReport)).Methods(http.MethodGet)
	api.BaseRoutes.BotService.Handle("/attendance/stats", api.APISessionRequired(proxyBotAttendanceStats)).Methods(http.MethodGet)
}

func proxyBotAttendanceReport(c *Context, w http.ResponseWriter, r *http.Request) {
	botServiceURL := os.Getenv("BOT_URL")
	if botServiceURL == "" {
		c.Err = model.NewAppError("proxyBotAttendanceReport", "api.bot_proxy.bot_service_url_not_configured.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	targetURL := strings.TrimRight(botServiceURL, "/") + "/api/attendance/report"
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	client := c.App.HTTPService().MakeClient(true)

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		c.Logger.Error("Failed to create proxy request", mlog.Err(err))
		c.Err = model.NewAppError("proxyBotAttendanceReport", "api.bot_proxy.proxy_request_failed.app_error", nil, "", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		c.Logger.Error("Failed to proxy request to bot service", mlog.Err(err))
		c.Err = model.NewAppError("proxyBotAttendanceReport", "api.bot_proxy.proxy_request_failed.app_error", nil, "", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		c.Logger.Warn("Error writing proxy response", mlog.Err(err))
	}
}

func proxyBotAttendanceStats(c *Context, w http.ResponseWriter, r *http.Request) {
	botServiceURL := os.Getenv("BOT_URL")
	if botServiceURL == "" {
		c.Err = model.NewAppError("proxyBotAttendanceStats", "api.bot_proxy.bot_service_url_not_configured.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	targetURL := strings.TrimRight(botServiceURL, "/") + "/api/attendance/stats"
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	client := c.App.HTTPService().MakeClient(true)

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		c.Logger.Error("Failed to create proxy request", mlog.Err(err))
		c.Err = model.NewAppError("proxyBotAttendanceStats", "api.bot_proxy.proxy_request_failed.app_error", nil, "", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		c.Logger.Error("Failed to proxy request to bot service", mlog.Err(err))
		c.Err = model.NewAppError("proxyBotAttendanceStats", "api.bot_proxy.proxy_request_failed.app_error", nil, "", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		c.Logger.Warn("Error writing proxy response", mlog.Err(err))
	}
}
