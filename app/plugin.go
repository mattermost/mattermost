// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/services/marketplace"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"

	"github.com/blang/semver"
	svg "github.com/h2non/go-is-svg"
	"github.com/pkg/errors"
)

const prepackagedPluginsDir = "prepackaged_plugins"

type pluginSignaturePath struct {
	pluginId      string
	path          string
	signaturePath string
}

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

	plugins := a.processPrepackagedPlugins(prepackagedPluginsDir)
	pluginsEnvironment = a.GetPluginsEnvironment()
	pluginsEnvironment.SetPrepackagedPlugins(plugins)

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
	pluginSignaturePathMap, appErr := a.getPluginsFromFolder()
	if appErr != nil {
		return appErr
	}

	for _, plugin := range pluginSignaturePathMap {
		reader, appErr := a.FileReader(plugin.path)
		if appErr != nil {
			mlog.Error("Failed to open plugin bundle from file store.", mlog.String("bundle", plugin.path), mlog.Err(appErr))
			continue
		}
		defer reader.Close()

		var signature filesstore.ReadCloseSeeker
		if *a.Config().PluginSettings.RequirePluginSignature {
			signature, appErr = a.FileReader(plugin.signaturePath)
			if appErr != nil {
				mlog.Error("Failed to open plugin signature from file store.", mlog.Err(appErr))
				continue
			}
			defer signature.Close()
		}

		mlog.Info("Syncing plugin from file store", mlog.String("bundle", plugin.path))
		if _, err := a.installPluginLocally(reader, signature, installPluginLocallyAlways); err != nil {
			mlog.Error("Failed to sync plugin from file store", mlog.String("bundle", plugin.path), mlog.Err(err))
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

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	id = strings.ToLower(id)

	var manifest *model.Manifest
	for _, p := range availablePlugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("EnablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
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

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	id = strings.ToLower(id)

	var manifest *model.Manifest
	for _, p := range availablePlugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("DisablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
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
	plugins := map[string]*model.MarketplacePlugin{}

	if *a.Config().PluginSettings.EnableRemoteMarketplace && !filter.LocalOnly {
		p, appErr := a.getRemotePlugins(filter)
		if appErr != nil {
			return nil, appErr
		}
		plugins = p
	}

	appErr := a.mergePrepackagedPlugins(plugins)
	if appErr != nil {
		return nil, appErr
	}

	appErr = a.mergeLocalPlugins(plugins)
	if appErr != nil {
		return nil, appErr
	}

	// Filter plugins.
	var result []*model.MarketplacePlugin
	for _, p := range plugins {
		if pluginMatchesFilter(p.Manifest, filter.Filter) {
			result = append(result, p)
		}
	}

	// Sort result alphabetically.
	sort.SliceStable(result, func(i, j int) bool {
		return strings.ToLower(result[i].Manifest.Name) < strings.ToLower(result[j].Manifest.Name)
	})

	return result, nil
}

// getPrepackagedPlugin returns a pre-packaged plugin.
func (a *App) getPrepackagedPlugin(pluginId, version string) (*plugin.PrepackagedPlugin, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("getPrepackagedPlugin", "app.plugin.config.app_error", nil, "plugin environment is nil", http.StatusInternalServerError)
	}

	prepackagedPlugins := pluginsEnvironment.PrepackagedPlugins()
	for _, p := range prepackagedPlugins {
		if p.Manifest.Id == pluginId && p.Manifest.Version == version {
			return p, nil
		}
	}

	return nil, model.NewAppError("getPrepackagedPlugin", "app.plugin.marketplace_plugins.not_found.app_error", nil, "", http.StatusInternalServerError)
}

// getRemoteMarketplacePlugin returns plugin from marketplace-server.
func (a *App) getRemoteMarketplacePlugin(pluginId, version string) (*model.BaseMarketplacePlugin, *model.AppError) {
	marketplaceClient, err := marketplace.NewClient(
		*a.Config().PluginSettings.MarketplaceUrl,
		a.HTTPService,
	)
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugin", "app.plugin.marketplace_client.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	filter := &model.MarketplacePluginFilter{Filter: pluginId, ServerVersion: model.CurrentVersion}
	plugin, err := marketplaceClient.GetPlugin(filter, version)
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugin", "app.plugin.marketplace_plugins.not_found.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return plugin, nil
}

func (a *App) getRemotePlugins(filter *model.MarketplacePluginFilter) (map[string]*model.MarketplacePlugin, *model.AppError) {
	result := map[string]*model.MarketplacePlugin{}

	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	marketplaceClient, err := marketplace.NewClient(
		*a.Config().PluginSettings.MarketplaceUrl,
		a.HTTPService,
	)
	if err != nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.marketplace_client.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Fetch all plugins from marketplace.
	marketplacePlugins, err := marketplaceClient.GetPlugins(&model.MarketplacePluginFilter{
		PerPage:       -1,
		ServerVersion: model.CurrentVersion,
	})
	if err != nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.marketplace_client.failed_to_fetch", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, p := range marketplacePlugins {
		if p.Manifest == nil {
			continue
		}

		result[p.Manifest.Id] = &model.MarketplacePlugin{BaseMarketplacePlugin: p}
	}

	return result, nil
}

// mergePrepackagedPlugins merges pre-packaged plugins to remote marketplace plugins list.
func (a *App) mergePrepackagedPlugins(remoteMarketplacePlugins map[string]*model.MarketplacePlugin) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("mergePrepackagedPlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	for _, prepackaged := range pluginsEnvironment.PrepackagedPlugins() {
		if prepackaged.Manifest == nil {
			continue
		}

		prepackagedMarketplace := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL: prepackaged.Manifest.HomepageURL,
				IconData:    prepackaged.IconData,
				Manifest:    prepackaged.Manifest,
			},
		}

		// If not available in marketplace, add the prepackaged
		if remoteMarketplacePlugins[prepackaged.Manifest.Id] == nil {
			remoteMarketplacePlugins[prepackaged.Manifest.Id] = prepackagedMarketplace
			continue
		}

		// If available in the markteplace, only overwrite if newer.
		prepackagedVersion, err := semver.Parse(prepackaged.Manifest.Version)
		if err != nil {
			return model.NewAppError("mergePrepackagedPlugins", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest)
		}

		marketplacePlugin := remoteMarketplacePlugins[prepackaged.Manifest.Id]
		marketplaceVersion, err := semver.Parse(marketplacePlugin.Manifest.Version)
		if err != nil {
			return model.NewAppError("mergePrepackagedPlugins", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest)
		}

		if prepackagedVersion.GT(marketplaceVersion) {
			remoteMarketplacePlugins[prepackaged.Manifest.Id] = prepackagedMarketplace
		}
	}

	return nil
}

