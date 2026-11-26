// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitAccessControlPolicyLocal() {
	requireEA := func(h handlerFunc) http.Handler {
		return api.APILocal(h, handlerParamRequireEnterpriseAdvanced)
	}

	api.BaseRoutes.AccessControlPolicies.Handle("", requireEA(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", requireEA(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/activate", requireEA(setActiveStatus)).Methods(http.MethodPut)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", requireEA(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", requireEA(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/validate_requester", requireEA(validateExpressionAgainstRequester)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", requireEA(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", requireEA(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", requireEA(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", requireEA(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", requireEA(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", requireEA(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", requireEA(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", requireEA(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}
