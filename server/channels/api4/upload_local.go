// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitUploadLocal() {
	api.BaseRoutes.Uploads.Handle("", api.APILocal(createUpload, handlerParamFileAPI)).Methods(http.MethodPost)
	api.BaseRoutes.Upload.Handle("", api.APILocal(getUpload)).Methods(http.MethodGet)
	api.BaseRoutes.Upload.Handle("", api.APILocal(uploadData, handlerParamFileAPI)).Methods(http.MethodPost)
}
