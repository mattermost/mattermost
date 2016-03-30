// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	_ "github.com/cloudfoundry/jibber_jabber"
	_ "github.com/nicksnyder/go-i18n/i18n"
)

type Routes struct {
	Root *mux.Router // 'api/v2'

	Users    *mux.Router // 'api/v2/users'
	NeedUser *mux.Router // 'api/v2/users/{user_id:[A-Za-z0-9]+}'

	Teams    *mux.Router // 'api/v2/teams'
	NeedTeam *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}'

	Channels    *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/channels'
	NeedChannel *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'

	Posts    *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}/posts'
	NeedPost *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Commands *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/commands'
	Hooks    *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/hooks'

	Files *mux.Router // 'api/v2/teams/{team_id:[A-Za-z0-9]+}/files'
}

var BaseRoutes *Routes

func InitApi() {
	BaseRoutes = &Routes{}
	BaseRoutes.Root = Srv.Router.PathPrefix(model.API_URL_SUFFIX).Subrouter()
	BaseRoutes.Users = BaseRoutes.Root.PathPrefix("/users").Subrouter()
	BaseRoutes.NeedUser = BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Teams = BaseRoutes.Root.PathPrefix("/teams").Subrouter()
	BaseRoutes.NeedTeam = BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Channels = BaseRoutes.NeedTeam.PathPrefix("/channels").Subrouter()
	BaseRoutes.NeedChannel = BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Posts = BaseRoutes.NeedChannel.PathPrefix("/posts").Subrouter()
	BaseRoutes.NeedPost = BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Commands = BaseRoutes.NeedTeam.PathPrefix("/commands").Subrouter()
	BaseRoutes.Files = BaseRoutes.NeedTeam.PathPrefix("/files").Subrouter()
	BaseRoutes.Hooks = BaseRoutes.NeedTeam.PathPrefix("/hooks").Subrouter()

	r := Srv.Router.PathPrefix(model.API_URL_SUFFIX).Subrouter()
	InitUser()
	InitTeam()
	InitChannel()
	InitPost()
	InitWebSocket()
	InitFile()
	InitCommand()
	InitAdmin(r)
	InitOAuth(r)
	InitWebhook()
	InitPreference(r)
	InitLicense(r)

	utils.InitHTML()
}

func HandleEtag(etag string, w http.ResponseWriter, r *http.Request) bool {
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); len(etag) > 0 {
		if et == etag {
			w.WriteHeader(http.StatusNotModified)
			return true
		}
	}

	return false
}
