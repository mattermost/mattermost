// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ### Plugin Bundles
//
// A plugin bundle consists of a server and/or webapp component designed to extend the
// functionality of the server. Bundles are first extracted to the configured local directory
// (PluginSettings.Directory), with any webapp component additionally copied to the configured
// local client directory (PluginSettings.ClientDirectory) to be loaded alongside the webapp.
//
// Plugin bundles are sourced in one of three ways:
//   - plugins prepackged with the server in the prepackaged_plugins/ directory
//   - plugins transitionally prepackaged with the server in the prepackaged_plugins/ directory
//   - plugins installed to the filestore (amazons3 or local, alongisde files and images)
//   - unmanaged plugins manually extracted to the confgured local directory
//     ┌────────────────────────────┐
//     │ ┌────────────────────────┐ │
//     │ │prepackaged_plugins/    │ │
//     │ │    prepackaged.tar.gz  │ │
//     │ │    transitional.tar.gz │ │
//     │ │                        │ │
//     │ └────────────────────────┘ │
//     │              │             │
//     │              ▼             │
//     │ ┌────────────────────────┐ │
//     │ │plugins/                │ │
//     │ │    unmanaged/          │ │
//     │ │    filestore/          │ │   ┌────────────────────────┐
//     │ │      .filestore        │ │   │s3://bucket/plugins/    │
//     │ │    prepackaged/        │◀┼───│    filestore.tar.gz    │
//     │ │      .filestore        │ │   │    transitional.tar.gz │
//     │ │    transitional/       │ │   └────────────────────────┘
//     │ │      .filestore        │ │
//     │ └────────────────────────┘ │
//     │                   ┌────────┤
//     │                   │ server │
//     └───────────────────┴────────┘
//
// Prepackaged plugins are bundles shipped alongside the server to simplify installation and
// upgrade. This occurs automatically if configured (PluginSettings.AutomaticPrepackagedPlugins)
// and the plugin is enabled (PluginSettings.PluginStates[plugin_id].Enable), unless a matching or
// newer version of the plugin is already installed.
//
// Transitionally prepackaged plugins are bundles that will stop being prepackaged in a future
// release. On first startup, they are unpacked just like prepackaged plugins, but also get copied
// to the filestore. On future startups, the server uses the version in the filestore.
//
// Plugins are installed to the filestore when the user installs via the marketplace or manually
// uploads a plugin bundle. (Or because the plugin is transitionally prepackaged).
//
// Unmanaged plugins were manually extracted by into the configured local directory. This legacy
// method of installing plugins is distinguished from other extracted plugins by the absence of a
// flag file (.filestore). Managed plugins unconditionally override unmanaged plugins. A future
// version of Mattermost will likely drop support for unmanaged plugins.
//
// ### Enabling a Plugin
//
// When a plugin is enabled, all connected websocket clients are notified so as to fetch any
// webapp bundle and load the client-side portion of the plugin. This works well in a
// single-server system, but requires careful coordination in a high-availability cluster with
// multiple servers. In particular, websocket clients must not be notified of the newly enabled
// plugin until all servers in the cluster have finished unpacking the plugin, otherwise the
// webapp bundle might not yet be available. Ideally, each server would just notify its own set of
// connected peers after it finishes this process, but nothing prevents those clients from
// re-connecting to a different server behind the load balancer that hasn't finished unpacking.
//
// To achieve this coordination, each server instead checks the status of its peers after
// unpacking. If it finds peers with differing versions of the plugin, it skips the notification.
// If it finds all peers with the same version of the plugin, it notifies all websocket clients
// connected to all peers. There's a small chance that this never occurs if the last server to
// finish unpacking dies before it can announce. There is also a chance that multiple servers
// decide to notify, but the webapp handles this idempotently.
//
// Complicating this flow further are the various means of notifying. In addition to websocket
// events, there are cluster messages between peers. There is a cluster message when the config
// changes and a plugin is enabled or disabled. There is a cluster message when installing or
// uninstalling a plugin. There is a cluster message when a peer's plugin changes its status. And
// finally the act of notifying websocket clients is itself propagated via a cluster message.
//
// The key methods involved in handling these notifications are notifyPluginEnabled and
// notifyPluginStatusesChanged. Note that none of this complexity applies to single-server
// systems or to plugins without a webapp bundle.
package app

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/blang/semver/v4"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

