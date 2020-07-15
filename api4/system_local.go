// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitSystemLocal() {
	api.BaseRoutes.ApiRoot.Handle("/logs", api.ApiLocal(getLogs)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/integrity", api.ApiLocal(localCheckIntegrity)).Methods("POST")
}
