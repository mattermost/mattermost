// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitPluginLocal() {
	api.BaseRoutes.Plugins.Handle("", api.ApiLocal(uploadPlugin)).Methods("POST")
	api.BaseRoutes.Plugins.Handle("", api.ApiLocal(getPlugins)).Methods("GET")
	api.BaseRoutes.Plugins.Handle("/install_from_url", api.ApiLocal(installPluginFromUrl)).Methods("POST")
	api.BaseRoutes.Plugin.Handle("", api.ApiLocal(removePlugin)).Methods("DELETE")
	api.BaseRoutes.Plugin.Handle("/enable", api.ApiLocal(enablePlugin)).Methods("POST")
	api.BaseRoutes.Plugin.Handle("/disable", api.ApiLocal(disablePlugin)).Methods("POST")
}