// managedPluginFileName is the file name of the flag file that marks
// a local plugin folder as "managed" by the file store.
const managedPluginFileName = ".filestore"

// fileStorePluginFolder is the folder name in the file store of the plugin bundles installed.
const fileStorePluginFolder = "plugins"

// installPluginFromClusterMessage is called when a peer activates a plugin in the filestore,
// signalling all other servers to do the same.
func (ch *Channels) installPluginFromClusterMessage(pluginID string) {
	logger := ch.srv.Log().With(mlog.String("plugin_id", pluginID))

	logger.Info("Installing plugin as per cluster message")

	pluginSignaturePathMap, appErr := ch.getPluginsFromFolder()
	if appErr != nil {
		logger.Error("Failed to get plugin signatures from filestore.", mlog.Err(appErr))
		return
	}
	plugin, ok := pluginSignaturePathMap[pluginID]
	if !ok {
		logger.Error("Failed to get plugin signature from filestore.")
		return
	}

	bundle, appErr := ch.srv.fileReader(plugin.bundlePath)
	if appErr != nil {
		logger.Error("Failed to open plugin bundle from file store.", mlog.Err(appErr))
		return
	}
	defer bundle.Close()

	var signature filestore.ReadCloseSeeker
	if *ch.cfgSvc.Config().PluginSettings.RequirePluginSignature {
		signature, appErr = ch.srv.fileReader(plugin.signaturePath)
		if appErr != nil {
			logger.Error("Failed to open plugin signature from file store.", mlog.Err(appErr))
			return
		}
		defer signature.Close()

		if err := ch.verifyPlugin(bundle, signature); err != nil {
			mlog.Error("Failed to validate plugin signature.", mlog.Err(appErr))
			return
		}
	}

	manifest, appErr := ch.installPluginLocally(bundle, installPluginLocallyAlways)
	if appErr != nil {
		// A log line already appears if the plugin is on the blocklist or skipped
		if appErr.Id != "app.plugin.blocked.app_error" && appErr.Id != "app.plugin.skip_installation.app_error" {
			logger.Error("Failed to sync plugin from file store", mlog.Err(appErr))
		}
		return
	}

	if err := ch.notifyPluginEnabled(manifest); err != nil {
		logger.Error("Failed notify plugin enabled", mlog.Err(err))
	}

	if err := ch.notifyPluginStatusesChanged(); err != nil {
		logger.Error("Failed to notify plugin status changed", mlog.Err(err))
	}
}

// removePluginFromClusterMessage is called when a peer removes a plugin, signalling all other
// servers to do the same.
func (ch *Channels) removePluginFromClusterMessage(pluginID string) {
	logger := ch.srv.Log().With(mlog.String("plugin_id", pluginID))

	logger.Info("Removing plugin as per cluster message")

	if err := ch.removePluginLocally(pluginID); err != nil {
		logger.Error("Failed to remove plugin locally", mlog.Err(err))
	}

	if err := ch.notifyPluginStatusesChanged(); err != nil {
		logger.Error("failed to notify plugin status changed", mlog.Err(err))
	}
}

// InstallPlugin unpacks and installs a plugin but does not enable or activate it unless the the
// plugin was already enabled.
func (a *App) InstallPlugin(pluginFile io.ReadSeeker, replace bool) (*model.Manifest, *model.AppError) {
	installationStrategy := installPluginLocallyOnlyIfNew
	if replace {
		installationStrategy = installPluginLocallyAlways
	}

	return a.ch.installPlugin(pluginFile, nil, installationStrategy)
}

