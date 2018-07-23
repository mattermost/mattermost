// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

const (
	MAXIMUM_PLUGIN_FILE_SIZE = 50 * 1024 * 1024
)

func (api *API) InitPlugin() {
	mlog.Debug("EXPERIMENTAL: Initializing plugin api")

	api.BaseRoutes.Plugins.Handle("", api.ApiSessionRequired(uploadPlugin)).Methods("POST")
	api.BaseRoutes.Plugins.Handle("", api.ApiSessionRequired(getPlugins)).Methods("GET")
	api.BaseRoutes.Plugin.Handle("", api.ApiSessionRequired(removePlugin)).Methods("DELETE")

	api.BaseRoutes.Plugins.Handle("/statuses", api.ApiSessionRequired(getPluginStatuses)).Methods("GET")
	api.BaseRoutes.Plugin.Handle("/enable", api.ApiSessionRequired(enablePlugin)).Methods("POST")
	api.BaseRoutes.Plugin.Handle("/disable", api.ApiSessionRequired(disablePlugin)).Methods("POST")

	api.BaseRoutes.Plugins.Handle("/webapp", api.ApiHandler(getWebappPlugins)).Methods("GET")
}

func uploadPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable || !*c.App.Config().PluginSettings.EnableUploads {
		c.Err = model.NewAppError("uploadPlugin", "app.plugin.upload_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := r.ParseMultipartForm(MAXIMUM_PLUGIN_FILE_SIZE); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	m := r.MultipartForm

	pluginArray, ok := m.File["plugin"]
	if !ok {
		c.Err = model.NewAppError("uploadPlugin", "api.plugin.upload.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(pluginArray) <= 0 {
		c.Err = model.NewAppError("uploadPlugin", "api.plugin.upload.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	file, err := pluginArray[0].Open()
	if err != nil {
		c.Err = model.NewAppError("uploadPlugin", "api.plugin.upload.file.app_error", nil, "", http.StatusBadRequest)
		return
	}
	defer file.Close()

	manifest, unpackErr := c.App.InstallPlugin(file, false)

	if unpackErr != nil {
		c.Err = unpackErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(manifest.ToJson()))
}

func getPlugins(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	response, err := c.App.GetPlugins()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(response.ToJson()))
}

func getPluginStatuses(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	response, err := c.App.GetClusterPluginStatuses()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(response.ToJson()))
}

func removePlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePluginId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("removePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.RemovePlugin(c.Params.PluginId)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func getWebappPlugins(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getWebappPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	manifests, err := c.App.GetActivePluginManifests()
	if err != nil {
		c.Err = err
		return
	}

	clientManifests := []*model.Manifest{}
	for _, m := range manifests {
		if m.HasClient() {
			clientManifests = append(clientManifests, m.ClientManifest())
		}
	}

	w.Write([]byte(model.ManifestListToJson(clientManifests)))
}

func enablePlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePluginId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("activatePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.EnablePlugin(c.Params.PluginId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}

func disablePlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePluginId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("deactivatePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	if err := c.App.DisablePlugin(c.Params.PluginId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
