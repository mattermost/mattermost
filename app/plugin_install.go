// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Installing a managed plugin consists of copying the uploaded plugin (*.tar.gz) to the filestore,
// unpacking to the configured local directory (PluginSettings.Directory), and copying any webapp bundle therein
// to the configured local client directory (PluginSettings.ClientDirectory). The unpacking and copy occurs
// each time the server starts, ensuring it remains synchronized with the set of installed plugins.
//
// When a plugin is enabled, all connected websocket clients are notified so as to fetch any webapp bundle and
// load the client-side portion of the plugin. This works well in a single-server system, but requires careful
// coordination in a high-availability cluster with multiple servers. In particular, websocket clients must not be
// notified of the newly enabled plugin until all servers in the cluster have finished unpacking the plugin, otherwise
// the webapp bundle might not yet be available. Ideally, each server would just notify its own set of connected peers
// after it finishes this process, but nothing prevents those clients from re-connecting to a different server behind
// the load balancer that hasn't finished unpacking.
//
// To achieve this coordination, each server instead checks the status of its peers after unpacking. If it finds peers with
// differing versions of the plugin, it skips the notification. If it finds all peers with the same version of the plugin,
// it notifies all websocket clients connected to all peers. There's a small chance that this never occurs if the the last
// server to finish unpacking dies before it can announce. There is also a chance that multiple servers decide to notify,
// but the webapp handles this idempotently.
//
// Complicating this flow further are the various means of notifying. In addition to websocket events, there are cluster
// messages between peers. There is a cluster message when the config changes and a plugin is enabled or disabled.
// There is a cluster message when installing or uninstalling a plugin. There is a cluster message when peer's plugin change
// its status. And finally the act of notifying websocket clients is propagated itself via a cluster message.
//
// The key methods involved in handling these notifications are notifyPluginEnabled and notifyPluginStatusesChanged.
// Note that none of this complexity applies to single-server systems or to plugins without a webapp bundle.
//
// Finally, in addition to managed plugins, note that there are unmanaged and prepackaged plugins.
// Unmanaged plugins are plugins installed manually to the configured local directory (PluginSettings.Directory).
// Prepackaged plugins are included with the server. They otherwise follow the above flow, except do not get uploaded
// to the filestore. Prepackaged plugins override all other plugins with the same plugin id, but only when the prepackaged
// plugin is newer. Managed plugins unconditionally override unmanaged plugins with the same plugin id.
//
package app

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/blang/semver"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

// managedPluginFileName is the file name of the flag file that marks
// a local plugin folder as "managed" by the file store.
const managedPluginFileName = ".filestore"

// fileStorePluginFolder is the folder name in the file store of the plugin bundles installed.
const fileStorePluginFolder = "plugins"

func (a *App) InstallPluginFromData(data model.PluginEventData) {
	mlog.Debug("Installing plugin as per cluster message", mlog.String("plugin_id", data.Id))

	pluginSignaturePathMap, appErr := a.getPluginsFromFolder()
	if appErr != nil {
		mlog.Error("Failed to get plugin signatures from filestore. Can't install plugin from data.", mlog.Err(appErr))
		return
	}
	plugin, ok := pluginSignaturePathMap[data.Id]
	if !ok {
		mlog.Error("Failed to get plugin signature from filestore. Can't install plugin from data.", mlog.String("plugin id", data.Id))
		return
	}

	reader, appErr := a.FileReader(plugin.path)
	if appErr != nil {
		mlog.Error("Failed to open plugin bundle from file store.", mlog.String("bundle", plugin.path), mlog.Err(appErr))
		return
	}
	defer reader.Close()

	var signature filesstore.ReadCloseSeeker
	if *a.Config().PluginSettings.RequirePluginSignature {
		signature, appErr = a.FileReader(plugin.signaturePath)
		if appErr != nil {
			mlog.Error("Failed to open plugin signature from file store.", mlog.Err(appErr))
			return
		}
		defer signature.Close()
	}

	manifest, appErr := a.installPluginLocally(reader, signature, installPluginLocallyAlways)
	if appErr != nil {
		mlog.Error("Failed to sync plugin from file store", mlog.String("bundle", plugin.path), mlog.Err(appErr))
		return
	}

	if err := a.notifyPluginEnabled(manifest); err != nil {
		mlog.Error("Failed notify plugin enabled", mlog.Err(err))
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("Failed to notify plugin status changed", mlog.Err(err))
	}
}

