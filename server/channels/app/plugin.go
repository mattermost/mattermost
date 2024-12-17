// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"github.com/blang/semver/v4"
	svg "github.com/h2non/go-is-svg"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/platform/services/marketplace"
)

// prepackagedPluginsDir is the hard-coded folder name where prepackaged plugins are bundled
// alongside the server.
const prepackagedPluginsDir = "prepackaged_plugins"

// pluginSignaturePath tracks the path to the plugin bundle and signature for the given plugin.
type pluginSignaturePath struct {
	pluginID      string
	bundlePath    string
	signaturePath string
}

// GetPluginsEnvironment returns the plugin environment for use if plugins are enabled and
// initialized.
//
// To get the plugins environment when the plugins are disabled, manually acquire the plugins
// lock instead.
func (ch *Channels) GetPluginsEnvironment() *plugin.Environment {
	if !*ch.cfgSvc.Config().PluginSettings.Enable {
		return nil
	}

	ch.pluginsLock.RLock()
	defer ch.pluginsLock.RUnlock()

	return ch.pluginsEnvironment
}

// GetPluginsEnvironment returns the plugin environment for use if plugins are enabled and
// initialized.
//
// To get the plugins environment when the plugins are disabled, manually acquire the plugins
// lock instead.
func (a *App) GetPluginsEnvironment() *plugin.Environment {
	return a.ch.GetPluginsEnvironment()
}

func (ch *Channels) SetPluginsEnvironment(pluginsEnvironment *plugin.Environment) {
	ch.pluginsLock.Lock()
	defer ch.pluginsLock.Unlock()

	ch.pluginsEnvironment = pluginsEnvironment
	ch.srv.Platform().SetPluginsEnvironment(ch)
}

func (ch *Channels) syncPluginsActiveState() {
	// Acquiring lock manually, as plugins might be disabled. See GetPluginsEnvironment.
	ch.pluginsLock.RLock()
	pluginsEnvironment := ch.pluginsEnvironment
	ch.pluginsLock.RUnlock()

	if pluginsEnvironment == nil {
		return
	}

	config := ch.cfgSvc.Config().PluginSettings

	if *config.Enable {
		availablePlugins, err := pluginsEnvironment.Available()
		if err != nil {
			ch.srv.Log().Error("Unable to get available plugins", mlog.Err(err))
			return
		}

		// Determine which plugins need to be activated or deactivated.
		disabledPlugins := []*model.BundleInfo{}
		enabledPlugins := []*model.BundleInfo{}
		for _, plugin := range availablePlugins {
			pluginID := plugin.Manifest.Id
			pluginEnabled := false
			if state, ok := config.PluginStates[pluginID]; ok {
				pluginEnabled = state.Enable
			}

			if hasOverride, value := ch.getPluginStateOverride(pluginID); hasOverride {
				pluginEnabled = value
			}

			if pluginEnabled {
				enabledPlugins = append(enabledPlugins, plugin)
			} else {
				disabledPlugins = append(disabledPlugins, plugin)
			}
		}

		// Concurrently activate/deactivate each plugin appropriately.
		var wg sync.WaitGroup

		// Deactivate any plugins that have been disabled.
		for _, plugin := range disabledPlugins {
			wg.Add(1)
			go func(plugin *model.BundleInfo) {
				defer wg.Done()

				deactivated := pluginsEnvironment.Deactivate(plugin.Manifest.Id)
				if deactivated && plugin.Manifest.HasClient() {
					message := model.NewWebSocketEvent(model.WebsocketEventPluginDisabled, "", "", "", nil, "")
					message.Add("manifest", plugin.Manifest.ClientManifest())
					ch.srv.platform.Publish(message)
				}
			}(plugin)
		}

		// Activate any plugins that have been enabled
		for _, plugin := range enabledPlugins {
			wg.Add(1)
			go func(plugin *model.BundleInfo) {
				defer wg.Done()

				pluginID := plugin.Manifest.Id
				logger := ch.srv.Log().With(mlog.String("plugin_id", pluginID), mlog.String("bundle_path", plugin.Path))

				updatedManifest, activated, err := pluginsEnvironment.Activate(pluginID)
				if err != nil {
					logger.Error("Unable to activate plugin", mlog.Err(err))
					return
				}

				if activated {
					// Notify all cluster clients if ready
					if err := ch.notifyPluginEnabled(updatedManifest); err != nil {
						logger.Error("Failed to notify cluster on plugin enable", mlog.Err(err))
					}
				}
			}(plugin)
		}
		wg.Wait()
	} else { // If plugins are disabled, shutdown plugins.
		pluginsEnvironment.Shutdown()
	}

	if err := ch.notifyPluginStatusesChanged(); err != nil {
		ch.srv.Log().Warn("failed to notify plugin status changed", mlog.Err(err))
	}
}

func (a *App) NewPluginAPI(c request.CTX, manifest *model.Manifest) plugin.API {
	return NewPluginAPI(a, c, manifest)
}

