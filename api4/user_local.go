// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitUserLocal() {
	api.BaseRoutes.Users.Handle("", api.ApiLocal(createUser)).Methods("POST")
	api.BaseRoutes.Users.Handle("/password/reset/send", api.ApiLocal(sendPasswordReset)).Methods("POST")

	api.BaseRoutes.User.Handle("", api.ApiLocal(updateUser)).Methods("PUT")
	api.BaseRoutes.User.Handle("/roles", api.ApiLocal(updateUserRoles)).Methods("PUT")
}
