// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

// InitPropertiesLocal serves the read routes and the value write the mmctl
// channel attribute commands need. Field and option writes stay session-only,
// and so do the system values, the global attribute listing and the
// missing-value reports. Masking applies to a local caller like any other, so a
// masked field can hide its options and values here too.
func (api *API) InitPropertiesLocal() {
	if !propertyRoutesEnabled(api.srv.Config().FeatureFlags) {
		return
	}

	api.BaseRoutes.PropertyFieldsSearch.Handle("", api.APILocal(searchPropertyFields)).Methods(http.MethodPost)
	api.BaseRoutes.PropertyFieldOptions.Handle("", api.APILocal(getPropertyFieldOptions)).Methods(http.MethodGet)
	api.BaseRoutes.PropertyValues.Handle("", api.APILocal(getPropertyValues)).Methods(http.MethodGet)
	api.BaseRoutes.PropertyValues.Handle("", api.APILocal(patchPropertyValues)).Methods(http.MethodPatch)
}
