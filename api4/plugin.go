// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	MAXIMUM_PLUGIN_FILE_SIZE = 50 * 1024 * 1024
)

func (api *API) InitPlugin() {
	mlog.Debug("EXPERIMENTAL: Initializing plugin api")

	api.BaseRoutes.Plugins.Handle("", api.ApiSessionRequired(uploadPlugin)).Methods("POST")
	api.BaseRoutes.Plugins.Handle("", api.ApiSessionRequired(getPlugins)).Methods("GET")
	api.BaseRoutes.Plugin.Handle("", api.ApiSessionRequired(removePlugin)).Methods("DELETE")
	api.BaseRoutes.Plugins.Handle("/install_from_url", api.ApiSessionRequired(installPluginFromUrl)).Methods("POST")
	api.BaseRoutes.Plugins.Handle("/marketplace", api.ApiSessionRequired(installMarketplacePlugin)).Methods("POST")

	api.BaseRoutes.Plugins.Handle("/statuses", api.ApiSessionRequired(getPluginStatuses)).Methods("GET")
	api.BaseRoutes.Plugin.Handle("/enable", api.ApiSessionRequired(enablePlugin)).Methods("POST")
	api.BaseRoutes.Plugin.Handle("/disable", api.ApiSessionRequired(disablePlugin)).Methods("POST")

	api.BaseRoutes.Plugins.Handle("/webapp", api.ApiHandler(getWebappPlugins)).Methods("GET")

	api.BaseRoutes.Plugins.Handle("/marketplace", api.ApiSessionRequired(getMarketplacePlugins)).Methods("GET")
}

func uploadPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	config := c.App.Config()
	if !*config.PluginSettings.Enable || !*config.PluginSettings.EnableUploads || *config.PluginSettings.RequirePluginSignature {
		c.Err = model.NewAppError("uploadPlugin", "app.plugin.upload_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("uploadPlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
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
	auditRec.AddMeta("filename", pluginArray[0].Filename)

	file, err := pluginArray[0].Open()
	if err != nil {
		c.Err = model.NewAppError("uploadPlugin", "api.plugin.upload.file.app_error", nil, "", http.StatusBadRequest)
		return
	}
	defer file.Close()

	force := false
	if len(m.Value["force"]) > 0 && m.Value["force"][0] == "true" {
		force = true
	}

	installPlugin(c, w, file, force)
	auditRec.Success()
}

func installPluginFromUrl(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable ||
		*c.App.Config().PluginSettings.RequirePluginSignature ||
		!*c.App.Config().PluginSettings.EnableUploads {
		c.Err = model.NewAppError("installPluginFromUrl", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("installPluginFromUrl", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
		return
	}

	force, _ := strconv.ParseBool(r.URL.Query().Get("force"))
	downloadURL := r.URL.Query().Get("plugin_download_url")
	auditRec.AddMeta("url", downloadURL)

	respBody, err := c.App.DownloadFromURL(downloadURL)
	if err != nil {
		c.Err = model.NewAppError("installPluginFromUrl", "api.plugin.install.download_failed.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}
	defer respBody.Close()

	installPlugin(c, w, respBody, force)
	auditRec.Success()
}

func installMarketplacePlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("installMarketplacePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().PluginSettings.EnableMarketplace {
		c.Err = model.NewAppError("installMarketplacePlugin", "app.plugin.marketplace_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("installMarketplacePlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
		return
	}

	pluginRequest, err := model.PluginRequestFromReader(r.Body)
	if err != nil {
		c.Err = model.NewAppError("installMarketplacePlugin", "app.plugin.marketplace_plugin_request.app_error", nil, err.Error(), http.StatusNotImplemented)
		return
	}
	auditRec.AddMeta("plugin_id", pluginRequest.Id)

	manifest, appErr := c.App.InstallMarketplacePlugin(pluginRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddMeta("plugin_name", manifest.Name)
	auditRec.AddMeta("plugin_desc", manifest.Description)

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(manifest.ToJson()))
}

func getPlugins(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_PLUGINS)
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

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_PLUGINS)
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

	auditRec := c.MakeAuditRecord("removePlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
		return
	}

	err := c.App.RemovePlugin(c.Params.PluginId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
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
			manifest := m.ClientManifest()

			// There is no reason to expose the SettingsSchema in this API call; it's not used in the webapp.
			manifest.SettingsSchema = nil
			clientManifests = append(clientManifests, manifest)
		}
	}

	w.Write([]byte(model.ManifestListToJson(clientManifests)))
}

func getMarketplacePlugins(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !*c.App.Config().PluginSettings.EnableMarketplace {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.marketplace_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_READ_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_READ_PLUGINS)
		return
	}

	filter, err := parseMarketplacePluginFilter(r.URL)
	if err != nil {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.marshal.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	plugins, appErr := c.App.GetMarketplacePlugins(filter)
	if appErr != nil {
		c.Err = appErr
		return
	}

	json, err := json.Marshal(plugins)
	if err != nil {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.marshal.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
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

	auditRec := c.MakeAuditRecord("enablePlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
		return
	}

	if err := c.App.EnablePlugin(c.Params.PluginId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
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

	auditRec := c.MakeAuditRecord("disablePlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS) {
		c.SetPermissionError(model.PERMISSION_SYSCONSOLE_WRITE_PLUGINS)
		return
	}

	if err := c.App.DisablePlugin(c.Params.PluginId); err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func parseMarketplacePluginFilter(u *url.URL) (*model.MarketplacePluginFilter, error) {
	page, err := parseInt(u, "page", 0)
	if err != nil {
		return nil, err
	}

	perPage, err := parseInt(u, "per_page", 100)
	if err != nil {
		return nil, err
	}

	filter := u.Query().Get("filter")
	serverVersion := u.Query().Get("server_version")
	localOnly, _ := strconv.ParseBool(u.Query().Get("local_only"))
	return &model.MarketplacePluginFilter{
		Page:          page,
		PerPage:       perPage,
		Filter:        filter,
		ServerVersion: serverVersion,
		LocalOnly:     localOnly,
	}, nil
}

func installPlugin(c *Context, w http.ResponseWriter, plugin io.Reader, force bool) {
	manifest, appErr := c.App.InstallPlugin(plugin, force)
	if appErr != nil {
		c.Err = appErr
		return
	}
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(manifest.ToJson()))
}
