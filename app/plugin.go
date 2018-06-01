// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"os"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

func (a *App) SyncPluginsActiveState() {
	if a.Plugins == nil {
		return
	}

	config := a.Config().PluginSettings

	if *config.Enable {
		availablePlugins, err := a.Plugins.Available()
		if err != nil {
			a.Log.Error("Unable to get available plugins", mlog.Err(err))
			return
		}

		// Deactivate any plugins that have been disabled.
		for _, plugin := range a.Plugins.Active() {
			// Determine if plugin is enabed
			pluginId := plugin.Manifest.Id
			pluginEnabled := false
			if state, ok := config.PluginStates[pluginId]; ok {
				pluginEnabled = state.Enable
			}

			// If it's not enabled we need to stop it
			if !pluginEnabled {
				a.Plugins.Deactivate(pluginId)
			}
		}

		// Activate any plugins that have been enabed
		for _, plugin := range availablePlugins {
			if plugin.Manifest == nil {
				plugin.WrapLogger(a.Log).Error("Plugin manifest could not be loaded", mlog.Err(plugin.ManifestError))
				continue
			}

			// Determine if plugin is enabed
			pluginId := plugin.Manifest.Id
			pluginEnabled := false
			if state, ok := config.PluginStates[pluginId]; ok {
				pluginEnabled = state.Enable
			}

			// Activate plugin if enabled
			if pluginEnabled {
				if err := a.Plugins.Activate(pluginId); err != nil {
					plugin.WrapLogger(a.Log).Error("Unable to activate plugin", mlog.Err(err))
				}
			}
		}
	} else { // If plugins are disabled, shutdown plugins.
		a.Plugins.Shutdown()
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}
}

func (a *App) NewPluginAPI(manifest *model.Manifest) plugin.API {
	return NewPluginAPI(a, manifest)
}

func (a *App) InitPlugins(pluginDir, webappPluginDir string) {
	if a.Plugins != nil || !*a.Config().PluginSettings.Enable {
		a.SyncPluginsActiveState()
		return
	}

	a.Log.Info("Starting up plugins")

	if err := os.Mkdir(pluginDir, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
	}

	if err := os.Mkdir(webappPluginDir, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
	}

	if env, err := plugin.NewEnvironment(a.NewPluginAPI, pluginDir, webappPluginDir, a.Log); err != nil {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	} else {
		a.Plugins = env
	}

	// Sync plugin active state when config changes. Also notify plugins.
	a.RemoveConfigListener(a.PluginConfigListenerId)
	a.PluginConfigListenerId = a.AddConfigListener(func(*model.Config, *model.Config) {
		a.SyncPluginsActiveState()
		a.Plugins.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
			hooks.OnConfigurationChange()
			return true
		}, plugin.OnConfigurationChangeId)
	})

	a.SyncPluginsActiveState()
}

func (a *App) ShutDownPlugins() {
	if a.Plugins == nil {
		return
	}

	mlog.Info("Shutting down plugins")

	a.Plugins.Shutdown()

	a.RemoveConfigListener(a.PluginConfigListenerId)
	a.PluginConfigListenerId = ""
	a.Plugins = nil
}

func (a *App) GetActivePluginManifests() ([]*model.Manifest, *model.AppError) {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins := a.Plugins.Active()

	manifests := make([]*model.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

// EnablePlugin will set the config for an installed plugin to enabled, triggering asynchronous
// activation if inactive anywhere in the cluster.
func (a *App) EnablePlugin(id string) *model.AppError {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("EnablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.Plugins.Available()
	if err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var manifest *model.Manifest
	for _, p := range plugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("EnablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: true}
	})

	// This call will cause SyncPluginsActiveState to be called and the plugin to be activated
	if err := a.SaveConfig(a.Config(), true); err != nil {
		if err.Id == "ent.cluster.save_config.error" {
			return model.NewAppError("EnablePlugin", "app.plugin.cluster.save_config.app_error", nil, "", http.StatusInternalServerError)
		}
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// DisablePlugin will set the config for an installed plugin to disabled, triggering deactivation if active.
func (a *App) DisablePlugin(id string) *model.AppError {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("DisablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.Plugins.Available()
	if err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var manifest *model.Manifest
	for _, p := range plugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("DisablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: false}
	})

	if err := a.SaveConfig(a.Config(), true); err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) PluginsReady() bool {
	return a.Plugins != nil && *a.Config().PluginSettings.Enable
}

func (a *App) GetPlugins() (*model.PluginsResponse, *model.AppError) {
	if !a.PluginsReady() {
		return nil, model.NewAppError("GetPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := a.Plugins.Available()
	if err != nil {
		return nil, model.NewAppError("GetPlugins", "app.plugin.get_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	resp := &model.PluginsResponse{Active: []*model.PluginInfo{}, Inactive: []*model.PluginInfo{}}
	for _, plugin := range availablePlugins {
		if plugin.Manifest == nil {
			continue
		}

		info := &model.PluginInfo{
			Manifest: *plugin.Manifest,
		}

		if a.Plugins.IsActive(plugin.Manifest.Id) {
			resp.Active = append(resp.Active, info)
		} else {
			resp.Inactive = append(resp.Inactive, info)
		}
	}

	return resp, nil
}