func (a *App) InitPlugins(c request.CTX, pluginDir, webappPluginDir string) {
	a.ch.initPlugins(c, pluginDir, webappPluginDir)
}

func (ch *Channels) initPlugins(c request.CTX, pluginDir, webappPluginDir string) {
	// Acquiring lock manually, as plugins might be disabled. See GetPluginsEnvironment.
	defer func() {
		ch.srv.Platform().SetPluginsEnvironment(ch)
	}()

	ch.pluginsLock.RLock()
	pluginsEnvironment := ch.pluginsEnvironment
	ch.pluginsLock.RUnlock()
	if pluginsEnvironment != nil || !*ch.cfgSvc.Config().PluginSettings.Enable {
		ch.syncPluginsActiveState()
		if pluginsEnvironment != nil {
			pluginsEnvironment.TogglePluginHealthCheckJob(*ch.cfgSvc.Config().PluginSettings.EnableHealthCheck)
		}
		return
	}

	ch.srv.Log().Info("Starting up plugins")

	if err := os.Mkdir(pluginDir, 0744); err != nil && !os.IsExist(err) {
		ch.srv.Log().Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	if err := os.Mkdir(webappPluginDir, 0744); err != nil && !os.IsExist(err) {
		ch.srv.Log().Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	newAPIFunc := func(manifest *model.Manifest) plugin.API {
		return New(ServerConnector(ch)).NewPluginAPI(c, manifest)
	}

	env, err := plugin.NewEnvironment(
		newAPIFunc,
		NewDriverImpl(ch.srv),
		pluginDir,
		webappPluginDir,
		ch.srv.Log(),
		ch.srv.GetMetrics(),
	)
	if err != nil {
		ch.srv.Log().Error("Failed to start up plugins", mlog.Err(err))
		return
	}
	ch.pluginsLock.Lock()
	ch.pluginsEnvironment = env
	ch.pluginsLock.Unlock()

	ch.pluginsEnvironment.TogglePluginHealthCheckJob(*ch.cfgSvc.Config().PluginSettings.EnableHealthCheck)

	if err := ch.syncPlugins(); err != nil {
		ch.srv.Log().Error("Failed to sync plugins from the file store", mlog.Err(err))
	}

	if err := ch.processPrepackagedPlugins(prepackagedPluginsDir); err != nil {
		ch.srv.Log().Error("Failed to process prepackaged plugins", mlog.Err(err))
	}
	ch.pluginClusterLeaderListenerID = ch.srv.AddClusterLeaderChangedListener(func() {
		ch.persistTransitionallyPrepackagedPlugins()
	})
	ch.persistTransitionallyPrepackagedPlugins()

	// Sync plugin active state when config changes. Also notify plugins.
	ch.pluginsLock.Lock()
	ch.RemoveConfigListener(ch.pluginConfigListenerID)
	ch.pluginConfigListenerID = ch.AddConfigListener(func(old, new *model.Config) {
		// If plugin status remains unchanged, only then run this.
		// Because (*App).InitPlugins is already run as a config change hook.
		if *old.PluginSettings.Enable == *new.PluginSettings.Enable {
			ch.syncPluginsActiveState()
		}

		ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			if err := hooks.OnConfigurationChange(); err != nil {
				ch.srv.Log().Error("Plugin OnConfigurationChange hook failed", mlog.Err(err))
			}
			return true
		}, plugin.OnConfigurationChangeID)
	})
	ch.pluginsLock.Unlock()

	ch.syncPluginsActiveState()
}

// SyncPlugins synchronizes the plugins installed locally
// with the plugin bundles available in the file store.
func (a *App) SyncPlugins() *model.AppError {
	return a.ch.syncPlugins()
}

