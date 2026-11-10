// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitStatusLocal() {
	api.BaseRoutes.User.Handle("/status", api.APILocal(getUserStatus)).Methods(http.MethodGet)
	api.BaseRoutes.User.Handle("/status", api.APILocal(updateUserStatus)).Methods(http.MethodPut)
}
