// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitBoardAttributesLocal() {
	if api.srv.Config().FeatureFlags.BoardAttributes {
		api.BaseRoutes.BoardAttributesFields.Handle("", api.APILocal(listBoardAttributeFields)).Methods(http.MethodGet)
		api.BaseRoutes.BoardAttributesFields.Handle("", api.APILocal(createBoardAttributeField)).Methods(http.MethodPost)
		api.BaseRoutes.BoardAttributesField.Handle("", api.APILocal(patchBoardAttributeField)).Methods(http.MethodPatch)
		api.BaseRoutes.BoardAttributesField.Handle("", api.APILocal(deleteBoardAttributeField)).Methods(http.MethodDelete)
	}
}