// SyncPlugins synchronizes the plugins installed locally
// with the plugin bundles available in the file store.
func (ch *Channels) syncPlugins() *model.AppError {
	ch.srv.Log().Info("Syncing plugins from the file store")

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("SyncPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("SyncPlugins", "app.plugin.sync.read_local_folder.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var wg sync.WaitGroup
	for _, plugin := range availablePlugins {
		wg.Add(1)
		go func(pluginID string) {
			defer wg.Done()

			logger := ch.srv.Log().With(mlog.String("plugin_id", pluginID))

			// Only handle managed plugins with .filestore flag file.
			_, err := os.Stat(filepath.Join(*ch.cfgSvc.Config().PluginSettings.Directory, pluginID, managedPluginFileName))
			if os.IsNotExist(err) {
				logger.Warn("Skipping sync for unmanaged plugin")
			} else if err != nil {
				logger.Error("Skipping sync for plugin after failure to check if managed", mlog.Err(err))
			} else {
				logger.Info("Removing local installation of managed plugin before sync")
				if err := ch.removePluginLocally(pluginID); err != nil {
					logger.Error("Failed to remove local installation of managed plugin before sync", mlog.Err(err))
				}
			}
		}(plugin.Manifest.Id)
	}
	wg.Wait()

	// Install plugins from the file store.
	pluginSignaturePathMap, appErr := ch.getPluginsFromFolder()
	if appErr != nil {
		return appErr
	}

	if len(pluginSignaturePathMap) == 0 {
		ch.srv.Log().Info("No plugins to sync from the file store")
		return nil
	}

	for _, plugin := range pluginSignaturePathMap {
		wg.Add(1)
		go func(plugin *pluginSignaturePath) {
			defer wg.Done()
			logger := ch.srv.Log().With(mlog.String("plugin_id", plugin.pluginID), mlog.String("bundle_path", plugin.bundlePath))

			bundle, appErr := ch.srv.fileReader(plugin.bundlePath)
			if appErr != nil {
				logger.Error("Failed to open plugin bundle from file store.", mlog.Err(appErr))
				return
			}
			defer bundle.Close()

			if *ch.cfgSvc.Config().PluginSettings.RequirePluginSignature {
				signature, appErr := ch.srv.fileReader(plugin.signaturePath)
				if appErr != nil {
					logger.Error("Failed to open plugin signature from file store.", mlog.Err(appErr))
					return
				}
				defer signature.Close()

				if appErr = ch.verifyPlugin(bundle, signature); appErr != nil {
					logger.Error("Failed to validate plugin signature", mlog.Err(appErr))
					return
				}
			}

			logger.Info("Syncing plugin from file store")
			if _, err := ch.installPluginLocally(bundle, installPluginLocallyAlways); err != nil && err.Id != "app.plugin.skip_installation.app_error" {
				logger.Error("Failed to sync plugin from file store", mlog.Err(err))
			}
		}(plugin)
	}

	wg.Wait()
	return nil
}

func (ch *Channels) ShutDownPlugins() {
	// Acquiring lock manually, as plugins might be disabled. See GetPluginsEnvironment.
	ch.pluginsLock.RLock()
	pluginsEnvironment := ch.pluginsEnvironment
	ch.pluginsLock.RUnlock()
	if pluginsEnvironment == nil {
		return
	}

	ch.srv.Log().Info("Shutting down plugins")

	pluginsEnvironment.Shutdown()

	ch.RemoveConfigListener(ch.pluginConfigListenerID)
	ch.pluginConfigListenerID = ""
	ch.srv.RemoveClusterLeaderChangedListener(ch.pluginClusterLeaderListenerID)
	ch.pluginClusterLeaderListenerID = ""

	// Acquiring lock manually before cleaning up PluginsEnvironment.
	ch.pluginsLock.Lock()
	defer ch.pluginsLock.Unlock()
	if ch.pluginsEnvironment == pluginsEnvironment {
		ch.pluginsEnvironment = nil
	} else {
		ch.srv.Log().Warn("Another PluginsEnvironment detected while shutting down plugins.")
	}
}

func (a *App) getPluginManifests() ([]*model.Manifest, error) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("GetPluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get list of available plugins")
	}

	manifests := make([]*model.Manifest, len(plugins))
	for i := range plugins {
		manifests[i] = plugins[i].Manifest
	}

	return manifests, nil
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
	return a.ch.enablePlugin(id)
}

