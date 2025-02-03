// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitImportLocal() {
	api.BaseRoutes.Imports.Handle("", api.APILocal(listImports)).Methods(http.MethodGet)
}
