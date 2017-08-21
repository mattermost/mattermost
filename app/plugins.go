// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	"github.com/mattermost/platform/app/plugin"
	"github.com/mattermost/platform/app/plugin/jira"
	mmplugin "github.com/mattermost/platform/plugin"
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
	return GetTeamByName(name)
}

func (api *PluginAPI) GetUserByName(name string) (*model.User, *model.AppError) {
	return GetUserByUsername(name)
}

func (api *PluginAPI) GetChannelByName(teamId, name string) (*model.Channel, *model.AppError) {
	return GetChannelByName(name, teamId)
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return GetDirectChannel(userId1, userId2)
}

func (api *PluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return CreatePostMissingChannel(post, true)
}

func (api *PluginAPI) I18n(id string, r *http.Request) string {
	if r != nil {
		f, _ := utils.GetTranslationsAndLocale(nil, r)
		return f(id)
	}
	f, _ := utils.GetTranslationsBySystemLocale()
	return f(id)
}

func InitPlugins() {
	plugins := map[string]plugin.Plugin{
		"jira": &jira.Plugin{},
	}
	for id, p := range plugins {
		l4g.Info("Initializing plugin: " + id)
		api := &PluginAPI{
			id:     id,
			router: Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
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

func ActivatePlugins() {
	if Srv.PluginEnv == nil {
		l4g.Error("plugin env not initialized")
		return
	}

	plugins, err := Srv.PluginEnv.Plugins()
	if err != nil {
		l4g.Error("failed to start up plugins: " + err.Error())
		return
	}

	for _, plugin := range plugins {
		err := Srv.PluginEnv.ActivatePlugin(plugin.Manifest.Id)
		if err != nil {
			l4g.Error(err.Error())
		}
		l4g.Info(fmt.Sprintf("Activated %v plugin", plugin.Manifest.Id))
	}
}

func UnpackAndActivatePlugin(pluginFile io.Reader) (*mmplugin.Manifest, *model.AppError) {
	if Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	filenames, err := utils.ExtractTarGz(pluginFile, Srv.PluginEnv.SearchPath())
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

	manifestDir := filepath.Join(Srv.PluginEnv.SearchPath(), splitPath[0])

	manifest, _, err := mmplugin.FindManifest(manifestDir)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	// Should add manifest validation and error handling here

	err = Srv.PluginEnv.ActivatePlugin(manifest.Id)
	if err != nil {
		return nil, model.NewAppError("UnpackAndActivatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return manifest, nil
}

func GetActivePluginManifests() ([]*mmplugin.Manifest, *model.AppError) {
	if Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := Srv.PluginEnv.Plugins()
	if err != nil {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.get_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	manifests := make([]*mmplugin.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

func RemovePlugin(id string) *model.AppError {
	if Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return model.NewAppError("RemovePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	err := Srv.PluginEnv.DeactivatePlugin(id)
	if err != nil {
		return model.NewAppError("RemovePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	err = os.RemoveAll(filepath.Join(Srv.PluginEnv.SearchPath(), id))
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

func GetPluginsForClientConfig() string {
	if Srv.PluginEnv == nil || !*utils.Cfg.PluginSettings.Enable {
		return ""
	}

	plugins, err := Srv.PluginEnv.Plugins()
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