func (ch *Channels) enablePlugin(id string) *model.AppError {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("EnablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	ch.cfgSvc.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: true}
	})

	// This call will implicitly invoke SyncPluginsActiveState which will activate enabled plugins.
	if _, _, err := ch.cfgSvc.SaveConfig(ch.cfgSvc.Config(), true); err != nil {
		if err.Id == "ent.cluster.save_config.error" {
			return model.NewAppError("EnablePlugin", "app.plugin.cluster.save_config.app_error", nil, "", http.StatusInternalServerError)
		}
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// DisablePlugin will set the config for an installed plugin to disabled, triggering deactivation if active.
// Notifies cluster peers through config change.
func (a *App) DisablePlugin(id string) *model.AppError {
	appErr := a.ch.disablePlugin(id)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (ch *Channels) disablePlugin(id string) *model.AppError {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("DisablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

	ch.cfgSvc.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: false}
	})
	ch.unregisterPluginCommands(id)

	// This call will implicitly invoke SyncPluginsActiveState which will deactivate disabled plugins.
	if _, _, err := ch.cfgSvc.SaveConfig(ch.cfgSvc.Config(), true); err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return nil, model.NewAppError("GetPlugins", "app.plugin.get_plugins.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
func (a *App) GetMarketplacePlugins(rctx request.CTX, filter *model.MarketplacePluginFilter) ([]*model.MarketplacePlugin, *model.AppError) {
	plugins := map[string]*model.MarketplacePlugin{}

	if *a.Config().PluginSettings.EnableRemoteMarketplace && !filter.LocalOnly {
		p, appErr := a.getRemotePlugins()
		if appErr != nil {
			return nil, appErr
		}
		plugins = p
	}

	if !filter.RemoteOnly {
		appErr := a.mergePrepackagedPlugins(plugins)
		if appErr != nil {
			return nil, appErr
		}

		appErr = a.mergeLocalPlugins(rctx, plugins)
		if appErr != nil {
			return nil, appErr
		}
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
//
// If version is empty, the first matching plugin is returned.
func (ch *Channels) getPrepackagedPlugin(pluginID, version string) (*plugin.PrepackagedPlugin, *model.AppError) {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("getPrepackagedPlugin", "app.plugin.config.app_error", nil, "plugin environment is nil", http.StatusInternalServerError)
	}

	prepackagedPlugins := pluginsEnvironment.PrepackagedPlugins()
	for _, p := range prepackagedPlugins {
		if p.Manifest.Id == pluginID && (version == "" || p.Manifest.Version == version) {
			return p, nil
		}
	}

	return nil, model.NewAppError("getPrepackagedPlugin", "app.plugin.marketplace_plugins.not_found.app_error", nil, "", http.StatusInternalServerError)
}

// getRemoteMarketplacePlugin returns plugin from marketplace-server.
//
// If version is empty, the latest compatible version is used.
func (ch *Channels) getRemoteMarketplacePlugin(pluginID, version string) (*model.BaseMarketplacePlugin, *model.AppError) {
	marketplaceClient, err := marketplace.NewClient(
		*ch.cfgSvc.Config().PluginSettings.MarketplaceURL,
		ch.srv.HTTPService(),
	)
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugin", "app.plugin.marketplace_client.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	filter := ch.getBaseMarketplaceFilter()
	filter.PluginId = pluginID

	var plugin *model.BaseMarketplacePlugin
	if version != "" {
		plugin, err = marketplaceClient.GetPlugin(filter, version)
	} else {
		plugin, err = marketplaceClient.GetLatestPlugin(filter)
	}
	if err != nil {
		return nil, model.NewAppError("GetMarketplacePlugin", "app.plugin.marketplace_plugins.not_found.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return plugin, nil
}

func (a *App) getRemotePlugins() (map[string]*model.MarketplacePlugin, *model.AppError) {
	result := map[string]*model.MarketplacePlugin{}

	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	marketplaceClient, err := marketplace.NewClient(
		*a.Config().PluginSettings.MarketplaceURL,
		a.HTTPService(),
	)
	if err != nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.marketplace_client.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	filter := a.getBaseMarketplaceFilter()
	// Fetch all plugins from marketplace.
	filter.PerPage = -1

	marketplacePlugins, err := marketplaceClient.GetPlugins(filter)
	if err != nil {
		return nil, model.NewAppError("getRemotePlugins", "app.plugin.marketplace_client.failed_to_fetch", nil, "", http.StatusInternalServerError).Wrap(err)
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

	isEnterpriseLicense := a.License() != nil && a.License().IsE20OrEnterprise()
	for _, prepackaged := range pluginsEnvironment.PrepackagedPlugins() {
		if prepackaged.Manifest == nil {
			continue
		}

		prepackagedMarketplace := &model.MarketplacePlugin{
			BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
				HomepageURL:     prepackaged.Manifest.HomepageURL,
				IconData:        prepackaged.IconData,
				ReleaseNotesURL: prepackaged.Manifest.ReleaseNotesURL,
				Manifest:        prepackaged.Manifest,
			},
		}

		// If not enterprise, check version.
		// Playbooks is not listed in the marketplace, this only handles prepackaged.
		if !isEnterpriseLicense {
			if prepackaged.Manifest.Id == model.PluginIdPlaybooks {
				version, err := semver.Parse(prepackaged.Manifest.Version)
				if err != nil {
					mlog.Error("Unable to verify prepackaged playbooks version", mlog.Err(err))
					continue
				}
				// Do not show playbooks >=v2 if we do not have an enterprise license
				if version.GTE(SemVerV2) {
					continue
				}
			}
		}

		// If not available in marketplace, add the prepackaged
		if remoteMarketplacePlugins[prepackaged.Manifest.Id] == nil {
			remoteMarketplacePlugins[prepackaged.Manifest.Id] = prepackagedMarketplace
			continue
		}

		// If available in the marketplace, only overwrite if newer.
		prepackagedVersion, err := semver.Parse(prepackaged.Manifest.Version)
		if err != nil {
			return model.NewAppError("mergePrepackagedPlugins", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}

		marketplacePlugin := remoteMarketplacePlugins[prepackaged.Manifest.Id]
		marketplaceVersion, err := semver.Parse(marketplacePlugin.Manifest.Version)
		if err != nil {
			return model.NewAppError("mergePrepackagedPlugins", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}

		if prepackagedVersion.GT(marketplaceVersion) {
			remoteMarketplacePlugins[prepackaged.Manifest.Id] = prepackagedMarketplace
		}
	}

	return nil
}

// mergeLocalPlugins merges locally installed plugins to remote marketplace plugins list.
func (a *App) mergeLocalPlugins(rctx request.CTX, remoteMarketplacePlugins map[string]*model.MarketplacePlugin) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError)
	}

	localPlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("GetMarketplacePlugins", "app.plugin.config.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
				rctx.Logger().Warn("Error loading local plugin icon", mlog.String("plugin_id", plugin.Manifest.Id), mlog.String("icon_path", plugin.Manifest.IconPath), mlog.Err(err))
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
				HomepageURL:     plugin.Manifest.HomepageURL,
				IconData:        iconData,
				ReleaseNotesURL: plugin.Manifest.ReleaseNotesURL,
				Labels:          labels,
				Manifest:        plugin.Manifest,
			},
			InstalledVersion: plugin.Manifest.Version,
		}
	}

	return nil
}

func (a *App) getBaseMarketplaceFilter() *model.MarketplacePluginFilter {
	return a.ch.getBaseMarketplaceFilter()
}

func (ch *Channels) getBaseMarketplaceFilter() *model.MarketplacePluginFilter {
	filter := &model.MarketplacePluginFilter{
		ServerVersion: model.CurrentVersion,
	}

	license := ch.srv.License()
	if license != nil && license.HasEnterpriseMarketplacePlugins() {
		filter.EnterprisePlugins = true
	}

	if license != nil && license.IsCloud() {
		filter.Cloud = true
	}

	if model.BuildEnterpriseReady == "true" {
		filter.BuildEnterpriseReady = true
	}

	filter.Platform = runtime.GOOS + "-" + runtime.GOARCH

	return filter
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
func (ch *Channels) notifyPluginEnabled(manifest *model.Manifest) error {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return errors.New("pluginsEnvironment is nil")
	}
	if !manifest.HasClient() || !pluginsEnvironment.IsActive(manifest.Id) {
		return nil
	}

	var statuses model.PluginStatuses

	if ch.srv.platform.Cluster() != nil {
		var err *model.AppError
		statuses, err = ch.srv.platform.Cluster().GetPluginStatuses()
		if err != nil {
			return err
		}
	}

	localStatus, err := ch.GetPluginStatus(manifest.Id)
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
			ch.srv.Log().Debug("Not ready to notify webclients", mlog.String("cluster_id", status.ClusterId), mlog.String("plugin_id", manifest.Id))
			return nil
		}
	}

	// Notify all cluster peer clients.
	message := model.NewWebSocketEvent(model.WebsocketEventPluginEnabled, "", "", "", nil, "")
	message.Add("manifest", manifest.ClientManifest())
	ch.srv.platform.Publish(message)

	return nil
}

