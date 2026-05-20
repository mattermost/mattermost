// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitPreferenceLocal() {
	api.BaseRoutes.Preferences.Handle("", api.APILocal(getPreferences)).Methods("GET")
	api.BaseRoutes.Preferences.Handle("", api.APILocal(updatePreferences)).Methods("PUT")
	api.BaseRoutes.Preferences.Handle("/delete", api.APILocal(deletePreferences)).Methods("POST")
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}", api.APILocal(getPreferencesByCategory)).Methods("GET")
	api.BaseRoutes.Preferences.Handle("/{category:[A-Za-z0-9_]+}/name/{preference_name:[A-Za-z0-9_]+}", api.APILocal(getPreferenceByCategoryAndName)).Methods("GET")
}
