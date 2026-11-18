// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// maxPluginPublicKeySize bounds the size of an uploaded plugin signature public key.
const maxPluginPublicKeySize = 1 * 1024 * 1024

func (api *API) InitPluginLocal() {
	api.BaseRoutes.Plugins.Handle("", api.APILocal(uploadPlugin, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("", api.APILocal(getPlugins)).Methods(http.MethodGet)
	api.BaseRoutes.Plugins.Handle("/install_from_url", api.APILocal(installPluginFromURL)).Methods(http.MethodPost)
	api.BaseRoutes.Plugin.Handle("", api.APILocal(removePlugin)).Methods(http.MethodDelete)
	api.BaseRoutes.Plugin.Handle("/enable", api.APILocal(enablePlugin)).Methods(http.MethodPost)
	api.BaseRoutes.Plugin.Handle("/disable", api.APILocal(disablePlugin)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("/marketplace", api.APILocal(installMarketplacePlugin)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("/marketplace", api.APILocal(getMarketplacePlugins)).Methods(http.MethodGet)
	api.BaseRoutes.Plugins.Handle("/reattach", api.APILocal(reattachPlugin)).Methods(http.MethodPost)
	api.BaseRoutes.Plugin.Handle("/detach", api.APILocal(detachPlugin)).Methods(http.MethodPost)

	api.BaseRoutes.Plugins.Handle("/public_keys", api.APILocal(localGetPluginPublicKeys)).Methods(http.MethodGet)
	api.BaseRoutes.Plugins.Handle("/public_keys", api.APILocal(localAddPluginPublicKey)).Methods(http.MethodPost)
	api.BaseRoutes.Plugins.Handle("/public_keys/{public_key_name:[A-Za-z0-9_.\\-]+}", api.APILocal(localGetPluginPublicKey)).Methods(http.MethodGet)
	api.BaseRoutes.Plugins.Handle("/public_keys/{public_key_name:[A-Za-z0-9_.\\-]+}", api.APILocal(localDeletePluginPublicKey)).Methods(http.MethodDelete)
}

// localGetPluginPublicKeys lists the names of the configured plugin signature public keys.
//
// This API is only exposed over a local socket.
func localGetPluginPublicKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	names := c.App.Config().PluginSettings.SignaturePublicKeyFiles
	if names == nil {
		names = []string{}
	}

	if err := json.NewEncoder(w).Encode(names); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// localGetPluginPublicKey returns the contents of a configured plugin signature public key.
//
// This API is only exposed over a local socket.
func localGetPluginPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["public_key_name"]
	if !c.App.IsPluginPublicKeyFile(name) {
		c.Err = model.NewAppError("localGetPluginPublicKey", "api.plugin.public_key.not_found.app_error", map[string]any{"Name": name}, "", http.StatusNotFound)
		return
	}

	data, appErr := c.App.GetPublicKey(name)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	if _, err := w.Write(data); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// localAddPluginPublicKey adds a plugin signature public key, named after the uploaded file.
//
// This API is only exposed over a local socket.
func localAddPluginPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventLocalAddPluginPublicKey, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	r.Body = http.MaxBytesReader(w, r.Body, maxPluginPublicKeySize)
	if err := r.ParseMultipartForm(maxPluginPublicKeySize); err != nil {
		c.Err = model.NewAppError("localAddPluginPublicKey", "api.plugin.public_key.parse.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	files := r.MultipartForm.File["public_key"]
	if len(files) != 1 {
		c.Err = model.NewAppError("localAddPluginPublicKey", "api.plugin.public_key.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}
	name := files[0].Filename
	model.AddEventParameterToAuditRec(auditRec, "name", name)

	file, err := files[0].Open()
	if err != nil {
		c.Err = model.NewAppError("localAddPluginPublicKey", "api.plugin.public_key.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	defer file.Close()

	if appErr := c.App.AddPublicKey(name, file); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	ReturnStatusOK(w)
}

// localDeletePluginPublicKey removes a configured plugin signature public key.
//
// This API is only exposed over a local socket.
func localDeletePluginPublicKey(c *Context, w http.ResponseWriter, r *http.Request) {
	auditRec := c.MakeAuditRecord(model.AuditEventLocalDeletePluginPublicKey, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)

	name := mux.Vars(r)["public_key_name"]
	model.AddEventParameterToAuditRec(auditRec, "name", name)

	if !c.App.IsPluginPublicKeyFile(name) {
		c.Err = model.NewAppError("localDeletePluginPublicKey", "api.plugin.public_key.not_found.app_error", map[string]any{"Name": name}, "", http.StatusNotFound)
		return
	}

	if appErr := c.App.DeletePublicKey(name); appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

// reattachPlugin allows the server to bind to an existing plugin instance launched elsewhere.
//
// This API is only exposed over a local socket.
func reattachPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	var pluginReattachRequest model.PluginReattachRequest
	if err := json.NewDecoder(r.Body).Decode(&pluginReattachRequest); err != nil {
		c.Err = model.NewAppError("reattachPlugin", "api4.plugin.reattachPlugin.invalid_request", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	if err := pluginReattachRequest.IsValid(); err != nil {
		c.Err = err
		return
	}

	err := c.App.ReattachPlugin(pluginReattachRequest.Manifest, pluginReattachRequest.PluginReattachConfig)
	if err != nil {
		c.Err = err
		return
	}
}

// detachPlugin detaches a previously reattached plugin.
//
// This API is only exposed over a local socket.
func detachPlugin(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePluginId()
	if c.Err != nil {
		return
	}

	err := c.App.DetachPlugin(c.Params.PluginId)
	if err != nil {
		c.Err = err
		return
	}
}