func (ch *Channels) getPluginsFromFolder() (map[string]*pluginSignaturePath, *model.AppError) {
	fileStorePaths, appErr := ch.srv.listDirectory(fileStorePluginFolder, false)
	if appErr != nil {
		return nil, model.NewAppError("getPluginsFromDir", "app.plugin.sync.list_filestore.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return ch.getPluginsFromFilePaths(fileStorePaths), nil
}

func (ch *Channels) getPluginsFromFilePaths(fileStorePaths []string) map[string]*pluginSignaturePath {
	pluginSignaturePathMap := make(map[string]*pluginSignaturePath)
	for _, path := range fileStorePaths {
		if strings.HasSuffix(path, ".tar.gz") {
			id := strings.TrimSuffix(filepath.Base(path), ".tar.gz")
			helper := &pluginSignaturePath{
				pluginID:      id,
				bundlePath:    path,
				signaturePath: "",
			}
			pluginSignaturePathMap[id] = helper
		}
	}
	for _, path := range fileStorePaths {
		if strings.HasSuffix(path, ".tar.gz.sig") {
			id := strings.TrimSuffix(filepath.Base(path), ".tar.gz.sig")
			if val, ok := pluginSignaturePathMap[id]; !ok {
				ch.srv.Log().Warn("Unknown signature", mlog.String("path", path))
			} else {
				val.signaturePath = path
			}
		}
	}

	return pluginSignaturePathMap
}

// processPrepackagedPlugins processes the plugins prepackaged with this server in the
// prepackaged_plugins directory.
//
// If enabled, prepackaged plugins are installed or upgraded locally. A list of transitionally
// prepackaged plugins is also collected for later persistence to the filestore.
func (ch *Channels) processPrepackagedPlugins(prepackagedPluginsDir string) error {
	prepackagedPluginsPath, found := fileutils.FindDir(prepackagedPluginsDir)
	if !found {
		ch.srv.Log().Debug("No prepackaged plugins directory found")
		return nil
	}

	ch.srv.Log().Debug("Processing prepackaged plugins in directory", mlog.String("path", prepackagedPluginsPath))

	var fileStorePaths []string
	err := filepath.Walk(prepackagedPluginsPath, func(walkPath string, info os.FileInfo, err error) error {
		fileStorePaths = append(fileStorePaths, walkPath)
		return nil
	})
	if err != nil {
		return errors.Wrap(err, "failed to walk prepackaged plugins")
	}

	pluginSignaturePathMap := ch.getPluginsFromFilePaths(fileStorePaths)
	plugins := make(chan *plugin.PrepackagedPlugin, len(pluginSignaturePathMap))

	// Before processing any prepackaged plugins, take a snapshot of the available manifests
	// to decide what was synced from the filestore.
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return errors.New("pluginsEnvironment is nil")
	}

	availablePlugins, err := pluginsEnvironment.Available()
	if err != nil {
		return errors.Wrap(err, "failed to list available plugins")
	}

	availablePluginsMap := make(map[string]*model.BundleInfo, len(availablePlugins))
	for _, bundleInfo := range availablePlugins {
		availablePluginsMap[bundleInfo.Manifest.Id] = bundleInfo
	}

	var wg sync.WaitGroup
	for _, psPath := range pluginSignaturePathMap {
		wg.Add(1)
		go func(psPath *pluginSignaturePath) {
			defer wg.Done()
			p, err := ch.processPrepackagedPlugin(psPath)
			if err != nil {
				var appErr *model.AppError
				if errors.As(err, &appErr) && appErr.Id == "app.plugin.skip_installation.app_error" {
					return
				}
				ch.srv.Log().Error("Failed to install prepackaged plugin", mlog.String("bundle_path", psPath.bundlePath), mlog.Err(err))
				return
			}

			plugins <- p
		}(psPath)
	}

	wg.Wait()
	close(plugins)

	prepackagedPlugins := make([]*plugin.PrepackagedPlugin, 0, len(pluginSignaturePathMap))
	transitionallyPrepackagedPlugins := make([]*plugin.PrepackagedPlugin, 0)
	for p := range plugins {
		if ch.pluginIsTransitionallyPrepackaged(p.Manifest) {
			if ch.shouldPersistTransitionallyPrepackagedPlugin(availablePluginsMap, p) {
				transitionallyPrepackagedPlugins = append(transitionallyPrepackagedPlugins, p)
			}
		} else {
			prepackagedPlugins = append(prepackagedPlugins, p)
		}
	}

	pluginsEnvironment.SetPrepackagedPlugins(prepackagedPlugins, transitionallyPrepackagedPlugins)

	return nil
}

var SemVerV2 = semver.MustParse("2.0.0")

// processPrepackagedPlugin will return the prepackaged plugin metadata and will also
// install the prepackaged plugin if it had been previously enabled and AutomaticPrepackagedPlugins is true.
func (ch *Channels) processPrepackagedPlugin(pluginPath *pluginSignaturePath) (*plugin.PrepackagedPlugin, error) {
	logger := ch.srv.Log().With(mlog.String("bundle_path", pluginPath.bundlePath))

	logger.Info("Processing prepackaged plugin")

	fileReader, err := os.Open(pluginPath.bundlePath)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to open prepackaged plugin %s", pluginPath.bundlePath)
	}
	defer fileReader.Close()

	tmpDir, err := os.MkdirTemp("", "plugintmp")
	if err != nil {
		return nil, errors.Wrap(err, "Failed to create temp dir plugintmp")
	}
	defer os.RemoveAll(tmpDir)

	plugin, pluginDir, err := ch.buildPrepackagedPlugin(pluginPath, fileReader, tmpDir)
	if err != nil {
		return nil, errors.Wrapf(err, "Failed to get prepackaged plugin %s", pluginPath.bundlePath)
	}

	logger = logger.With(mlog.String("plugin_id", plugin.Manifest.Id))

	if plugin.Manifest.Id == model.PluginIdPlaybooks {
		version, err := semver.Parse(plugin.Manifest.Version)
		if err != nil {
			return nil, errors.Wrapf(err, "Unable to verify prepackaged playbooks version")
		}
		license := ch.License()
		hasEnterpriseLicense := license != nil && license.IsE20OrEnterprise()

		// Do not install playbooks >=v2 if we do not have an enterprise license
		if version.GTE(SemVerV2) && !hasEnterpriseLicense {
			logger.Info("Skip installing prepackaged playbooks >=v2 because the license does not allow it")
			return plugin, nil
		}

		// Do not install playbooks <v2 if we have an enterprise license
		if version.LT(SemVerV2) && hasEnterpriseLicense {
			logger.Info("Skip installing prepackaged playbooks <v2 because the license allows v2")
			return plugin, nil
		}
	}

	// Skip installing the plugin at all if automatic prepackaged plugins is disabled
	if !*ch.cfgSvc.Config().PluginSettings.AutomaticPrepackagedPlugins {
		logger.Info("Not installing prepackaged plugin: automatic prepackaged plugins disabled")
		return plugin, nil
	}

	// Skip installing if the plugin is has not been previously enabled.
	pluginState := ch.cfgSvc.Config().PluginSettings.PluginStates[plugin.Manifest.Id]
	if pluginState == nil || !pluginState.Enable {
		logger.Info("Not installing prepackaged plugin: not previously enabled")
		return plugin, nil
	}

	if _, err := ch.installExtractedPlugin(plugin.Manifest, pluginDir, installPluginLocallyOnlyIfNewOrUpgrade); err != nil && err.Id != "app.plugin.skip_installation.app_error" {
		return nil, errors.Wrapf(err, "Failed to install extracted prepackaged plugin %s", pluginPath.bundlePath)
	}

	return plugin, nil
}