// installPlugin extracts and installs the given plugin bundle (optionally signed) for the
// current server, activating the plugin if already enabled, installs it to the filestore for
// cluster peers to use, and then broadcasts the change to connected websockets.
//
// The given installation strategy decides how to handle upgrade scenarios.
func (ch *Channels) installPlugin(bundle, signature io.ReadSeeker, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
	manifest, appErr := ch.installPluginLocally(bundle, installationStrategy)
	if appErr != nil {
		return nil, appErr
	}

	if manifest == nil {
		return nil, nil
	}

	logger := ch.srv.Log().With(mlog.String("plugin_id", manifest.Id))

	appErr = ch.installPluginToFilestore(manifest, bundle, signature)
	if appErr != nil {
		return nil, appErr
	}

	if err := ch.notifyPluginEnabled(manifest); err != nil {
		logger.Warn("Failed to notify plugin enabled", mlog.Err(err))
	}

	if err := ch.notifyPluginStatusesChanged(); err != nil {
		logger.Warn("Failed to notify plugin status changed", mlog.Err(err))
	}

	return manifest, nil
}

// installPluginToFilestore saves the given plugin bundle (optionally signed) to the filestore,
// notifying cluster peers accordingly.
func (ch *Channels) installPluginToFilestore(manifest *model.Manifest, bundle, signature io.ReadSeeker) *model.AppError {
	logger := ch.srv.Log().With(mlog.String("plugin_id", manifest.Id))
	logger.Info("Persisting plugin to filestore")

	if signature == nil {
		logger.Warn("No signature when persisting plugin to filestore")
	} else {
		signatureStorePath := getSignatureStorePath(manifest.Id)
		_, err := signature.Seek(0, 0)
		if err != nil {
			return model.NewAppError("saveSignature", "app.plugin.store_signature.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		logger.Debug("Persisting plugin signature to filestore", mlog.String("path", signatureStorePath))
		if _, appErr := ch.srv.writeFile(signature, signatureStorePath); appErr != nil {
			return model.NewAppError("saveSignature", "app.plugin.store_signature.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
		}
	}

	// Store bundle in the file store to allow access from other servers.
	bundleStorePath := getBundleStorePath(manifest.Id)
	_, err := bundle.Seek(0, 0)
	if err != nil {
		return model.NewAppError("uploadPlugin", "app.plugin.store_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	logger.Debug("Persisting plugin bundle to filestore", mlog.String("path", bundleStorePath))
	if _, appErr := ch.srv.writeFile(bundle, bundleStorePath); appErr != nil {
		return model.NewAppError("uploadPlugin", "app.plugin.store_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	ch.notifyClusterPluginEvent(
		model.ClusterEventInstallPlugin,
		model.PluginEventData{
			Id: manifest.Id,
		},
	)

	return nil
}

// InstallMarketplacePlugin installs a plugin listed in the marketplace server. It will get the
// plugin bundle from the prepackaged folder, if available, or remotely if EnableRemoteMarketplace
// is true.
func (ch *Channels) InstallMarketplacePlugin(request *model.InstallMarketplacePluginRequest) (*model.Manifest, *model.AppError) {
	logger := ch.srv.Log().With(mlog.String("plugin_id", request.Id))

	var pluginFile, signatureFile io.ReadSeeker

	prepackagedPlugin, appErr := ch.getPrepackagedPlugin(request.Id, request.Version)
	if appErr != nil && appErr.Id != "app.plugin.marketplace_plugins.not_found.app_error" {
		return nil, appErr
	}
	if prepackagedPlugin != nil {
		fileReader, err := os.Open(prepackagedPlugin.Path)
		if err != nil {
			return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.install_marketplace_plugin.app_error", nil, fmt.Sprintf("failed to open prepackaged plugin %s: %s", prepackagedPlugin.Path, err.Error()), http.StatusInternalServerError)
		}
		defer fileReader.Close()

		pluginFile = fileReader
		signatureFile = bytes.NewReader(prepackagedPlugin.Signature)
	}

	if *ch.cfgSvc.Config().PluginSettings.EnableRemoteMarketplace {
		var plugin *model.BaseMarketplacePlugin
		plugin, appErr = ch.getRemoteMarketplacePlugin(request.Id, request.Version)
		// The plugin might only be prepackaged and not on the Marketplace.
		if appErr != nil && appErr.Id != "app.plugin.marketplace_plugins.not_found.app_error" {
			logger.Warn("Failed to reach Marketplace to install plugin", mlog.Err(appErr))
		}

		if plugin != nil {
			var prepackagedVersion semver.Version
			if prepackagedPlugin != nil {
				var err error
				prepackagedVersion, err = semver.Parse(prepackagedPlugin.Manifest.Version)
				if err != nil {
					return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest).Wrap(err)
				}
			}

			marketplaceVersion, err := semver.Parse(plugin.Manifest.Version)
			if err != nil {
				return nil, model.NewAppError("InstallMarketplacePlugin", "app.prepackged-plugin.invalid_version.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}

			if prepackagedVersion.LT(marketplaceVersion) { // Always true if no prepackaged plugin was found
				downloadedPluginBytes, err := ch.srv.downloadFromURL(plugin.DownloadURL)
				if err != nil {
					return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.install_marketplace_plugin.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
				signature, err := plugin.DecodeSignature()
				if err != nil {
					return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.signature_decode.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
				}
				pluginFile = bytes.NewReader(downloadedPluginBytes)
				signatureFile = signature
			}
		}
	}

	if pluginFile == nil {
		return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.marketplace_plugins.not_found.app_error", nil, "", http.StatusInternalServerError)
	}
	if signatureFile == nil {
		return nil, model.NewAppError("InstallMarketplacePlugin", "app.plugin.marketplace_plugins.signature_not_found.app_error", nil, "", http.StatusInternalServerError)
	}

	appErr = ch.verifyPlugin(pluginFile, signatureFile)
	if appErr != nil {
		return nil, appErr
	}

	manifest, appErr := ch.installPlugin(pluginFile, signatureFile, installPluginLocallyAlways)
	if appErr != nil {
		return nil, appErr
	}

	return manifest, nil
}

type pluginInstallationStrategy int

const (
	// installPluginLocallyOnlyIfNew installs the given plugin locally only if no plugin with the same id has been unpacked.
	installPluginLocallyOnlyIfNew pluginInstallationStrategy = iota
	// installPluginLocallyOnlyIfNewOrUpgrade installs the given plugin locally only if no plugin with the same id has been unpacked, or if such a plugin is older.
	installPluginLocallyOnlyIfNewOrUpgrade
	// installPluginLocallyAlways unconditionally installs the given plugin locally only, clobbering any existing plugin with the same id.
	installPluginLocallyAlways
)

// installPluginLocally extracts and installs the given plugin bundle for the current server,
// activating the plugin if already enabled.
//
// The given installation strategy decides how to handle upgrade scenarios.
func (ch *Channels) installPluginLocally(bundle io.ReadSeeker, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := os.MkdirTemp("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.filesystem.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer os.RemoveAll(tmpDir)

	manifest, pluginDir, appErr := extractPlugin(bundle, tmpDir)
	if appErr != nil {
		return nil, appErr
	}

	manifest, appErr = ch.installExtractedPlugin(manifest, pluginDir, installationStrategy)
	if appErr != nil {
		return nil, appErr
	}

	return manifest, nil
}

// extractPlugin unpacks the given plugin bundle into the specified directory.
func extractPlugin(bundle io.ReadSeeker, extractDir string) (*model.Manifest, string, *model.AppError) {
	bundle.Seek(0, 0)
	if err := extractTarGz(bundle, extractDir); err != nil {
		return nil, "", model.NewAppError("extractPlugin", "app.plugin.extract.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	dir, err := os.ReadDir(extractDir)
	if err != nil {
		return nil, "", model.NewAppError("extractPlugin", "app.plugin.filesystem.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// If the root of the plugin bundle consists of exactly one directory, assume the plugin
	// is contained therein. Otherwise the root directory is expected to contain the plugin.
	if len(dir) == 1 && dir[0].IsDir() {
		extractDir = filepath.Join(extractDir, dir[0].Name())
	}

	manifest, _, err := model.FindManifest(extractDir)
	if err != nil {
		return nil, "", model.NewAppError("extractPlugin", "app.plugin.manifest.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if !model.IsValidPluginId(manifest.Id) {
		return nil, "", model.NewAppError("extractPlugin", "app.plugin.invalid_id.app_error", map[string]any{"Min": model.MinIdLength, "Max": model.MaxIdLength, "Regex": model.ValidIdRegex}, "", http.StatusBadRequest)
	}

	return manifest, extractDir, nil
}

// installExtractedPlugin installs a plugin previously extracted to a temporary directory,
// activating the plugin automatically if already enabled by the server configuration.
//
// The given installation strategy decides how to handle upgrade scenarios.
func (ch *Channels) installExtractedPlugin(manifest *model.Manifest, fromPluginDir string, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
	logger := ch.srv.Log().With(mlog.String("plugin_id", manifest.Id))

	logger.Info("Installing extracted plugin", mlog.String("version", manifest.Version))

	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("installExtractedPlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	bundles, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("installExtractedPlugin", "app.plugin.install.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Check for plugins installed with the same ID.
	var existingManifest *model.Manifest
	for _, bundle := range bundles {
		if bundle.Manifest != nil && bundle.Manifest.Id == manifest.Id {
			existingManifest = bundle.Manifest
			break
		}
	}

	if existingManifest != nil {
		// Return an error if already installed and strategy disallows installation.
		if installationStrategy == installPluginLocallyOnlyIfNew {
			return nil, model.NewAppError("installExtractedPlugin", "app.plugin.install_id.app_error", nil, "", http.StatusBadRequest)
		}

		// Skip installation if already installed and newer.
		if installationStrategy == installPluginLocallyOnlyIfNewOrUpgrade {
			var version, existingVersion semver.Version

			version, err = semver.Parse(manifest.Version)
			if err != nil {
				return nil, model.NewAppError("installExtractedPlugin", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest)
			}

			existingVersion, err = semver.Parse(existingManifest.Version)
			if err != nil {
				return nil, model.NewAppError("installExtractedPlugin", "app.plugin.invalid_version.app_error", nil, "", http.StatusInternalServerError)
			}

			if version.LTE(existingVersion) {
				logger.Warn("Skipping local installation of plugin since not a newer version", mlog.String("version", version.String()), mlog.String("existing_version", existingVersion.String()))
				return nil, model.NewAppError("installExtractedPlugin", "app.plugin.skip_installation.app_error", map[string]any{"Id": manifest.Id}, "", http.StatusInternalServerError)
			}
		}

		// Otherwise remove the existing installation prior to installing below.
		logger.Info("Removing existing installation of plugin before local install", mlog.String("existing_version", existingManifest.Version))
		if err := ch.removePluginLocally(existingManifest.Id); err != nil {
			return nil, model.NewAppError("installExtractedPlugin", "app.plugin.install_id_failed_remove.app_error", nil, "", http.StatusInternalServerError)
		}
	}

	bundlePath := filepath.Join(*ch.cfgSvc.Config().PluginSettings.Directory, manifest.Id)
	err = utils.CopyDir(fromPluginDir, bundlePath)
	if err != nil {
		return nil, model.NewAppError("installExtractedPlugin", "app.plugin.mvdir.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Flag plugin locally as managed by the filestore.
	f, err := os.Create(filepath.Join(bundlePath, managedPluginFileName))
	if err != nil {
		return nil, model.NewAppError("installExtractedPlugin", "app.plugin.flag_managed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	f.Close()

	if manifest.HasWebapp() {
		updatedManifest, err := pluginsEnvironment.UnpackWebappBundle(manifest.Id)
		if err != nil {
			return nil, model.NewAppError("installExtractedPlugin", "app.plugin.webapp_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		manifest = updatedManifest
	}

	// Activate the plugin if enabled.
	pluginState := ch.cfgSvc.Config().PluginSettings.PluginStates[manifest.Id]
	if pluginState != nil && pluginState.Enable {
		if hasOverride, enabled := ch.getPluginStateOverride(manifest.Id); hasOverride && !enabled {
			return manifest, nil
		}

		updatedManifest, _, err := pluginsEnvironment.Activate(manifest.Id)
		if err != nil {
			return nil, model.NewAppError("installExtractedPlugin", "app.plugin.restart.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		} else if updatedManifest == nil {
			return nil, model.NewAppError("installExtractedPlugin", "app.plugin.restart.app_error", nil, "failed to activate plugin: plugin already active", http.StatusInternalServerError)
		}
		manifest = updatedManifest
	}

	return manifest, nil
}

// RemovePlugin removes a plugin from all servers.
func (ch *Channels) RemovePlugin(id string) *model.AppError {
	logger := ch.srv.Log().With(mlog.String("plugin_id", id))

	// Disable plugin before removal to make sure this
	// plugin remains disabled on re-install.
	if err := ch.disablePlugin(id); err != nil {
		return err
	}

	if err := ch.removePluginLocally(id); err != nil {
		return err
	}

	// Remove bundle from the file store.
	bundlePath := getBundleStorePath(id)
	bundleExists, err := ch.srv.fileExists(bundlePath)
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !bundleExists {
		return nil
	}
	if err := ch.srv.removeFile(bundlePath); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := ch.removeSignature(id); err != nil {
		logger.Warn("Can't remove signature", mlog.Err(err))
	}

	ch.notifyClusterPluginEvent(
		model.ClusterEventRemovePlugin,
		model.PluginEventData{
			Id: id,
		},
	)

	if err := ch.notifyPluginStatusesChanged(); err != nil {
		logger.Warn("Failed to notify plugin status changed", mlog.Err(err))
	}

	return nil
}

// removePluginLocally removes the given plugin from the current server.
func (ch *Channels) removePluginLocally(id string) *model.AppError {
	pluginsEnvironment := ch.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("removePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.deactivate.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var manifest *model.Manifest
	var unpackedBundlePath string
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			manifest = p.Manifest
			unpackedBundlePath = filepath.Dir(p.ManifestPath)
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("removePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
	}

	pluginsEnvironment.Deactivate(id)
	pluginsEnvironment.RemovePlugin(id)
	ch.unregisterPluginCommands(id)

	if err := os.RemoveAll(unpackedBundlePath); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// removeSignature removes the signature file installed alongside the plugin.
func (ch *Channels) removeSignature(pluginID string) *model.AppError {
	logger := ch.srv.Log().With(mlog.String("plugin_id", pluginID))

	signaturePath := getSignatureStorePath(pluginID)
	exists, err := ch.srv.fileExists(signaturePath)
	if err != nil {
		return model.NewAppError("removeSignature", "app.plugin.remove_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if !exists {
		logger.Debug("no plugin signature to remove")
		return nil
	}
	if err = ch.srv.removeFile(signaturePath); err != nil {
		return model.NewAppError("removeSignature", "app.plugin.remove_bundle.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// getBundleStorePath maps the given plugin id to the file path of the corresponding plugin bundle.
func getBundleStorePath(id string) string {
	return filepath.Join(fileStorePluginFolder, fmt.Sprintf("%s.tar.gz", id))
}

// getSignatureStorePath maps the given plugin id to the file path of the corresponding plugin
// signature, if one exists.
func getSignatureStorePath(id string) string {
	return filepath.Join(fileStorePluginFolder, fmt.Sprintf("%s.tar.gz.sig", id))
}
