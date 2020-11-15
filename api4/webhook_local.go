// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitWebhookLocal() {
	api.BaseRoutes.IncomingHooks.Handle("", api.ApiLocal(getIncomingHooks)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(getIncomingHook)).Methods("GET")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(updateIncomingHook)).Methods("PUT")
	api.BaseRoutes.IncomingHook.Handle("", api.ApiLocal(deleteIncomingHook)).Methods("DELETE")

	api.BaseRoutes.OutgoingHooks.Handle("", api.ApiLocal(getOutgoingHooks)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(getOutgoingHook)).Methods("GET")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(updateOutgoingHook)).Methods("PUT")
	api.BaseRoutes.OutgoingHook.Handle("", api.ApiLocal(deleteOutgoingHook)).Methods("DELETE")
}
