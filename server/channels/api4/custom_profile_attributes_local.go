// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitCustomProfileAttributesLocal() {
	if api.srv.Config().FeatureFlags.CustomProfileAttributes {
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APILocal(listCPAFields)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesFields.Handle("", api.APILocal(createCPAField)).Methods(http.MethodPost)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APILocal(patchCPAField)).Methods(http.MethodPatch)
		api.BaseRoutes.CustomProfileAttributesField.Handle("", api.APILocal(deleteCPAField)).Methods(http.MethodDelete)
		api.BaseRoutes.User.Handle("/custom_profile_attributes", api.APISessionRequired(listCPAValues)).Methods(http.MethodGet)
		api.BaseRoutes.CustomProfileAttributesValues.Handle("", api.APISessionRequired(patchCPAValues)).Methods(http.MethodPatch)
	}
}
