// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	if !api.srv.Config().FeatureFlags.AttributeBasedAccessControl {
		return
	}
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APILocal(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APILocal(searchAccessControlPolicies)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", api.APILocal(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", api.APILocal(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", api.APILocal(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", api.APILocal(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APILocal(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/activate", api.APILocal(updateActiveStatus)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APILocal(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APILocal(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APILocal(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APILocal(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}
