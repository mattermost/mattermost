// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitSystemLocal() {
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiLocal(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(setServerBusy)).Methods("POST")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(getServerBusyExpires)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/server_busy", api.ApiLocal(clearServerBusy)).Methods("DELETE")
}