var transitionallyPrepackagedPlugins = []string{
	"antivirus",
	"focalboard",
	"mattermost-autolink",
	"com.mattermost.aws-sns",
	"com.mattermost.plugin-channel-export",
	"com.mattermost.confluence",
	"com.mattermost.custom-attributes",
	"jenkins",
	"jitsi",
	"com.mattermost.plugin-todo",
	"com.mattermost.welcomebot",
	"com.mattermost.apps",
	"playbooks",
}

// pluginIsTransitionallyPrepackaged identifies plugin ids that are currently prepackaged but
// slated for future removal.
func (ch *Channels) pluginIsTransitionallyPrepackaged(m *model.Manifest) bool {
	for _, id := range transitionallyPrepackagedPlugins {
		if id == m.Id {
			if m.Id == model.PluginIdPlaybooks {
				return ch.playbooksIsTransitionallyPrepackaged(m)
			}

			return true
		}
	}

	return false
}

// playbooksIsTransitionallyPrepackaged determines if the playbooks plugin is transitionally prepackaged.
// conditions are:
// - the server is not enterprise licensed
// - the playbooks version is <v2
func (ch *Channels) playbooksIsTransitionallyPrepackaged(m *model.Manifest) bool {
	license := ch.srv.License()
	isNotEnterpriseLicensed := !(license != nil && license.IsE20OrEnterprise())
	version, err := semver.Parse(m.Version)
	if err != nil {
		ch.srv.Log().Warn("unable to parse prepackaged playbooks version - not marking it as transitional.", mlog.String("version", m.Version), mlog.Err(err))
		return false
	}

	return isNotEnterpriseLicensed && version.LT(SemVerV2)
}