// mergeLocalPlugins merges locally installed plugins to remote marketplace plugins list.
func (a *App) mergeLocalPlugins(remoteMarketplacePlugins map[string]*model.MarketplacePlugin) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	localPlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, plugin := range localPlugins {
		if plugin.Manifest == nil {
			continue
		}

		if remoteMarketplacePlugins[plugin.Manifest.Id] != nil {
			// Remote plugin is installed.
			remoteMarketplacePlugins[plugin.Manifest.Id].InstalledVersion = plugin.Manifest.Version
			continue
		}

		iconData := ""
		if plugin.Manifest.IconPath != "" {
			iconData, err = getIcon(filepath.Join(plugin.Path, plugin.Manifest.IconPath))
			if err != nil {
				mlog.Warn("Error loading local plugin icon", mlog.String("plugin", plugin.Manifest.Id), mlog.String("icon_path", plugin.Manifest.IconPath), mlog.Err(err))
			}
		}

		var labels []model.MarketplaceLabel
		if *a.Config().PluginSettings.EnableRemoteMarketplace {
			// Labels should not (yet) be localized as the labels sent by the Marketplace are not (yet) localizable.
			labels = append(labels, model.MarketplaceLabel{
				Name:        "Local",
				Description: "This plugin is not listed in the marketplace",
			})
		}

		remoteMarketplacePlugins[plugin.Manifest.Id] = &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				IconData:    iconData,
				HomepageURL: plugin.Manifest.HomepageURL,
				Labels:      labels,
				Manifest:    plugin.Manifest,
			},
			InstalledVersion: plugin.Manifest.Version,
		}
	}

	return nil
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

