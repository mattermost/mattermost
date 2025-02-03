// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitBotLocal() {
	api.BaseRoutes.Bot.Handle("", api.APILocal(getBot)).Methods(http.MethodGet)
	api.BaseRoutes.Bot.Handle("", api.APILocal(patchBot)).Methods(http.MethodPut)
	api.BaseRoutes.Bot.Handle("/disable", api.APILocal(disableBot)).Methods(http.MethodPost)
	api.BaseRoutes.Bot.Handle("/enable", api.APILocal(enableBot)).Methods(http.MethodPost)
	api.BaseRoutes.Bot.Handle("/convert_to_user", api.APILocal(convertBotToUser)).Methods(http.MethodPost)
	api.BaseRoutes.Bot.Handle("/assign/{user_id:[A-Za-z0-9]+}", api.APILocal(assignBot)).Methods(http.MethodPost)

	api.BaseRoutes.Bots.Handle("", api.APILocal(getBots)).Methods(http.MethodGet)
}
