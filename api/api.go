// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	_ "github.com/nicksnyder/go-i18n/i18n"
)

type Routes struct {
	Root    *mux.Router // ''
	ApiRoot *mux.Router // 'api/v3'

	Users    *mux.Router // 'api/v3/users'
	NeedUser *mux.Router // 'api/v3/users/{user_id:[A-Za-z0-9]+}'

	Teams    *mux.Router // 'api/v3/teams'
	NeedTeam *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}'

	Channels        *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/channels'
	NeedChannel     *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	NeedChannelName *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'

	Posts    *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}/posts'
	NeedPost *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Commands *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/commands'
	Hooks    *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/hooks'

	TeamFiles *mux.Router // 'api/v3/teams/{team_id:[A-Za-z0-9]+}/files'
	Files     *mux.Router // 'api/v3/files'
	NeedFile  *mux.Router // 'api/v3/files/{file_id:[A-Za-z0-9]+}'

	OAuth *mux.Router // 'api/v3/oauth'

	Admin *mux.Router // 'api/v3/admin'

	General *mux.Router // 'api/v3/general'

	Preferences *mux.Router // 'api/v3/preferences'

	License *mux.Router // 'api/v3/license'

	Public *mux.Router // 'api/v3/public'

	Emoji *mux.Router // 'api/v3/emoji'

	Webrtc *mux.Router // 'api/v3/webrtc'
}

var BaseRoutes *Routes

func InitRouter() {
	app.Srv.Router = mux.NewRouter()
	app.Srv.Router.NotFoundHandler = http.HandlerFunc(Handle404)
	app.Srv.WebSocketRouter = app.NewWebSocketRouter()
}

func InitApi() {
	BaseRoutes = &Routes{}
	BaseRoutes.Root = app.Srv.Router
	BaseRoutes.ApiRoot = app.Srv.Router.PathPrefix(model.API_URL_SUFFIX_V3).Subrouter()
	BaseRoutes.Users = BaseRoutes.ApiRoot.PathPrefix("/users").Subrouter()
	BaseRoutes.NeedUser = BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Teams = BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()
	BaseRoutes.NeedTeam = BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Channels = BaseRoutes.NeedTeam.PathPrefix("/channels").Subrouter()
	BaseRoutes.NeedChannel = BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.NeedChannelName = BaseRoutes.Channels.PathPrefix("/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.Posts = BaseRoutes.NeedChannel.PathPrefix("/posts").Subrouter()
	BaseRoutes.NeedPost = BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Commands = BaseRoutes.NeedTeam.PathPrefix("/commands").Subrouter()
	BaseRoutes.TeamFiles = BaseRoutes.NeedTeam.PathPrefix("/files").Subrouter()
	BaseRoutes.Files = BaseRoutes.ApiRoot.PathPrefix("/files").Subrouter()
	BaseRoutes.NeedFile = BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.Hooks = BaseRoutes.NeedTeam.PathPrefix("/hooks").Subrouter()
	BaseRoutes.OAuth = BaseRoutes.ApiRoot.PathPrefix("/oauth").Subrouter()
	BaseRoutes.Admin = BaseRoutes.ApiRoot.PathPrefix("/admin").Subrouter()
	BaseRoutes.General = BaseRoutes.ApiRoot.PathPrefix("/general").Subrouter()
	BaseRoutes.Preferences = BaseRoutes.ApiRoot.PathPrefix("/preferences").Subrouter()
	BaseRoutes.License = BaseRoutes.ApiRoot.PathPrefix("/license").Subrouter()
	BaseRoutes.Public = BaseRoutes.ApiRoot.PathPrefix("/public").Subrouter()
	BaseRoutes.Emoji = BaseRoutes.ApiRoot.PathPrefix("/emoji").Subrouter()
	BaseRoutes.Webrtc = BaseRoutes.ApiRoot.PathPrefix("/webrtc").Subrouter()

	InitUser()
	InitTeam()
	InitChannel()
	InitPost()
	InitWebSocket()
	InitFile()
	InitCommand()
	InitAdmin()
	InitGeneral()
	InitOAuth()
	InitWebhook()
	InitPreference()
	InitLicense()
	InitEmoji()
	InitStatus()
	InitWebrtc()
	InitReaction()
	InitDeprecated()

	// 404 on any api route before web.go has a chance to serve it
	app.Srv.Router.Handle("/api/{anything:.*}", http.HandlerFunc(Handle404))

	utils.InitHTML()

	app.InitEmailBatching()
}

func HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := einterfaces.GetMetricsInterface()
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); len(etag) > 0 {
		if et == etag {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
			w.WriteHeader(http.StatusNotModified)
			if metrics != nil {
				metrics.IncrementEtagHitCounter(routeName)
			}
			return true
		}
	}

	if metrics != nil {
		metrics.IncrementEtagMissCounter(routeName)
	}

	return false
}

func ReturnStatusOK(w http.ResponseWriter) {
	m := make(map[string]string)
	m[model.STATUS] = model.STATUS_OK
	w.Write([]byte(model.MapToJson(m)))
}
