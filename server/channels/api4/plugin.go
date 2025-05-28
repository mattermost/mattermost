// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	// MaxPluginMemory is the maximum number of bytes to hold in memory when reading a plugin bundle.
	MaxPluginMemory = 50 * 1024 * 1024
)

func (api *API) InitPlugin() {
	api.BaseRoutes.Plugins.Handle("", api.APISessionRequired(uploadPlugin, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("", api.APISessionRequired(getPlugins)).Methods(http.MethodGet)
	api.BaseRoutes.Plugin.Handle("", api.APISessionRequired(removePlugin)).Methods(http.MethodDelete)
	api.BaseRoutes.Plugins.Handle("/install_from_url", api.APISessionRequired(installPluginFromURL)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("/marketplace", api.APISessionRequired(installMarketplacePlugin)).Methods(http.MethodPost)

	api.BaseRoutes.Plugins.Handle("/statuses", api.APISessionRequired(getPluginStatuses)).Methods(http.MethodGet)
	api.BaseRoutes.Plugin.Handle("/enable", api.APISessionRequired(enablePlugin)).Methods(http.MethodPost)
	api.BaseRoutes.Plugin.Handle("/disable", api.APISessionRequired(disablePlugin)).Methods(http.MethodPost)

	api.BaseRoutes.Plugins.Handle("/webapp", api.APIHandler(getWebappPlugins)).Methods(http.MethodGet)

	api.BaseRoutes.Plugins.Handle("/marketplace", api.APISessionRequired(getMarketplacePlugins)).Methods(http.MethodGet)

	api.BaseRoutes.Plugins.Handle("/marketplace/first_admin_visit", api.APIHandler(setFirstAdminVisitMarketplaceStatus)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("/marketplace/first_admin_visit", api.APISessionRequired(getFirstAdminVisitMarketplaceStatus)).Methods(http.MethodGet)
}

func uploadPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	config := c.App.Config()
	if !*config.PluginSettings.Enable || !*config.PluginSettings.EnableUploads || *config.PluginSettings.RequirePluginSignature {
		c.Err = model.NewAppError("uploadPlugin", "app.plugin.upload_disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("uploadPlugin", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
		return
	}

	if err := r.ParseMultipartForm(MaxPluginMemory); err != nil {
		if err.Error() == "http: request body too large" {
			c.Err = model.NewAppError("uploadPlugin", "api.plugin.upload.file_too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
			return
		}
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
	audit.AddEventParameter(auditRec, "filename", pluginArray[0].Filename)

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

func installPluginFromURL(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable ||
		*c.App.Config().PluginSettings.RequirePluginSignature ||
		!*c.App.Config().PluginSettings.EnableUploads {
		c.Err = model.NewAppError("installPluginFromURL", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord("installPluginFromURL", audit.Fail)
	defer c.LogAuditRec(auditRec)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
		return
	}

	force, _ := strconv.ParseBool(r.URL.Query().Get("force"))
	downloadURL := r.URL.Query().Get("plugin_download_url")
	audit.AddEventParameter(auditRec, "url", downloadURL)

	pluginFileBytes, err := c.App.DownloadFromURL(downloadURL)
	if err != nil {
		c.Err = model.NewAppError("installPluginFromURL", "api.plugin.install.download_failed.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	installPlugin(c, w, bytes.NewReader(pluginFileBytes), force)
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

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
		return
	}

	pluginRequest, err := model.PluginRequestFromReader(r.Body)
	if err != nil {
		c.Err = model.NewAppError("installMarketplacePlugin", "app.plugin.marketplace_plugin_request.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
		return
	}
	audit.AddEventParameter(auditRec, "plugin_id", pluginRequest.Id)

	// Always install the latest compatible version
	// https://mattermost.atlassian.net/browse/MM-41981
	pluginRequest.Version = ""

	manifest, appErr := c.App.Channels().InstallMarketplacePlugin(pluginRequest)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddMeta("plugin_name", manifest.Name)
	auditRec.AddMeta("plugin_desc", manifest.Description)

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(manifest); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPlugins(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadPlugins) {
		c.SetPermissionError(model.PermissionSysconsoleReadPlugins)
		return
	}

	response, err := c.App.GetPlugins()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getPluginStatuses(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().PluginSettings.Enable {
		c.Err = model.NewAppError("getPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadPlugins) {
		c.SetPermissionError(model.PermissionSysconsoleReadPlugins)
		return
	}

	response, err := c.App.GetClusterPluginStatuses()
	if err != nil {
		c.Err = err
		return
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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
	audit.AddEventParameter(auditRec, "plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
		return
	}

	err := c.App.Channels().RemovePlugin(c.Params.PluginId)
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

	manifests, appErr := c.App.GetActivePluginManifests()
	if appErr != nil {
		c.Err = appErr
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

	js, err := json.Marshal(clientManifests)
	if err != nil {
		c.Err = model.NewAppError("getWebappPlugins", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
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

	filter, err := parseMarketplacePluginFilter(r.URL)
	if err != nil {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	// if we are looking for remote only, we don't need to check for permissions
	if !filter.RemoteOnly && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadPlugins) {
		c.SetPermissionError(model.PermissionSysconsoleReadPlugins)
		return
	}

	plugins, appErr := c.App.GetMarketplacePlugins(c.AppContext, filter)
	if appErr != nil {
		c.Err = appErr
		return
	}

	json, err := json.Marshal(plugins)
	if err != nil {
		c.Err = model.NewAppError("getMarketplacePlugins", "app.plugin.marshal.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(json); err != nil {
		c.Logger.Warn("Error while writing json response", mlog.Err(err))
	}
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
	audit.AddEventParameter(auditRec, "plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
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
	audit.AddEventParameter(auditRec, "plugin_id", c.Params.PluginId)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWritePlugins) {
		c.SetPermissionError(model.PermissionSysconsoleWritePlugins)
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
	remoteOnly, _ := strconv.ParseBool(u.Query().Get("remote_only"))

	if localOnly && remoteOnly {
		return nil, errors.New("local_only and remote_only cannot be both true")
	}

	return &model.MarketplacePluginFilter{
		Page:          page,
		PerPage:       perPage,
		Filter:        filter,
		ServerVersion: serverVersion,
		LocalOnly:     localOnly,
		RemoteOnly:    remoteOnly,
	}, nil
}

func installPlugin(c *Context, w http.ResponseWriter, plugin io.ReadSeeker, force bool) {
	manifest, appErr := c.App.InstallPlugin(plugin, force)
	if appErr != nil {
		c.Err = appErr
		return
	}
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(manifest); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setFirstAdminVisitMarketplaceStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("setFirstAdminVisitMarketplaceStatus", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	firstAdminVisitMarketplaceObj := model.System{
		Name:  model.SystemFirstAdminVisitMarketplace,
		Value: "true",
	}

	if err := c.App.Srv().Store().System().SaveOrUpdate(&firstAdminVisitMarketplaceObj); err != nil {
		c.Err = model.NewAppError("setFirstAdminVisitMarketplaceStatus", "api.error_set_first_admin_visit_marketplace_status", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketFirstAdminVisitMarketplaceStatusReceived, "", "", "", nil, "")
	message.Add("firstAdminVisitMarketplaceStatus", firstAdminVisitMarketplaceObj.Value)
	c.App.Publish(message)

	auditRec.Success()
	ReturnStatusOK(w)
}

func getFirstAdminVisitMarketplaceStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord("getFirstAdminVisitMarketplaceStatus", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	firstAdminVisitMarketplaceObj, err := c.App.Srv().Store().System().GetByName(model.SystemFirstAdminVisitMarketplace)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			firstAdminVisitMarketplaceObj = &model.System{
				Name:  model.SystemFirstAdminVisitMarketplace,
				Value: "false",
			}
		default:
			c.Err = model.NewAppError("getFirstAdminVisitMarketplaceStatus", "api.error_get_first_admin_visit_marketplace_status", nil, "", http.StatusInternalServerError).Wrap(err)

			return
		}
	}

	auditRec.Success()
	if err := json.NewEncoder(w).Encode(firstAdminVisitMarketplaceObj); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
