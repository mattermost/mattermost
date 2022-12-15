// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (ch *Channels) ServePluginRequest(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	if handler, ok := ch.routerSvc.getHandler(params["plugin_id"]); ok {
		ch.servePluginRequest(w, r, func(*plugin.Context, http.ResponseWriter, *http.Request) {
			handler.ServeHTTP(w, r)
		})
		return
	}

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		err := model.NewAppError("ServePluginRequest", "app.plugin.disabled.app_error", nil, "Enable plugins to serve plugin requests", http.StatusNotImplemented)
		mlog.Error(err.Error())
		w.WriteHeader(err.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(err.ToJSON()))
		return
	}

	hooks, err := pluginsEnvironment.HooksForPlugin(params["plugin_id"])
	if err != nil {
		mlog.Debug("Access to route for non-existent plugin",
			mlog.String("missing_plugin_id", params["plugin_id"]),
			mlog.String("url", r.URL.String()),
			mlog.Err(err))
		http.NotFound(w, r)
		return
	}

	ch.servePluginRequest(w, r, hooks.ServeHTTP)
}

func (a *App) ServeInterPluginRequest(w http.ResponseWriter, r *http.Request, sourcePluginId, destinationPluginId string) {
	pluginsEnvironment := a.ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		err := model.NewAppError("ServeInterPluginRequest", "app.plugin.disabled.app_error", nil, "Plugin environment not found.", http.StatusNotImplemented)
		a.Log().Error(err.Error())
		w.WriteHeader(err.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(err.ToJSON()))
		return
	}

	hooks, err := pluginsEnvironment.HooksForPlugin(destinationPluginId)
	if err != nil {
		a.Log().Error("Access to route for non-existent plugin in inter plugin request",
			mlog.String("source_plugin_id", sourcePluginId),
			mlog.String("destination_plugin_id", destinationPluginId),
			mlog.String("url", r.URL.String()),
			mlog.Err(err),
		)
		http.NotFound(w, r)
		return
	}

	context := &plugin.Context{
		RequestId: model.NewId(),
		UserAgent: r.UserAgent(),
	}

	r.Header.Set("Mattermost-Plugin-ID", sourcePluginId)

	hooks.ServeHTTP(context, w, r)
}

// ServePluginPublicRequest serves public plugin files
// at the URL http(s)://$SITE_URL/plugins/$PLUGIN_ID/public/{anything}
func (ch *Channels) ServePluginPublicRequest(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/") {
		http.NotFound(w, r)
		return
	}

	vars := mux.Vars(r)
	pluginID := vars["plugin_id"]

	// Should be in the form of /(subpath/)?/plugins/{plugin_id}/public/* by the time
	// we get here. Trim everything up to the /public/*.
	subpath, _ := utils.GetSubpathFromConfig(ch.cfgSvc.Config())
	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", pluginID))

	pluginsEnv := ch.GetPluginsEnvironment()

	// Check if someone has nullified the pluginsEnv in the meantime
	if pluginsEnv == nil {
		http.NotFound(w, r)
		return
	}

	publicFilesPath, err := pluginsEnv.PublicFilesPath(pluginID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	publicFilePath := path.Clean(r.URL.Path)
	prefix := "/public/"
	if !strings.HasPrefix(publicFilePath, prefix) {
		http.NotFound(w, r)
		return
	}
	publicFile := filepath.Join(publicFilesPath, strings.TrimPrefix(publicFilePath, prefix))
	http.ServeFile(w, r, publicFile)
}

func (ch *Channels) servePluginRequest(w http.ResponseWriter, r *http.Request, handler func(*plugin.Context, http.ResponseWriter, *http.Request)) {
	token := ""
	context := &plugin.Context{
		RequestId:      model.NewId(),
		IPAddress:      utils.GetIPAddress(r, ch.cfgSvc.Config().ServiceSettings.TrustedProxyIPHeader),
		AcceptLanguage: r.Header.Get("Accept-Language"),
		UserAgent:      r.UserAgent(),
	}
	cookieAuth := false

	authHeader := r.Header.Get(model.HeaderAuth)
	if strings.HasPrefix(strings.ToUpper(authHeader), model.HeaderBearer+" ") {
		token = authHeader[len(model.HeaderBearer)+1:]
	} else if strings.HasPrefix(strings.ToLower(authHeader), model.HeaderToken+" ") {
		token = authHeader[len(model.HeaderToken)+1:]
	} else if cookie, _ := r.Cookie(model.SessionCookieToken); cookie != nil {
		token = cookie.Value
		cookieAuth = true
	} else {
		token = r.URL.Query().Get("access_token")
	}

	// Mattermost-Plugin-ID can only be set by inter-plugin requests
	r.Header.Del("Mattermost-Plugin-ID")

	r.Header.Del("Mattermost-User-Id")
	if token != "" {
		session, err := New(ServerConnector(ch)).GetSession(token)
		defer ch.srv.platform.ReturnSessionToPool(session)

		csrfCheckPassed := false

		if session != nil && err == nil && cookieAuth && r.Method != "GET" {
			sentToken := ""

			if r.Header.Get(model.HeaderCsrfToken) == "" {
				bodyBytes, _ := io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				r.ParseForm()
				sentToken = r.FormValue("csrf")
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			} else {
				sentToken = r.Header.Get(model.HeaderCsrfToken)
			}

			expectedToken := session.GetCSRF()

			if sentToken == expectedToken {
				csrfCheckPassed = true
			}

			// ToDo(DSchalla) 2019/01/04: Remove after deprecation period and only allow CSRF Header (MM-13657)
			if r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML && !csrfCheckPassed {
				csrfErrorMessage := "CSRF Check failed for request - Please migrate your plugin to either send a CSRF Header or Form Field, XMLHttpRequest is deprecated"
				sid := ""
				userID := ""

				if session.Id != "" {
					sid = session.Id
					userID = session.UserId
				}

				fields := []mlog.Field{
					mlog.String("path", r.URL.Path),
					mlog.String("ip", r.RemoteAddr),
					mlog.String("session_id", sid),
					mlog.String("user_id", userID),
				}

				if *ch.cfgSvc.Config().ServiceSettings.ExperimentalStrictCSRFEnforcement {
					mlog.Warn(csrfErrorMessage, fields...)
				} else {
					mlog.Debug(csrfErrorMessage, fields...)
					csrfCheckPassed = true
				}
			}
		} else {
			csrfCheckPassed = true
		}

		if (session != nil && session.Id != "") && err == nil && csrfCheckPassed {
			r.Header.Set("Mattermost-User-Id", session.UserId)
			context.SessionId = session.Id
		}
	}

	cookies := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cookies {
		if c.Name != model.SessionCookieToken {
			r.AddCookie(c)
		}
	}
	r.Header.Del(model.HeaderAuth)
	r.Header.Del("Referer")

	params := mux.Vars(r)

	subpath, _ := utils.GetSubpathFromConfig(ch.cfgSvc.Config())

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()
	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", params["plugin_id"]))

	handler(context, w, r)
}
