// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitExportLocal() {
	api.BaseRoutes.Exports.Handle("", api.APILocal(listExports)).Methods(http.MethodGet)
	api.BaseRoutes.Export.Handle("", api.APILocal(deleteExport)).Methods(http.MethodDelete)
	api.BaseRoutes.Export.Handle("", api.APILocal(downloadExport)).Methods(http.MethodGet)
	api.BaseRoutes.Export.Handle("/presign-url", api.APILocal(generatePresignURLExport)).Methods(http.MethodPost)
}