// shouldPersistTransitionallyPrepackagedPlugin determines if a transitionally prepackaged plugin
// should be persisted to the filestore, taking into account whether it's already enabled and
// would improve on what's already in the filestore.
func (ch *Channels) shouldPersistTransitionallyPrepackagedPlugin(availablePluginsMap map[string]*model.BundleInfo, p *plugin.PrepackagedPlugin) bool {
	logger := ch.srv.Log().With(mlog.String("plugin_id", p.Manifest.Id), mlog.String("prepackaged_version", p.Manifest.Version))

	// Ignore the plugin altogether unless it was previously enabled.
	pluginState := ch.cfgSvc.Config().PluginSettings.PluginStates[p.Manifest.Id]
	if pluginState == nil || !pluginState.Enable {
		logger.Debug("Should not persist transitionally prepackaged plugin: not previously enabled")
		return false
	}

	// Ignore the plugin if the same or newer version is already available
	// (having previously synced from the filestore).
	existing, found := availablePluginsMap[p.Manifest.Id]
	if !found {
		logger.Info("Should persist transitionally prepackaged plugin: not currently in filestore")
		return true
	}

	prepackagedVersion, err := semver.Parse(p.Manifest.Version)
	if err != nil {
		logger.Error("Should not persist transitionally prepackged plugin: invalid prepackaged version", mlog.Err(err))
		return false
	}

	logger = logger.With(mlog.String("existing_version", existing.Manifest.Version))

	existingVersion, err := semver.Parse(existing.Manifest.Version)
	if err != nil {
		// Consider this an old version and replace with the prepackaged version instead.
		logger.Warn("Should persist transitionally prepackged plugin: invalid existing version", mlog.Err(err))
		return true
	}

	if prepackagedVersion.GT(existingVersion) {
		logger.Info("Should persist transitionally prepackged plugin: newer version")
		return true
	}

	logger.Info("Should not persist transitionally prepackged plugin: not a newer version")
	return false
}

