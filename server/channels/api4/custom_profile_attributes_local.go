// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitCustomProfileAttributesLocal() {
	api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APILocal(listCPAFields)).Methods(http.MethodGet)
	api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APILocal(createCPAField)).Methods(http.MethodPost)
	api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APILocal(patchCPAField)).Methods(http.MethodPatch)
	api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APILocal(deleteCPAField)).Methods(http.MethodDelete)
	api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APILocal(listCPAValues)).Methods(http.MethodGet)
	api.BaseRoutes.CustomProfileAttributesValues.Handle("", api.APILocal(patchCPAValues)).Methods(http.MethodPatch)
	api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APILocal(patchCPAValuesForUser)).Methods(http.MethodPatch)
}
