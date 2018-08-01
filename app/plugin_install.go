// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

// InstallPlugin unpacks and installs a plugin but does not enable or activate it.
func (a *App) InstallPlugin(pluginFile io.Reader, replace bool) (*model.Manifest, *model.AppError) {
	return a.installPlugin(pluginFile, replace)
}

func (a *App) installPlugin(pluginFile io.Reader, replace bool) (*model.Manifest, *model.AppError) {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("installPlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer os.RemoveAll(tmpDir)

	if err := utils.ExtractTarGz(pluginFile, tmpDir); err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.extract.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	tmpPluginDir := tmpDir
	dir, err := ioutil.ReadDir(tmpDir)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(dir) == 1 && dir[0].IsDir() {
		tmpPluginDir = filepath.Join(tmpPluginDir, dir[0].Name())
	}

	manifest, _, err := model.FindManifest(tmpPluginDir)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if !plugin.IsValidId(manifest.Id) {
		return nil, model.NewAppError("installPlugin", "app.plugin.invalid_id.app_error", map[string]interface{}{"Min": plugin.MinIdLength, "Max": plugin.MaxIdLength, "Regex": plugin.ValidIdRegex}, "", http.StatusBadRequest)
	}

	bundles, err := a.Plugins.Available()
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.install.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	// Check that there is no plugin with the same ID
	for _, bundle := range bundles {
		if bundle.Manifest != nil && bundle.Manifest.Id == manifest.Id {
			if !replace {
				return nil, model.NewAppError("installPlugin", "app.plugin.install_id.app_error", nil, "", http.StatusBadRequest)
			}

			if err := a.RemovePlugin(manifest.Id); err != nil {
				return nil, model.NewAppError("installPlugin", "app.plugin.install_id_failed_remove.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	pluginPath := filepath.Join(*a.Config().PluginSettings.Directory, manifest.Id)
	err = utils.CopyDir(tmpPluginDir, pluginPath)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.mvdir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}

	return manifest, nil
}

func (a *App) RemovePlugin(id string) *model.AppError {
	return a.removePlugin(id)
}

func (a *App) removePlugin(id string) *model.AppError {
	if a.Plugins == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("removePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.Plugins.Available()
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

	if a.Plugins.IsActive(id) && manifest.HasClient() {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_DISABLED, "", "", "", nil)
		message.Add("manifest", manifest.ClientManifest())
		a.Publish(message)
	}

	a.Plugins.Deactivate(id)

	err = os.RemoveAll(pluginPath)
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}
