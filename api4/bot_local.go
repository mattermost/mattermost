// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitBotLocal() {
	api.BaseRoutes.Bot.Handle("", api.ApiLocal(getBot)).Methods("GET")
	api.BaseRoutes.Bot.Handle("", api.ApiLocal(patchBot)).Methods("PUT")
	api.BaseRoutes.Bot.Handle("/disable", api.ApiLocal(disableBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/enable", api.ApiLocal(enableBot)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/convert_to_user", api.ApiLocal(convertBotToUser)).Methods("POST")
	api.BaseRoutes.Bot.Handle("/assign/{user_id:[A-Za-z0-9]+}", api.ApiLocal(assignBot)).Methods("POST")

	api.BaseRoutes.Bots.Handle("", api.ApiLocal(getBots)).Methods("GET")
}