func (a *App) RemovePluginFromData(data model.PluginEventData) {
	mlog.Debug("Removing plugin as per cluster message", mlog.String("plugin_id", data.Id))

	if err := a.removePluginLocally(data.Id); err != nil {
		mlog.Error("Failed to remove plugin locally", mlog.Err(err), mlog.String("id", data.Id))
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}
}

// InstallPluginWithSignature verifies and installs plugin.
func (a *App) InstallPluginWithSignature(pluginFile, signature io.ReadSeeker) (*model.Manifest, *model.AppError) {
	return a.installPlugin(pluginFile, signature, installPluginLocallyAlways)
}

// InstallPlugin unpacks and installs a plugin but does not enable or activate it.
func (a *App) InstallPlugin(pluginFile io.ReadSeeker, replace bool) (*model.Manifest, *model.AppError) {
	installationStrategy := installPluginLocallyOnlyIfNew
	if replace {
		installationStrategy = installPluginLocallyAlways
	}

	return a.installPlugin(pluginFile, nil, installationStrategy)
}

func (a *App) installPlugin(pluginFile, signature io.ReadSeeker, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
	manifest, appErr := a.installPluginLocally(pluginFile, signature, installationStrategy)
	if appErr != nil {
		return nil, appErr
	}

	if signature != nil {
		signature.Seek(0, 0)
		if _, appErr = a.WriteFile(signature, a.getSignatureStorePath(manifest.Id)); appErr != nil {
			return nil, model.NewAppError("saveSignature", "app.plugin.store_signature.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
	}

	// Store bundle in the file store to allow access from other servers.
	pluginFile.Seek(0, 0)
	if _, appErr := a.WriteFile(pluginFile, a.getBundleStorePath(manifest.Id)); appErr != nil {
		return nil, model.NewAppError("uploadPlugin", "app.plugin.store_bundle.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	a.notifyClusterPluginEvent(
		model.CLUSTER_EVENT_INSTALL_PLUGIN,
		model.PluginEventData{
			Id: manifest.Id,
		},
	)

	if err := a.notifyPluginEnabled(manifest); err != nil {
		mlog.Error("Failed notify plugin enabled", mlog.Err(err))
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("Failed to notify plugin status changed", mlog.Err(err))
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

func (a *App) installPluginLocally(pluginFile, signature io.ReadSeeker, installationStrategy pluginInstallationStrategy) (*model.Manifest, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}
	// verify signature
	if signature != nil {
		if err := a.VerifyPlugin(pluginFile, signature); err != nil {
			return nil, err
		}
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer os.RemoveAll(tmpDir)

	pluginFile.Seek(0, 0)
	if err = utils.ExtractTarGz(pluginFile, tmpDir); err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.extract.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	tmpPluginDir := tmpDir
	dir, err := ioutil.ReadDir(tmpDir)
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(dir) == 1 && dir[0].IsDir() {
		tmpPluginDir = filepath.Join(tmpPluginDir, dir[0].Name())
	}

	manifest, _, err := model.FindManifest(tmpPluginDir)
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if !plugin.IsValidId(manifest.Id) {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.invalid_id.app_error", map[string]interface{}{"Min": plugin.MinIdLength, "Max": plugin.MaxIdLength, "Regex": plugin.ValidIdRegex}, "", http.StatusBadRequest)
	}

	bundles, err := pluginsEnvironment.Available()
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.install.app_error", nil, err.Error(), http.StatusInternalServerError)
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
			return nil, model.NewAppError("installPluginLocally", "app.plugin.install_id.app_error", nil, "", http.StatusBadRequest)
		}

		// Skip installation if already installed and newer.
		if installationStrategy == installPluginLocallyOnlyIfNewOrUpgrade {
			var version, existingVersion semver.Version

			version, err = semver.Parse(manifest.Version)
			if err != nil {
				return nil, model.NewAppError("installPluginLocally", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest)
			}

			existingVersion, err = semver.Parse(existingManifest.Version)
			if err != nil {
				return nil, model.NewAppError("installPluginLocally", "app.plugin.invalid_version.app_error", nil, "", http.StatusBadRequest)
			}

			if version.LTE(existingVersion) {
				mlog.Debug("Skipping local installation of plugin since existing version is newer", mlog.String("plugin_id", manifest.Id))
				return nil, nil
			}
		}

		// Otherwise remove the existing installation prior to install below.
		mlog.Debug("Removing existing installation of plugin before local install", mlog.String("plugin_id", existingManifest.Id), mlog.String("version", existingManifest.Version))
		if err := a.removePluginLocally(existingManifest.Id); err != nil {
			return nil, model.NewAppError("installPluginLocally", "app.plugin.install_id_failed_remove.app_error", nil, "", http.StatusBadRequest)
		}
	}

	pluginPath := filepath.Join(*a.Config().PluginSettings.Directory, manifest.Id)
	err = utils.CopyDir(tmpPluginDir, pluginPath)
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.mvdir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Flag plugin locally as managed by the filestore.
	f, err := os.Create(filepath.Join(pluginPath, managedPluginFileName))
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.flag_managed.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	f.Close()

	if manifest.HasWebapp() {
		updatedManifest, err := pluginsEnvironment.UnpackWebappBundle(manifest.Id)
		if err != nil {
			return nil, model.NewAppError("installPluginLocally", "app.plugin.webapp_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		manifest = updatedManifest
	}

	// Activate plugin if it was previously activated.
	pluginState := a.Config().PluginSettings.PluginStates[manifest.Id]
	if pluginState != nil && pluginState.Enable {
		updatedManifest, _, err := pluginsEnvironment.Activate(manifest.Id)
		if err != nil {
			return nil, model.NewAppError("installPluginLocally", "app.plugin.restart.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		manifest = updatedManifest
	}

	return manifest, nil
}

func (a *App) RemovePlugin(id string) *model.AppError {
	return a.removePlugin(id)
}

func (a *App) removePlugin(id string) *model.AppError {
	// Disable plugin before removal to make sure this
	// plugin remains disabled on re-install.
	if err := a.DisablePlugin(id); err != nil {
		return err
	}

	if err := a.removePluginLocally(id); err != nil {
		return err
	}

	// Remove bundle from the file store.
	storePluginFileName := a.getBundleStorePath(id)
	bundleExist, err := a.FileExists(storePluginFileName)
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if !bundleExist {
		return nil
	}
	if err = a.RemoveFile(storePluginFileName); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if err = a.removeSignature(id); err != nil {
		mlog.Error("Can't remove signature", mlog.Err(err))
	}

	a.notifyClusterPluginEvent(
		model.CLUSTER_EVENT_REMOVE_PLUGIN,
		model.PluginEventData{
			Id: id,
		},
	)

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("Failed to notify plugin status changed", mlog.Err(err))
	}

	return nil
}

func (a *App) removePluginLocally(id string) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return model.NewAppError("removePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := pluginsEnvironment.Available()
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	var manifest *model.Manifest
	var pluginPath string
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			manifest = p.Manifest
			pluginPath = filepath.Dir(p.ManifestPath)
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("removePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusNotFound)
	}

	pluginsEnvironment.Deactivate(id)
	pluginsEnvironment.RemovePlugin(id)
	a.UnregisterPluginCommands(id)

	if err := os.RemoveAll(pluginPath); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) removeSignature(pluginId string) *model.AppError {
	filePath := a.getSignatureStorePath(pluginId)
	exists, err := a.FileExists(filePath)
	if err != nil {
		return model.NewAppError("removeSignature", "app.plugin.remove_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if !exists {
		mlog.Debug("no plugin signature to remove", mlog.String("plugin_id", pluginId))
		return nil
	}
	if err = a.RemoveFile(filePath); err != nil {
		return model.NewAppError("removeSignature", "app.plugin.remove_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) getBundleStorePath(id string) string {
	return filepath.Join(fileStorePluginFolder, fmt.Sprintf("%s.tar.gz", id))
}

func (a *App) getSignatureStorePath(id string) string {
	return filepath.Join(fileStorePluginFolder, fmt.Sprintf("%s.tar.gz.sig", id))
}