// persistTransitionallyPrepackagedPlugins writes plugins that are transitionally prepackaged with
// the server to the filestore to allow their continued use when the plugin eventually stops being
// prepackaged.
//
// We identify which plugins need to be persisted during startup via processPrepackagedPlugins.
// Once we persist the set of plugins to the filestore, we clear the list to prevent this server
// from trying again.
//
// In a multi-server cluster, only the cluster leader should persist these plugins to avoid
// concurrent writes to the filestore. But during an upgrade, there's no guarantee that a freshly
// upgraded server will be the cluster leader to perform this step in a timely fashion, so the
// persistence has to be able to happen sometime after startup. Additionally, while this is a
// kind of migration, it's not a one off: new versions of these plugins may still be shipped
// during the transition period, or new plugins may be added to the list.
//
// So instead of a one-time migration, we opt to run this method every time the cluster leader
// changes, but minimizing rework. More than one server may end up persisting the same plugin
// (but never concurrently!), but all servers will eventually converge on this method becoming a
// no-op (until this set of plugins changes in a subsequent release).
//
// Finally, if an error occurs persisting the plugin, we don't try again until the server restarts,
// or another server becomes cluster leader.
func (ch *Channels) persistTransitionallyPrepackagedPlugins() {
	if !ch.srv.IsLeader() {
		ch.srv.Log().Debug("Not persisting transitionally prepackaged plugins: not the leader")
		return
	}

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		ch.srv.Log().Debug("Not persisting transitionally prepackaged plugins: no plugin environment")
		return
	}

	transitionallyPrepackagedPlugins := pluginsEnvironment.TransitionallyPrepackagedPlugins()
	if len(transitionallyPrepackagedPlugins) == 0 {
		ch.srv.Log().Debug("Not persisting transitionally prepackaged plugins: none found")
		return
	}

	var wg sync.WaitGroup
	for _, p := range transitionallyPrepackagedPlugins {
		wg.Add(1)
		go func(p *plugin.PrepackagedPlugin) {
			defer wg.Done()

			logger := ch.srv.Log().With(mlog.String("plugin_id", p.Manifest.Id), mlog.String("version", p.Manifest.Version))

			logger.Info("Persisting transitionally prepackaged plugin")

			bundleReader, err := os.Open(p.Path)
			if err != nil {
				logger.Error("Failed to read transitionally prepackaged plugin", mlog.Err(err))
			}
			defer bundleReader.Close()

			signatureReader := bytes.NewReader(p.Signature)

			// Write the plugin to the filestore, but don't bother notifying the peers,
			// as there's no reason to reload the plugin to run the same version again.
			appErr := ch.installPluginToFilestore(p.Manifest, bundleReader, signatureReader)
			if appErr != nil {
				logger.Error("Failed to persist transitionally prepackaged plugin", mlog.Err(err))
			}
		}(p)
	}
	wg.Wait()

	pluginsEnvironment.ClearTransitionallyPrepackagedPlugins()
	ch.srv.Log().Info("Finished persisting transitionally prepackaged plugins")
}

// buildPrepackagedPlugin builds a PrepackagedPlugin from the plugin at the given path, additionally returning the directory in which it was extracted.
func (ch *Channels) buildPrepackagedPlugin(pluginPath *pluginSignaturePath, pluginFile io.ReadSeeker, tmpDir string) (*plugin.PrepackagedPlugin, string, error) {
	manifest, pluginDir, appErr := extractPlugin(pluginFile, tmpDir)
	if appErr != nil {
		return nil, "", errors.Wrapf(appErr, "Failed to extract plugin with path %s", pluginPath.bundlePath)
	}

	plugin := new(plugin.PrepackagedPlugin)
	plugin.Manifest = manifest
	plugin.Path = pluginPath.bundlePath

	if pluginPath.signaturePath != "" {
		sig := pluginPath.signaturePath
		sigReader, sigErr := os.Open(sig)
		if sigErr != nil {
			return nil, "", errors.Wrapf(sigErr, "Failed to open prepackaged plugin signature %s", sig)
		}
		bytes, sigErr := io.ReadAll(sigReader)
		if sigErr != nil {
			return nil, "", errors.Wrapf(sigErr, "Failed to read prepackaged plugin signature %s", sig)
		}
		plugin.Signature = bytes
	}

	if manifest.IconPath != "" {
		iconData, err := getIcon(filepath.Join(pluginDir, manifest.IconPath))
		if err != nil {
			ch.srv.Log().Warn("Error loading local plugin icon", mlog.String("plugin_id", plugin.Manifest.Id), mlog.String("icon_path", plugin.Manifest.IconPath), mlog.Err(err))
		}
		plugin.IconData = iconData
	}

	return plugin, pluginDir, nil
}

func getIcon(iconPath string) (string, error) {
	icon, err := os.ReadFile(iconPath)
	if err != nil {
		return "", errors.Wrapf(err, "failed to open icon at path %s", iconPath)
	}

	if !svg.Is(icon) {
		return "", errors.Errorf("icon is not svg %s", iconPath)
	}

	return fmt.Sprintf("data:image/svg+xml;base64,%s", base64.StdEncoding.EncodeToString(icon)), nil
}

func (ch *Channels) getPluginStateOverride(pluginID string) (bool, bool) {
	switch pluginID {
	case model.PluginIdApps:
		// Tie Apps proxy disabled status to the feature flag.
		if !ch.cfgSvc.Config().FeatureFlags.AppsEnabled {
			return true, false
		}
	}

	return false, false
}

func (a *App) IsPluginActive(pluginName string) (bool, error) {
	return a.Channels().IsPluginActive(pluginName)
}

func (ch *Channels) IsPluginActive(pluginName string) (bool, error) {
	pluginStatus, err := ch.GetPluginStatus(pluginName)
	if err != nil {
		return false, err
	}

	return pluginStatus.State == model.PluginStateRunning, nil
}
