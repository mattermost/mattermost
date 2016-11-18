// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

// ONLY FOR APIs SCHEDULED TO BE DEPRECATED

func InitDeprecated() {
	l4g.Debug(utils.T("api.channel.init.debug"))

	BaseRoutes.Channels.Handle("/more", ApiUserRequired(getMoreChannels)).Methods("GET") // SCHEDULED FOR DEPRECATION IN 3.7
}

func getMoreChannels(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team
	if !HasPermissionToTeamContext(c, c.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		return
	}

	if result := <-Srv.Store.Channel().GetMoreChannels(c.TeamId, c.Session.UserId, 0, 100000); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.ChannelList).Etag(), w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}
