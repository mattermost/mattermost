// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils/fileutils"
)

// GetPluginsEnvironment returns the plugin environment for use if plugins are enabled and
// initialized.
//
// To get the plugins environment when the plugins are disabled, manually acquire the plugins
// lock instead.
func (a *App) GetPluginsEnvironment() *plugin.Environment {
	if !*a.Config().PluginSettings.Enable {
		return nil
	}

	a.Srv.PluginsLock.RLock()
	defer a.Srv.PluginsLock.RUnlock()

	return a.Srv.PluginsEnvironment
}

func (a *App) SetPluginsEnvironment(pluginsEnvironment *plugin.Environment) {
	a.Srv.PluginsLock.Lock()
	defer a.Srv.PluginsLock.Unlock()

	a.Srv.PluginsEnvironment = pluginsEnvironment
}

func (a *App) SyncPluginsActiveState() {
	a.Srv.PluginsLock.RLock()
	pluginsEnvironment := a.Srv.PluginsEnvironment
	a.Srv.PluginsLock.RUnlock()

	if pluginsEnvironment == nil {
		return
	}

	config := a.Config().PluginSettings

	if *config.Enable {
		availablePlugins, err := pluginsEnvironment.Available()
		if err != nil {
			a.Log.Error("Unable to get available plugins", mlog.Err(err))
			return
		}

		// Deactivate any plugins that have been disabled.
		for _, plugin := range availablePlugins {
			// Determine if plugin is enabled
			pluginId := plugin.Manifest.Id
			pluginEnabled := false
			if state, ok := config.PluginStates[pluginId]; ok {
				pluginEnabled = state.Enable
			}

			// If it's not enabled we need to deactivate it
			if !pluginEnabled {
				deactivated := pluginsEnvironment.Deactivate(pluginId)
				if deactivated && plugin.Manifest.HasClient() {
					message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_DISABLED, "", "", "", nil)
					message.Add("manifest", plugin.Manifest.ClientManifest())
					a.Publish(message)
				}
			}
		}

		// Activate any plugins that have been enabled
		for _, plugin := range availablePlugins {
			if plugin.Manifest == nil {
				plugin.WrapLogger(a.Log).Error("Plugin manifest could not be loaded", mlog.Err(plugin.ManifestError))
				continue
			}

			// Determine if plugin is enabled
			pluginId := plugin.Manifest.Id
			pluginEnabled := false
			if state, ok := config.PluginStates[pluginId]; ok {
				pluginEnabled = state.Enable
			}

			// Activate plugin if enabled
			if pluginEnabled {
				updatedManifest, activated, err := pluginsEnvironment.Activate(pluginId)
				if err != nil {
					plugin.WrapLogger(a.Log).Error("Unable to activate plugin", mlog.Err(err))
					continue
				}

				if activated && updatedManifest.HasClient() {
					message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_ENABLED, "", "", "", nil)
					message.Add("manifest", updatedManifest.ClientManifest())
					a.Publish(message)
				}
			}
		}
	} else { // If plugins are disabled, shutdown plugins.
		pluginsEnvironment.Shutdown()
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}
}

func (a *App) NewPluginAPI(manifest *model.Manifest) plugin.API {
	return NewPluginAPI(a, manifest)
}

func (a *App) InitPlugins(pluginDir, webappPluginDir string) {
	a.Srv.PluginsLock.RLock()
	pluginsEnvironment := a.Srv.PluginsEnvironment
	a.Srv.PluginsLock.RUnlock()
	if pluginsEnvironment != nil || !*a.Config().PluginSettings.Enable {
		a.SyncPluginsActiveState()
		return
	}

	a.Log.Info("Starting up plugins")

	if err := os.Mkdir(pluginDir, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	if err := os.Mkdir(webappPluginDir, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	env, err := plugin.NewEnvironment(a.NewPluginAPI, pluginDir, webappPluginDir, a.Log)
	if err != nil {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	}
	a.SetPluginsEnvironment(env)

	prepackagedPluginsDir, found := fileutils.FindDir("prepackaged_plugins")
	if found {
		if err := filepath.Walk(prepackagedPluginsDir, func(walkPath string, info os.FileInfo, err error) error {
			if !strings.HasSuffix(walkPath, ".tar.gz") {
				return nil
			}

			if fileReader, err := os.Open(walkPath); err != nil {
				mlog.Error("Failed to open prepackaged plugin", mlog.Err(err), mlog.String("path", walkPath))
			} else if _, err := a.InstallPlugin(fileReader, true); err != nil {
				mlog.Error("Failed to unpack prepackaged plugin", mlog.Err(err), mlog.String("path", walkPath))
			}

			return nil
		}); err != nil {
			mlog.Error("Failed to complete unpacking prepackaged plugins", mlog.Err(err))
		}
	}

	// Sync plugin active state when config changes. Also notify plugins.
	a.Srv.PluginsLock.Lock()
	a.RemoveConfigListener(a.Srv.PluginConfigListenerId)
	a.Srv.PluginConfigListenerId = a.AddConfigListener(func(*model.Config, *model.Config) {
		a.SyncPluginsActiveState()
		if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.OnConfigurationChange()
				return true
			}, plugin.OnConfigurationChangeId)
		}
	})
	a.Srv.PluginsLock.Unlock()

	a.SyncPluginsActiveState()
}

func (a *App) ShutDownPlugins() {
	a.Srv.PluginsLock.Lock()
	pluginsEnvironment := a.Srv.PluginsEnvironment
	defer a.Srv.PluginsLock.Unlock()
	if pluginsEnvironment == nil {
		return
	}

	mlog.Info("Shutting down plugins")

	pluginsEnvironment.Shutdown()

	a.RemoveConfigListener(a.Srv.PluginConfigListenerId)
	a.Srv.PluginConfigListenerId = ""
	a.Srv.PluginsEnvironment = nil
}

func (a *App) GetActivePluginManifests() ([]*model.Manifest, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins := pluginsEnvironment.Active()

	manifests := make([]*model.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

// EnablePlugin will set the config for an installed plugin to enabled, triggering asynchronous
// activation if inactive anywhere in the cluster.
func (a *App) EnablePlugin(id string) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("EnablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	id = strings.ToLower(id)

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
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("DisablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	id = strings.ToLower(id)

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
	a.UnregisterPluginCommands(id)

	if err := a.SaveConfig(a.Config(), true); err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) GetPlugins() (*model.PluginsResponse, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := pluginsEnvironment.Available()
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

		if pluginsEnvironment.IsActive(plugin.Manifest.Id) {
			resp.Active = append(resp.Active, info)
		} else {
			resp.Inactive = append(resp.Inactive, info)
		}
	}

	return resp, nil
}
