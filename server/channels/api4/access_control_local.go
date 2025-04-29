// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APILocal(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicies.Handle("/check", api.APILocal(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/test", api.APILocal(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APILocal(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/autocomplete", api.APILocal(getExpressionAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APILocal(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APILocal(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APILocal(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APILocal(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}
