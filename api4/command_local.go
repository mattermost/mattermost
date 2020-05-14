// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitCommandLocal() {
	api.BaseRoutes.Command.Handle("", api.ApiLocal(getCommand)).Methods("GET")
	api.BaseRoutes.Command.Handle("", api.ApiLocal(updateCommand)).Methods("PUT")
	api.BaseRoutes.Command.Handle("/move", api.ApiLocal(moveCommand)).Methods("PUT")
	api.BaseRoutes.Command.Handle("", api.ApiLocal(deleteCommand)).Methods("DELETE")

}
