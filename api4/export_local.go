// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitExportLocal() {
	api.BaseRoutes.Exports.Handle("", api.ApiLocal(listExports)).Methods("GET")
	api.BaseRoutes.Export.Handle("", api.ApiLocal(deleteExport)).Methods("DELETE")
	api.BaseRoutes.Export.Handle("", api.ApiLocal(downloadExport)).Methods("GET")
}
