// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APILocal(createAccessPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(getAccessPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APILocal(getAccessPolicies)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(deleteAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicies.Handle("/check", api.APILocal(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/test", api.APILocal(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APILocal(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APILocal(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APILocal(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}
