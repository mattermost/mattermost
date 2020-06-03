// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitGroupLocal() {
	api.BaseRoutes.Channels.Handle("/{channel_id:[A-Za-z0-9]+}/groups", api.ApiLocal(getGroupsByChannel)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/{team_id:[A-Za-z0-9]+}/groups", api.ApiLocal(getGroupsByTeam)).Methods("GET")
}
