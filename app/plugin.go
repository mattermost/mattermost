// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/filesstore"
	"github.com/mattermost/mattermost-server/services/marketplace"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/pkg/errors"
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
	// Acquiring lock manually, as plugins might be disabled. See GetPluginsEnvironment.
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

				if activated {
					// Notify all cluster clients if ready
					if err := a.notifyPluginEnabled(updatedManifest); err != nil {
						a.Log.Error("Failed to notify cluster on plugin enable", mlog.Err(err))
					}
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
	// Acquiring lock manually, as plugins might be disabled. See GetPluginsEnvironment.
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

	if err := a.SyncPlugins(); err != nil {
		mlog.Error("Failed to sync plugins from the file store", mlog.Err(err))
	}

	prepackagedPluginsDir, found := fileutils.FindDir("prepackaged_plugins")
	if found {
		if err := filepath.Walk(prepackagedPluginsDir, func(walkPath string, info os.FileInfo, err error) error {
			if !strings.HasSuffix(walkPath, ".tar.gz") {
				return nil
			}

			if fileReader, err := os.Open(walkPath); err != nil {
				mlog.Error("Failed to open prepackaged plugin", mlog.Err(err), mlog.String("path", walkPath))
			} else if _, err := a.installPluginLocally(fileReader, true); err != nil {
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

// SyncPlugins synchronizes the plugins installed locally
// with the plugin bundles available in the file store.
func (a *App) SyncPlugins() *model.AppError {
	mlog.Info("Syncing plugins from the file store")

	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("SyncPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("SyncPlugins", "app.plugin.sync.read_local_folder.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, plugin := range availablePlugins {
		pluginId := plugin.Manifest.Id

		// Only handle managed plugins with .filestore flag file.
		_, err := os.Stat(filepath.Join(*a.Config().PluginSettings.Directory, pluginId, managedPluginFileName))
		if os.IsNotExist(err) {
			mlog.Warn("Skipping sync for unmanaged plugin", mlog.String("plugin_id", pluginId))
		} else if err != nil {
			mlog.Error("Skipping sync for plugin after failure to check if managed", mlog.String("plugin_id", pluginId), mlog.Err(err))
		} else {
			mlog.Debug("Removing local installation of managed plugin before sync", mlog.String("plugin_id", pluginId))
			if err := a.removePluginLocally(pluginId); err != nil {
				mlog.Error("Failed to remove local installation of managed plugin before sync", mlog.String("plugin_id", pluginId), mlog.Err(err))
			}
		}
	}

	// Install plugins from the file store.
	fileStorePaths, appErr := a.ListDirectory(fileStorePluginFolder)
	if appErr != nil {
		return model.NewAppError("SyncPlugins", "app.plugin.sync.list_filestore.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}
	if len(fileStorePaths) == 0 {
		mlog.Info("Found no files in plugins file store")
		return nil
	}

	for _, path := range fileStorePaths {
		if !strings.HasSuffix(path, ".tar.gz") {
			mlog.Warn("Ignoring non-plugin in file store", mlog.String("bundle", path))
			continue
		}

		var reader filesstore.ReadCloseSeeker
		reader, appErr = a.FileReader(path)
		if appErr != nil {
			mlog.Error("Failed to open plugin bundle from file store.", mlog.String("bundle", path), mlog.Err(appErr))
			continue
		}
		defer reader.Close()

		mlog.Info("Syncing plugin from file store", mlog.String("bundle", path))
		if _, err := a.installPluginLocally(reader, true); err != nil {
			mlog.Error("Failed to sync plugin from file store", mlog.String("bundle", path), mlog.Err(err))
		}
	}

	return nil
}

func (a *App) ShutDownPlugins() {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return
	}

	mlog.Info("Shutting down plugins")

	pluginsEnvironment.Shutdown()

	a.RemoveConfigListener(a.Srv.PluginConfigListenerId)
	a.Srv.PluginConfigListenerId = ""

	// Acquiring lock manually before cleaning up PluginsEnvironment.
	a.Srv.PluginsLock.Lock()
	defer a.Srv.PluginsLock.Unlock()
	if a.Srv.PluginsEnvironment == pluginsEnvironment {
		a.Srv.PluginsEnvironment = nil
	} else {
		mlog.Warn("Another PluginsEnvironment detected while shutting down plugins.")
	}
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
// Notifies cluster peers through config change.
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

	// This call will implicitly invoke SyncPluginsActiveState which will activate enabled plugins.
	if err := a.SaveConfig(a.Config(), true); err != nil {
		if err.Id == "ent.cluster.save_config.error" {
			return model.NewAppError("EnablePlugin", "app.plugin.cluster.save_config.app_error", nil, "", http.StatusInternalServerError)
		}
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// DisablePlugin will set the config for an installed plugin to disabled, triggering deactivation if active.
// Notifies cluster peers through config change.
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

	// This call will implicitly invoke SyncPluginsActiveState which will deactivate disabled plugins.
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

// GetMarketplacePlugins returns a list of plugins from the marketplace-server,
// and plugins that are installed locally.
func (a *App) GetMarketplacePlugins(filter *model.MarketplacePluginFilter) ([]*model.MarketplacePlugin, *model.AppError) {
	var result []*model.MarketplacePlugin
	pluginSet := map[string]bool{}
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	marketplaceClient, err := marketplace.NewClient(
		*a.Config().PluginSettings.MarketplaceUrl,
		a.HTTPService,
	)
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugins", "app.plugin.marketplace_client.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Fetch all plugins from marketplace.
	marketplacePlugins, err := marketplaceClient.GetPlugins(&model.MarketplacePluginFilter{
		PerPage:       -1,
		ServerVersion: model.CurrentVersion,
	})
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugins", "app.plugin.marketplace_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, p := range marketplacePlugins {
		if p.Manifest == nil || !pluginMatchesFilter(p.Manifest, filter.Filter) {
			continue
		}

		marketplacePlugin := &model.MarketplacePlugin{
			BaseMarketplacePlugin: p,
		}

		var manifest *model.Manifest
		if manifest, err = pluginsEnvironment.GetManifest(p.Manifest.Id); err != nil && err != plugin.ErrNotFound {
			return nil, model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if err == nil {
			// Plugin is installed.
			marketplacePlugin.InstalledVersion = manifest.Version
		}

		pluginSet[p.Manifest.Id] = true
		result = append(result, marketplacePlugin)
	}

	// Include all other installed plugins.
	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, plugin := range plugins {
		if plugin.Manifest == nil || pluginSet[plugin.Manifest.Id] || !pluginMatchesFilter(plugin.Manifest, filter.Filter) {
			continue
		}

		result = append(result, &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				Manifest: plugin.Manifest,
			},
			InstalledVersion: plugin.Manifest.Version,
		})
	}

	// Sort result alphabetically.
	sort.SliceStable(result, func(i, j int) bool {
		return strings.ToLower(result[i].Manifest.Name) < strings.ToLower(result[j].Manifest.Name)
	})

	return result, nil
}

func pluginMatchesFilter(manifest *model.Manifest, filter string) bool {
	filter = strings.TrimSpace(strings.ToLower(filter))

	if filter == "" {
		return true
	}

	if strings.ToLower(manifest.Id) == filter {
		return true
	}

	if strings.Contains(strings.ToLower(manifest.Name), filter) {
		return true
	}

	if strings.Contains(strings.ToLower(manifest.Description), filter) {
		return true
	}

	return false
}

// notifyPluginEnabled notifies connected websocket clients across all peers if the version of the given
// plugin is same across them.
//
// When a peer finds itself in agreement with all other peers as to the version of the given plugin,
// it will notify all connected websocket clients (across all peers) to trigger the (re-)installation.
// There is a small chance that this never occurs, because the last server to finish installing dies before it can announce.
// There is also a chance that multiple servers notify, but the webapp handles this idempotently.
func (a *App) notifyPluginEnabled(manifest *model.Manifest) error {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return errors.New("pluginsEnvironment is nil")
	}
	if !manifest.HasClient() || !pluginsEnvironment.IsActive(manifest.Id) {
		return nil
	}

	var statuses model.PluginStatuses

	if a.Cluster != nil {
		var err *model.AppError
		statuses, err = a.Cluster.GetPluginStatuses()
		if err != nil {
			return err
		}
	}

	localStatus, err := a.GetPluginStatus(manifest.Id)
	if err != nil {
		return err
	}
	statuses = append(statuses, localStatus)

	// This will not guard against the race condition of enabling a plugin immediately after installation.
	// As GetPluginStatuses() will not return the new plugin (since other peers are racing to install),
	// this peer will end up checking status against itself and will notify all webclients (including peer webclients),
	// which may result in a 404.
	for _, status := range statuses {
		if status.PluginId == manifest.Id && status.Version != manifest.Version {
			mlog.Debug("Not ready to notify webclients", mlog.String("cluster_id", status.ClusterId), mlog.String("plugin_id", manifest.Id))
			return nil
		}
	}

	// Notify all cluster peer clients.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_ENABLED, "", "", "", nil)
	message.Add("manifest", manifest.ClientManifest())
	a.Publish(message)

	return nil
}
