// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	builtinplugin "github.com/mattermost/mattermost-server/app/plugin"
	"github.com/mattermost/mattermost-server/app/plugin/jira"
	"github.com/mattermost/mattermost-server/app/plugin/ldapextras"

	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/pluginenv"
)

type PluginAPI struct {
	id  string
	app *App
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(utils.Cfg.PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *PluginAPI) GetUserByUsername(name string) (*model.User, *model.AppError) {
	return api.app.GetUserByUsername(name)
}

func (api *PluginAPI) GetChannelByName(name, teamId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId)
}

func (api *PluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.CreatePostMissingChannel(post, true)
}

type BuiltInPluginAPI struct {
	id     string
	router *mux.Router
	app    *App
}

func (api *BuiltInPluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(utils.Cfg.PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *BuiltInPluginAPI) PluginRouter() *mux.Router {
	return api.router
}

func (api *BuiltInPluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *BuiltInPluginAPI) GetUserByName(name string) (*model.User, *model.AppError) {
	return api.app.GetUserByUsername(name)
}

func (api *BuiltInPluginAPI) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId)
}

func (api *BuiltInPluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return api.app.GetDirectChannel(userId1, userId2)
}

func (api *BuiltInPluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.CreatePostMissingChannel(post, true)
}

