// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"path"
	"strings"

	"bytes"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils"
	"io/ioutil"
)

func (a *App) ServePluginRequest(w http.ResponseWriter, r *http.Request) {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		err := model.NewAppError("ServePluginRequest", "app.plugin.disabled.app_error", nil, "Enable plugins to serve plugin requests", http.StatusNotImplemented)
		a.Log.Error(err.Error())
		w.WriteHeader(err.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(err.ToJson()))
		return
	}

	params := mux.Vars(r)
	hooks, err := a.Plugins.HooksForPlugin(params["plugin_id"])
	if err != nil {
		a.Log.Error("Access to route for non-existent plugin", mlog.String("missing_plugin_id", params["plugin_id"]), mlog.Err(err))
		http.NotFound(w, r)
		return
	}

	a.servePluginRequest(w, r, hooks.ServeHTTP)
}

func (a *App) servePluginRequest(w http.ResponseWriter, r *http.Request, handler func(*plugin.Context, http.ResponseWriter, *http.Request)) {
	token := ""
	context := &plugin.Context{}
	cookieAuth := false

	authHeader := r.Header.Get(model.HEADER_AUTH)
	if strings.HasPrefix(strings.ToUpper(authHeader), model.HEADER_BEARER+" ") {
		token = authHeader[len(model.HEADER_BEARER)+1:]
	} else if strings.HasPrefix(strings.ToLower(authHeader), model.HEADER_TOKEN+" ") {
		token = authHeader[len(model.HEADER_TOKEN)+1:]
	} else if cookie, _ := r.Cookie(model.SESSION_COOKIE_TOKEN); cookie != nil {
		token = cookie.Value
		cookieAuth = true
	} else {
		token = r.URL.Query().Get("access_token")
	}

	r.Header.Del("Mattermost-User-Id")
	if token != "" {
		session, err := a.GetSession(token)
		csrfCheckPassed := true

		if err == nil && cookieAuth && r.Method != "GET" && r.Header.Get(model.HEADER_REQUESTED_WITH) != model.HEADER_REQUESTED_WITH_XML {
			bodyBytes, _ := ioutil.ReadAll(r.Body)
			r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
			r.ParseForm()
			sentToken := r.FormValue("csrf")
			expectedToken := session.GetCSRF()

			if sentToken != expectedToken {
				csrfCheckPassed = false
			}

			// Set Request Body again, since otherwise form values aren't accessible in plugin handler
			r.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		if session != nil && err == nil && csrfCheckPassed {
			r.Header.Set("Mattermost-User-Id", session.UserId)
			context.SessionId = session.Id
		}
	}

	cookies := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cookies {
		if c.Name != model.SESSION_COOKIE_TOKEN {
			r.AddCookie(c)
		}
	}
	r.Header.Del(model.HEADER_AUTH)
	r.Header.Del("Referer")

	params := mux.Vars(r)

	subpath, _ := utils.GetSubpathFromConfig(a.Config())

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()
	r.URL.Path = strings.TrimPrefix(r.URL.Path, path.Join(subpath, "plugins", params["plugin_id"]))

	handler(context, w, r)
}
