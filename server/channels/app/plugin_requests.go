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

// ServeInternalPluginRequest handles internal requests to plugins from either core server or other plugins.
// This is used by the Plugin Bridge to route requests with proper authentication headers.
//
// Parameters:
//   - userID: User ID to set in the authentication header (empty string if no user context)
//   - w: HTTP response writer
//   - r: HTTP request (should have URL path set to the endpoint, NOT including plugin ID)
//   - sourcePluginID: ID of calling plugin (empty string if from core)
//   - targetPluginID: ID of target plugin to call
func (a *App) ServeInternalPluginRequest(userID string, w http.ResponseWriter, r *http.Request, sourcePluginID, targetPluginID string) {
	pluginsEnvironment := a.ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		appErr := model.NewAppError("ServeInternalPluginRequest", "app.plugin.disabled.app_error", nil, "Plugin environment not found.", http.StatusNotImplemented)
		a.Log().Error(appErr.Error())
		w.WriteHeader(appErr.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write([]byte(appErr.ToJSON())); err != nil {
			mlog.Warn("Error while writing response", mlog.Err(err))
		}
		return
	}

	hooks, err := pluginsEnvironment.HooksForPlugin(targetPluginID)
	if err != nil {
		a.Log().Error("Access to route for non-existent plugin in internal plugin request",
			mlog.String("source_plugin_id", sourcePluginID),
			mlog.String("target_plugin_id", targetPluginID),
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

	// Set authentication headers - these are trusted because this function is internal
	// and not exposed to external HTTP routes
	r.Header.Set("Mattermost-User-Id", userID)

	// Set plugin ID header to identify the caller
	// Use a special ID for core server calls to distinguish them from plugin-to-plugin calls
	if sourcePluginID != "" {
		r.Header.Set("Mattermost-Plugin-ID", sourcePluginID)
	} else {
		// Core server call - use special identifier
		r.Header.Set("Mattermost-Plugin-ID", "com.mattermost.server")
	}

	hooks.ServeHTTP(context, w, r)
}

// ServeInterPluginRequest handles inter-plugin HTTP requests.
// This function does not set user authentication headers, unlike ServeInternalPluginRequest.
func (a *App) ServeInterPluginRequest(w http.ResponseWriter, r *http.Request, sourcePluginId, destinationPluginId string) {
	// Call ServeInternalPluginRequest with empty userID since this function doesn't handle user authentication
	a.ServeInternalPluginRequest("", w, r, sourcePluginId, destinationPluginId)
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
		return
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
	handleInternalServerError := func(rctx request.CTX, logMsg string, err error) {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		rctx.Logger().Error(logMsg, mlog.Err(err))
	}

	context := &plugin.Context{
		RequestId:      model.NewId(),
		IPAddress:      utils.GetIPAddress(r, ch.cfgSvc.Config().ServiceSettings.TrustedProxyIPHeader),
		AcceptLanguage: r.Header.Get("Accept-Language"),
		UserAgent:      r.UserAgent(),
	}

	pluginID := mux.Vars(r)["plugin_id"]

	const headerBearerPrefix = model.HeaderBearer + " "
	const headerTokenPrefix = model.HeaderToken + " "

	var cookieAuth bool
	var token string
	authHeader := r.Header.Get(model.HeaderAuth)
	if strings.HasPrefix(strings.ToUpper(authHeader), headerBearerPrefix) {
		token = authHeader[len(headerBearerPrefix):]
	} else if strings.HasPrefix(strings.ToLower(authHeader), headerTokenPrefix) {
		token = authHeader[len(headerTokenPrefix):]
	} else if cookie, _ := r.Cookie(model.SessionCookieToken); cookie != nil {
		token = cookie.Value
		cookieAuth = true
	} else {
		token = r.URL.Query().Get("access_token")
	}

	// Mattermost-Plugin-ID can only be set by inter-plugin requests
	r.Header.Del("Mattermost-Plugin-ID")

	// Clean Mattermost-User-Id header. The server sets this header for authenticated requests
	r.Header.Del("Mattermost-User-Id")

	cookies := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cookies {
		if c.Name != model.SessionCookieToken {
			r.AddCookie(c)
		}
	}
	r.Header.Del("Referer")

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()

	app := New(ServerConnector(ch))
	rctx := request.EmptyContext(
		ch.srv.Log().With(
			mlog.String("plugin_id", pluginID),
			mlog.String("path", r.URL.Path),
			mlog.String("method", r.Method),
			mlog.String("request_id", context.RequestId),
			mlog.String("ip_addr", utils.GetIPAddress(r, app.Config().ServiceSettings.TrustedProxyIPHeader)),
		),
	).WithPath(r.URL.Path)

	subpath, err := utils.GetSubpathFromConfig(ch.cfgSvc.Config())
	if err != nil {
		handleInternalServerError(rctx, "Failed to get subpath for plugin request", err)
		return
	}
	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", pluginID))

	// Short path for un-authenticated requests
	if token == "" {
		handler(context, w, r)
		return
	}

	session, appErr := app.GetSession(token)
	if appErr != nil {
		if appErr.StatusCode == http.StatusInternalServerError {
			handleInternalServerError(rctx, "Internal server error while loading session", err)
			return
		}
		rctx.Logger().Debug("Token in plugin request is invalid. Treating request as unauthenticated",
			mlog.Err(appErr),
		)
		handler(context, w, r)
		return
	}

	// If we get to this point, the token resolved to a valid session, and we don't need to remit
	// the authorization header to the plugin at all. This also prevents the plugin from incorrectly
	// using the token if MFA or CSRF fail below.
	r.Header.Del(model.HeaderAuth)

	rctx = rctx.
		WithLogger(rctx.Logger().With(
			mlog.String("user_id", session.UserId),
		)).
		WithSession(session)

	// If MFA is required and user has not activated it, treat it as unauthenticated
	if appErr := app.MFARequired(rctx); appErr != nil {
		if appErr.StatusCode == http.StatusInternalServerError {
			handleInternalServerError(rctx, "Internal server error during MFA validation", err)
			return
		}
		rctx.Logger().Warn("Treating session as unauthenticated since MFA required",
			mlog.Err(appErr),
		)
		handler(context, w, r)
		return
	}

	if validateCSRFForPluginRequest(rctx, r, session, cookieAuth, *ch.cfgSvc.Config().ServiceSettings.ExperimentalStrictCSRFEnforcement) {
		r.Header.Set("Mattermost-User-Id", session.UserId)
		context.SessionId = session.Id
	} else {
		rctx.Logger().Debug("CSRF request failed. Treating the request as unauthenticated.")
	}

	handler(context, w, r)
}

// validateCSRFForPluginRequest validates CSRF token for plugin requests
func validateCSRFForPluginRequest(rctx request.CTX, r *http.Request, session *model.Session, cookieAuth bool, strictCSRFEnforcement bool) bool {
	// Skip CSRF check for non-cookie auth or GET requests
	if !cookieAuth || r.Method == http.MethodGet {
		return true
	}

	csrfTokenFromClient := r.Header.Get(model.HeaderCsrfToken)

	if csrfTokenFromClient == "" {
		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			rctx.Logger().Warn("Failed to read request body for plugin request", mlog.Err(err))
		}
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		if err := r.ParseForm(); err != nil {
			rctx.Logger().Warn("Failed to parse form data for plugin request", mlog.Err(err))
		}
		csrfTokenFromClient = r.FormValue("csrf")
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	expectedToken := session.GetCSRF()
	if csrfTokenFromClient == expectedToken {
		return true
	}

	// ToDo(DSchalla) 2019/01/04: Remove after deprecation period and only allow CSRF Header (MM-13657)
	if r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML {
		csrfErrorMessage := "CSRF Check failed for request - Please migrate your plugin to either send a CSRF Header or Form Field, XMLHttpRequest is deprecated"
		if strictCSRFEnforcement {
			rctx.Logger().Warn(csrfErrorMessage, mlog.String("session_id", session.Id))
			return false
		}

		// Allow XMLHttpRequest for backward compatibility when not strict
		rctx.Logger().Debug(csrfErrorMessage, mlog.String("session_id", session.Id))
		return true
	}

	return false
}
