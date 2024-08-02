// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

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