func (a *App) getPluginsFromFolder() (map[string]*pluginSignaturePath, *model.AppError) {
	fileStorePaths, appErr := a.ListDirectory(fileStorePluginFolder)
	if appErr != nil {
		return nil, model.NewAppError("getPluginsFromDir", "app.plugin.sync.list_filestore.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return getPluginsFromFilePaths(fileStorePaths), nil
}

func getPluginsFromFilePaths(fileStorePaths []string) map[string]*pluginSignaturePath {
	pluginSignaturePathMap := make(map[string]*pluginSignaturePath)
	for _, path := range fileStorePaths {
		if strings.HasSuffix(path, ".tar.gz") {
			id := strings.TrimSuffix(filepath.Base(path), ".tar.gz")
			helper := &pluginSignaturePath{
				pluginId:      id,
				path:          path,
				signaturePath: "",
			}
			pluginSignaturePathMap[id] = helper
		}
	}
	for _, path := range fileStorePaths {
		if strings.HasSuffix(path, ".tar.gz.sig") {
			id := strings.TrimSuffix(filepath.Base(path), ".tar.gz.sig")
			if val, ok := pluginSignaturePathMap[id]; !ok {
				mlog.Error("Unknown signature", mlog.String("path", path))
			} else {
				val.signaturePath = path
			}
		}
	}

	return pluginSignaturePathMap
}

func (a *App) processPrepackagedPlugins(pluginsDir string) []*plugin.PrepackagedPlugin {
	prepackagedPluginsDir, found := fileutils.FindDir(pluginsDir)
	if !found {
		return nil
	}

	fileStorePaths := []string{}
	err := filepath.Walk(prepackagedPluginsDir, func(walkPath string, info os.FileInfo, err error) error {
		fileStorePaths = append(fileStorePaths, walkPath)
		return nil
	})
	if err != nil {
		mlog.Error("Failed to walk prepackaged plugins", mlog.Err(err))
		return nil
	}

	pluginSignaturePathMap := getPluginsFromFilePaths(fileStorePaths)
	plugins := make([]*plugin.PrepackagedPlugin, 0, len(pluginSignaturePathMap))
	for _, pluginPaths := range pluginSignaturePathMap {
		plugin, err := a.processPrepackagedPlugin(pluginPaths)
		if err != nil {
			mlog.Error("Failed to install prepackaged plugin", mlog.String("path", pluginPaths.path), mlog.Err(err))
			continue
		}

		plugins = append(plugins, plugin)
	}

	return plugins
}

// processPrepackagedPlugin will return the prepackaged plugin metadata and will also
// install the prepackaged plugin if it had been previously enabled and AutomaticPrepackagedPlugins is true.
func (a *App) processPrepackagedPlugin(pluginPath *pluginSignaturePath) (*plugin.PrepackagedPlugin, error) {
	mlog.Debug("Processing prepackaged plugin", mlog.String("path", pluginPath.path))

	fileReader, err := os.Open(pluginPath.path)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to open prepackaged plugin %s", pluginPath.path)
	}
	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, errors.Wrap(err, "Failed to create temp dir plugintmp")
	}
	defer os.RemoveAll(tmpDir)

	plugin, pluginDir, err := getPrepackagedPlugin(pluginPath, fileReader, tmpDir)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to get prepackaged plugin %s", pluginPath.path)
	}

	// Skip installing the plugin at all if automatic prepackaged plugins is disabled
	if !*a.Config().PluginSettings.AutomaticPrepackagedPlugins {
		return plugin, nil
	}

	// Skip installing if the plugin is has not been previously enabled.
	pluginState := a.Config().PluginSettings.PluginStates[plugin.Manifest.Id]
	if pluginState == nil || !pluginState.Enable {
		return plugin, nil
	}

	mlog.Debug("Installing prepackaged plugin", mlog.String("path", pluginPath.path))
	if _, err := a.installExtractedPlugin(plugin.Manifest, pluginDir, installPluginLocallyOnlyIfNewOrUpgrade); err != nil {
		return nil, errors.Wrapf(err, "Failed to install extracted prepackaged plugin %s", pluginPath.path)
	}

	return plugin, nil
}

// getPrepackagedPlugin builds a PrepackagedPlugin from the plugin at the given path, additionally returning the directory in which it was extracted.
func getPrepackagedPlugin(pluginPath *pluginSignaturePath, pluginFile io.ReadSeeker, tmpDir string) (*plugin.PrepackagedPlugin, string, error) {
	manifest, pluginDir, appErr := extractPlugin(pluginFile, tmpDir)
	if appErr != nil {
		return nil, "", errors.Wrapf(appErr, "Failed to extract plugin with path %s", pluginPath.path)
	}

	plugin := new(plugin.PrepackagedPlugin)
	plugin.Manifest = manifest
	plugin.Path = pluginPath.path

	if pluginPath.signaturePath != "" {
		sig := pluginPath.signaturePath
		sigReader, sigErr := os.Open(sig)
		if sigErr != nil {
			return nil, "", errors.Wrapf(sigErr, "Failed to open prepackaged plugin signature %s", sig)
		}
		bytes, sigErr := ioutil.ReadAll(sigReader)
		if sigErr != nil {
			return nil, "", errors.Wrapf(sigErr, "Failed to read prepackaged plugin signature %s", sig)
		}
		plugin.Signature = bytes
	}

	if manifest.IconPath != "" {
		iconData, err := getIcon(filepath.Join(pluginDir, manifest.IconPath))
		if err != nil {
			return nil, "", errors.Wrapf(err, "Failed to read icon at %s", manifest.IconPath)
		}
		plugin.IconData = iconData
	}

	return plugin, pluginDir, nil
}

func getIcon(iconPath string) (string, error) {
	icon, err := ioutil.ReadFile(iconPath)
	if err != nil {
		return "", errors.Wrapf(err, "failed to open icon at path %s", iconPath)
	}
	if !svg.Is(icon) {
		return "", errors.Wrapf(err, "icon is not svg %s", iconPath)
	}
	return fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(icon)), nil
}
