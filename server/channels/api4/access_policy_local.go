// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createBot)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(getAccessPolicies)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequiredDisableWhenBusy(searchAccessPolicies)).Methods(http.MethodPost)
}