func (api *BuiltInPluginAPI) GetLdapUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError) {
	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil {
		return nil, model.NewAppError("GetLdapUserAttributes", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err := api.app.GetUser(userId)
	if err != nil {
		return nil, err
	}

	return ldapInterface.GetUserAttributes(*user.AuthData, attributes)
}

func (api *BuiltInPluginAPI) GetSessionFromRequest(r *http.Request) (*model.Session, *model.AppError) {
	token := ""
	isTokenFromQueryString := false

	// Attempt to parse token out of the header
	authHeader := r.Header.Get(model.HEADER_AUTH)
	if len(authHeader) > 6 && strings.ToUpper(authHeader[0:6]) == model.HEADER_BEARER {
		// Default session token
		token = authHeader[7:]

	} else if len(authHeader) > 5 && strings.ToLower(authHeader[0:5]) == model.HEADER_TOKEN {
		// OAuth token
		token = authHeader[6:]
	}

	// Attempt to parse the token from the cookie
	if len(token) == 0 {
		if cookie, err := r.Cookie(model.SESSION_COOKIE_TOKEN); err == nil {
			token = cookie.Value

			if r.Header.Get(model.HEADER_REQUESTED_WITH) != model.HEADER_REQUESTED_WITH_XML {
				return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token+" Appears to be a CSRF attempt", http.StatusUnauthorized)
			}
		}
	}

	// Attempt to parse token out of the query string
	if len(token) == 0 {
		token = r.URL.Query().Get("access_token")
		isTokenFromQueryString = true
	}

	if len(token) == 0 {
		return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
	}

	session, err := api.app.GetSession(token)

	if err != nil {
		return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
	} else if !session.IsOAuth && isTokenFromQueryString {
		return nil, model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
	}

	return session, nil
}

func (api *BuiltInPluginAPI) I18n(id string, r *http.Request) string {
	if r != nil {
		f, _ := utils.GetTranslationsAndLocale(nil, r)
		return f(id)
	}
	f, _ := utils.GetTranslationsBySystemLocale()
	return f(id)
}

func (a *App) InitBuiltInPlugins() {
	plugins := map[string]builtinplugin.Plugin{
		"jira":       &jira.Plugin{},
		"ldapextras": &ldapextras.Plugin{},
	}
	for id, p := range plugins {
		l4g.Info("Initializing plugin: " + id)
		api := &BuiltInPluginAPI{
			id:     id,
			router: a.Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
			app:    a,
		}
		p.Initialize(api)
	}
	utils.AddConfigListener(func(before, after *model.Config) {
		for _, p := range plugins {
			p.OnConfigurationChange()
		}
	})
	for _, p := range plugins {
		p.OnConfigurationChange()
	}
}

func (a *App) ActivatePlugins() {
	if a.PluginEnv == nil {
		l4g.Error("plugin env not initialized")
		return
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	for _, plugin := range plugins {
		err := a.PluginEnv.ActivatePlugin(plugin.Manifest.Id)
		if err != nil {
			l4g.Error(err.Error())
		}
		l4g.Info("Activated %v plugin", plugin.Manifest.Id)
	}
}

func (a *App) UnpackAndActivatePlugin(pluginFile io.Reader) (*model.Manifest, *model.AppError) {
	if a.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer os.RemoveAll(tmpDir)

	if err := utils.ExtractTarGz(pluginFile, tmpDir); err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.extract.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	tmpPluginDir := tmpDir
	dir, err := ioutil.ReadDir(tmpDir)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(dir) == 1 && dir[0].IsDir() {
		tmpPluginDir = filepath.Join(tmpPluginDir, dir[0].Name())
	}

	manifest, _, err := model.FindManifest(tmpPluginDir)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	os.Rename(tmpPluginDir, filepath.Join(a.PluginEnv.SearchPath(), manifest.Id))
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.mvdir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Should add manifest validation and error handling here

	err = a.PluginEnv.ActivatePlugin(manifest.Id)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if manifest.HasClient() {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_ACTIVATED, "", "", "", nil)
		message.Add("manifest", manifest.ClientManifest())
		Publish(message)
	}

	return manifest, nil
}

func (a *App) GetActivePluginManifests() ([]*model.Manifest, *model.AppError) {
	if a.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins := a.PluginEnv.ActivePlugins()

	manifests := make([]*model.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

func (a *App) RemovePlugin(id string) *model.AppError {
	if a.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return model.NewAppError("RemovePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins := a.PluginEnv.ActivePlugins()
	manifest := &model.Manifest{}
	for _, p := range plugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	err := a.PluginEnv.DeactivatePlugin(id)
	if err != nil {
		return model.NewAppError("RemovePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	err = os.RemoveAll(filepath.Join(a.PluginEnv.SearchPath(), id))
	if err != nil {
		return model.NewAppError("RemovePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if manifest.HasClient() {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_DEACTIVATED, "", "", "", nil)
		message.Add("manifest", manifest.ClientManifest())
		Publish(message)
	}

	return nil
}

func (a *App) InitPlugins(pluginPath, webappPath string) {
	a.InitBuiltInPlugins()

	if !utils.IsLicensed() || !*utils.License().Features.FutureFeatures || !*utils.Cfg.PluginSettings.Enable {
		return
	}

	l4g.Info("Starting up plugins")

	err := os.Mkdir(pluginPath, 0744)
	if err != nil && !os.IsExist(err) {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	err = os.Mkdir(webappPath, 0744)
	if err != nil && !os.IsExist(err) {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	a.PluginEnv, err = pluginenv.New(
		pluginenv.SearchPath(pluginPath),
		pluginenv.WebappPath(webappPath),
		pluginenv.APIProvider(func(m *model.Manifest) (plugin.API, error) {
			return &PluginAPI{
				id:  m.Id,
				app: a,
			}, nil
		}),
	)

	if err != nil {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	a.PluginConfigListenerId = utils.AddConfigListener(func(_, _ *model.Config) {
		for _, err := range a.PluginEnv.Hooks().OnConfigurationChange() {
			l4g.Error(err.Error())
		}
	})

	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", a.ServePluginRequest)
	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/{anything:.*}", a.ServePluginRequest)

	a.ActivatePlugins()
}

func (a *App) ServePluginRequest(w http.ResponseWriter, r *http.Request) {
	token := ""

	authHeader := r.Header.Get(model.HEADER_AUTH)
	if strings.HasPrefix(strings.ToUpper(authHeader), model.HEADER_BEARER+":") {
		token = authHeader[len(model.HEADER_BEARER)+1:]
	} else if strings.HasPrefix(strings.ToLower(authHeader), model.HEADER_TOKEN+":") {
		token = authHeader[len(model.HEADER_TOKEN)+1:]
	} else if cookie, _ := r.Cookie(model.SESSION_COOKIE_TOKEN); cookie != nil && (r.Method == "GET" || r.Header.Get(model.HEADER_REQUESTED_WITH) == model.HEADER_REQUESTED_WITH_XML) {
		token = cookie.Value
	} else {
		token = r.URL.Query().Get("access_token")
	}

	r.Header.Del("Mattermost-User-Id")
	if token != "" {
		if session, err := a.GetSession(token); err != nil {
			r.Header.Set("Mattermost-User-Id", session.UserId)
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

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()

	params := mux.Vars(r)
	a.PluginEnv.Hooks().ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), "plugin_id", params["plugin_id"])))
}

func (a *App) ShutDownPlugins() {
	if a.PluginEnv == nil {
		return
	}
	for _, err := range a.PluginEnv.Shutdown() {
		l4g.Error(err.Error())
	}
	utils.RemoveConfigListener(a.PluginConfigListenerId)
	a.PluginConfigListenerId = ""
}
