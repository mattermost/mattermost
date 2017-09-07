// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
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

	"github.com/mattermost/mattermost-server/app/plugin"
	"github.com/mattermost/mattermost-server/app/plugin/jira"
	"github.com/mattermost/mattermost-server/app/plugin/ldapextras"
)

type PluginAPI struct {
	id     string
	router *mux.Router
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(utils.Cfg.PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) PluginRouter() *mux.Router {
	return api.router
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return Global().GetTeamByName(name)
}

func (api *PluginAPI) GetUserByName(name string) (*model.User, *model.AppError) {
	return Global().GetUserByUsername(name)
}

func (api *PluginAPI) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	return Global().GetChannelByName(name, teamId)
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return Global().GetDirectChannel(userId1, userId2)
}

func (api *PluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return Global().CreatePostMissingChannel(post, true)
}

func (api *PluginAPI) GetLdapUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError) {
	ldapInterface := einterfaces.GetLdapInterface()
	if ldapInterface == nil {
		return nil, model.NewAppError("GetLdapUserAttributes", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err := Global().GetUser(userId)
	if err != nil {
		return nil, err
	}

	return ldapInterface.GetUserAttributes(*user.AuthData, attributes)
}

func (api *PluginAPI) GetSessionFromRequest(r *http.Request) (*model.Session, *model.AppError) {
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

	session, err := Global().GetSession(token)

	if err != nil {
		return nil, model.NewAppError("ServeHTTP", "api.context.session_expired.app_error", nil, "token="+token, http.StatusUnauthorized)
	} else if !session.IsOAuth && isTokenFromQueryString {
		return nil, model.NewAppError("ServeHTTP", "api.context.token_provided.app_error", nil, "token="+token, http.StatusUnauthorized)
	}

	return session, nil
}

func (api *PluginAPI) I18n(id string, r *http.Request) string {
	if r != nil {
		f, _ := utils.GetTranslationsAndLocale(nil, r)
		return f(id)
	}
	f, _ := utils.GetTranslationsBySystemLocale()
	return f(id)
}

func (a *App) InitPlugins() {
	plugins := map[string]plugin.Plugin{
		"jira":       &jira.Plugin{},
		"ldapextras": &ldapextras.Plugin{},
	}
	for id, p := range plugins {
		l4g.Info("Initializing plugin: " + id)
		api := &PluginAPI{
			id:     id,
			router: a.Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
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
	if a.Srv.PluginEnv == nil {
		l4g.Error("plugin env not initialized")
		return
	}

	plugins, err := a.Srv.PluginEnv.Plugins()
	if err != nil {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	for _, plugin := range plugins {
		err := a.Srv.PluginEnv.ActivatePlugin(plugin.Manifest.Id)
		if err != nil {
			l4g.Error(err.Error())
		}
		l4g.Info("Activated %v plugin", plugin.Manifest.Id)
	}
}

func (a *App) UnpackAndActivatePlugin(pluginFile io.Reader) (*model.Manifest, *model.AppError) {
	if a.Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.temp_dir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer func() {
		os.RemoveAll(tmpDir)
	}()

	filenames, err := utils.ExtractTarGz(pluginFile, tmpDir)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.extract.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if len(filenames) == 0 {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.no_files.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	splitPath := strings.Split(filenames[0], string(os.PathSeparator))

	if len(splitPath) == 0 {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.bad_path.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	manifestDir := filepath.Join(tmpDir, splitPath[0])

	manifest, _, err := model.FindManifest(manifestDir)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	os.Rename(manifestDir, filepath.Join(a.Srv.PluginEnv.SearchPath(), manifest.Id))
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.mvdir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Should add manifest validation and error handling here

	err = a.Srv.PluginEnv.ActivatePlugin(manifest.Id)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return manifest, nil
}

func (a *App) GetActivePluginManifests() ([]*model.Manifest, *model.AppError) {
	if a.Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.Srv.PluginEnv.ActivePlugins()
	if err != nil {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.get_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	manifests := make([]*model.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

func (a *App) RemovePlugin(id string) *model.AppError {
	if a.Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return model.NewAppError("RemovePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	err := a.Srv.PluginEnv.DeactivatePlugin(id)
	if err != nil {
		return model.NewAppError("RemovePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	err = os.RemoveAll(filepath.Join(a.Srv.PluginEnv.SearchPath(), id))
	if err != nil {
		return model.NewAppError("RemovePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// Temporary WIP function/type for experimental webapp plugins
type ClientConfigPlugin struct {
	Id         string `json:"id"`
	BundlePath string `json:"bundle_path"`
}

func (a *App) GetPluginsForClientConfig() string {
	if a.Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return ""
	}

	plugins, err := a.Srv.PluginEnv.ActivePlugins()
	if err != nil {
		return ""
	}

	pluginsConfig := []ClientConfigPlugin{}
	for _, plugin := range plugins {
		if plugin.Manifest.Webapp == nil {
			continue
		}
		pluginsConfig = append(pluginsConfig, ClientConfigPlugin{Id: plugin.Manifest.Id, BundlePath: plugin.Manifest.Webapp.BundlePath})
	}

	b, err := json.Marshal(pluginsConfig)
	if err != nil {
		return ""
	}

	return string(b)
}
