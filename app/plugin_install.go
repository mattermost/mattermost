// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Following outlines the plugin installation/activation flow.
//
// When a plugin is installed, the server first unpacks the plugin tar on the local filesystem to parse and validate its manifest.
// If successful, it uploads the tar to the configured FilesStore, which is used to sync plugins in HA env.
// Then, it notifies cluster peers to install the new plugin if in HA env, otherwise this step is skipped.
// In the end it publishes a plugin statuses changed event to all webclients. It also sends a broadcast
// message to cluster peers to notify their webclients if in HA env.
//
// When a plugin is enabled, the server first updates PluginSettings.PluginStates config to persist plugin enabled state.
// Updating the config implicitly invokes SyncPluginsActiveState(), which is done through the config change listener event.
// Activating a plugin locally, sets the plugin state as running, generates the webapp plugin bundle, sets up the plugin supervisor.
// Once plugin activating locally is complete, the config change is synced across cluster peers, which inturn activates their plugin locally.
// All peers attempt to notify webclients through notifyPluginEnabled(). In HA env, webclients are notified when all cluster peers
// have activated the plugin, this is to ensure servers can serve webapp plugin bundle when requested across all peers.
// For non-HA, this step is skipped and webclients are notified immediately after activating the plugin.
//
package app

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils"
)

// managedPluginFileName is the file name of the flag file that marks
// a local plugin folder as "managed" by the file store.
const managedPluginFileName = ".filestore"

// fileStorePluginFolder is the folder name in the file store of the plugin bundles installed.
const fileStorePluginFolder = "plugins"

func (a *App) InstallPluginFromData(data model.PluginEventData) {
	mlog.Debug("Installing plugin as per cluster message", mlog.String("plugin_id", data.Id))

	fileStorePath := a.getBundleStorePath(data.Id)
	reader, appErr := a.FileReader(fileStorePath)
	if appErr != nil {
		mlog.Error("Failed to open plugin bundle from filestore.", mlog.String("path", fileStorePath), mlog.Err(appErr))
	}
	defer reader.Close()

	manifest, appErr := a.installPluginLocally(reader, true)
	if appErr != nil {
		mlog.Error("Failed to unpack plugin from filestore", mlog.Err(appErr), mlog.String("path", fileStorePath))
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

// InstallPlugin unpacks and installs a plugin but does not enable or activate it.
func (a *App) InstallPlugin(pluginFile io.ReadSeeker, replace bool) (*model.Manifest, *model.AppError) {
	return a.installPlugin(pluginFile, replace)
}

func (a *App) installPlugin(pluginFile io.ReadSeeker, replace bool) (*model.Manifest, *model.AppError) {
	manifest, appErr := a.installPluginLocally(pluginFile, replace)
	if appErr != nil {
		return nil, appErr
	}

	// Store bundle in the file store to allow access from other servers.
	pluginFile.Seek(0, 0)

	if _, appErr := a.WriteFile(pluginFile, a.getBundleStorePath(manifest.Id)); appErr != nil {
		return nil, model.NewAppError("uploadPlugin", "app.plugin.store_bundle.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	// Notify cluster peers async.
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

func (a *App) installPluginLocally(pluginFile io.ReadSeeker, replace bool) (*model.Manifest, *model.AppError) {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("installPluginLocally", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer os.RemoveAll(tmpDir)

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

	// Check that there is no plugin with the same ID
	for _, bundle := range bundles {
		if bundle.Manifest != nil && bundle.Manifest.Id == manifest.Id {
			if !replace {
				return nil, model.NewAppError("installPluginLocally", "app.plugin.install_id.app_error", nil, "", http.StatusBadRequest)
			}

			if err := a.removePluginLocally(manifest.Id); err != nil {
				return nil, model.NewAppError("installPluginLocally", "app.plugin.install_id_failed_remove.app_error", nil, "", http.StatusBadRequest)
			}
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
	if err := a.RemoveFile(storePluginFileName); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove_bundle.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Notify cluster peers async.
	a.notifyClusterPluginEvent(
		model.CLUSTER_EVENT_REMOVE_PLUGIN,
		model.PluginEventData{
			Id: id,
		},
	)

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
		return model.NewAppError("removePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	pluginsEnvironment.Deactivate(id)
	pluginsEnvironment.RemovePlugin(id)
	a.UnregisterPluginCommands(id)

	if err := os.RemoveAll(pluginPath); err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) getBundleStorePath(id string) string {
	return filepath.Join(fileStorePluginFolder, fmt.Sprintf("%s.tar.gz", id))
}
