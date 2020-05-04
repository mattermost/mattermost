// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitConfigLocal() {
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiLocal(getConfig)).Methods("GET")
	api.BaseRoutes.ApiRoot.Handle("/config", api.ApiLocal(updateConfig)).Methods("PUT")
}
