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

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (ch *Channels) ServePluginRequest(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	pluginID := params["plugin_id"]

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		appErr := model.NewAppError("ServePluginRequest", "app.plugin.disabled.app_error", nil, "Enable plugins to serve plugin requests", http.StatusNotImplemented)
		mlog.Error(appErr.Error())
		w.WriteHeader(appErr.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write([]byte(appErr.ToJSON())); err != nil {
			mlog.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	hooks, err := pluginsEnvironment.HooksForPlugin(pluginID)
	if err != nil {
		mlog.Debug("Access to route for non-existent plugin",
			mlog.String("missing_plugin_id", pluginID),
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
		appErr := model.NewAppError("ServeInterPluginRequest", "app.plugin.disabled.app_error", nil, "Plugin environment not found.", http.StatusNotImplemented)
		a.Log().Error(appErr.Error())
		w.WriteHeader(appErr.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write([]byte(appErr.ToJSON())); err != nil {
			mlog.Warn("Error while writing response", mlog.Err(err))
		}
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

	// Should be in the form of /(subpath/)?/plugins/{plugin_id}/public/* by the time we get here
	vars := mux.Vars(r)
	pluginID := vars["plugin_id"]

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

	subpath, err := utils.GetSubpathFromConfig(ch.cfgSvc.Config())
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}

	publicFilePath := path.Clean(r.URL.Path)
	prefix := path.Join(subpath, "plugins", pluginID, "public")
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

	// If MFA is required and user has not activated it, we wipe the token.
	app := New(ServerConnector(ch))
	rctx := request.EmptyContext(ch.srv.Log()).WithPath(r.URL.Path)

	// The appErr is later used at L176 and L226.
	session, appErr := app.GetSession(token)
	if session != nil {
		rctx = rctx.WithSession(session)
	}

	if mfaAppErr := app.MFARequired(rctx); mfaAppErr != nil {
		pluginID := mux.Vars(r)["plugin_id"]
		ch.srv.Log().Warn("Treating session as unauthenticated since MFA required",
			mlog.String("plugin_id", pluginID),
			mlog.String("url", r.URL.Path),
			mlog.Err(mfaAppErr),
		)
		token = ""
	}

	// Mattermost-Plugin-ID can only be set by inter-plugin requests
	r.Header.Del("Mattermost-Plugin-ID")

	r.Header.Del("Mattermost-User-Id")
	if token != "" {
		csrfCheckPassed := false
		if (session != nil && session.Id != "") && appErr == nil && cookieAuth && r.Method != "GET" {
			sentToken := ""

			if r.Header.Get(model.HeaderCsrfToken) == "" {
				bodyBytes, _ := io.ReadAll(r.Body)
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				if err := r.ParseForm(); err != nil {
					mlog.Warn("Failed to parse form data for plugin request", mlog.Err(err))
				}
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

		if (session != nil && session.Id != "") && appErr == nil && csrfCheckPassed {
			r.Header.Set("Mattermost-User-Id", session.UserId)
			context.SessionId = session.Id

			r.Header.Del(model.HeaderAuth)
		}
	}

	cookies := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cookies {
		if c.Name != model.SessionCookieToken {
			r.AddCookie(c)
		}
	}
	r.Header.Del("Referer")

	params := mux.Vars(r)

	subpath, _ := utils.GetSubpathFromConfig(ch.cfgSvc.Config())

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()
	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", params["plugin_id"]))

	handler(context, w, r)
}
