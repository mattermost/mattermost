// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"

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

type API struct {
	App        *app.App
	BaseRoutes *Routes
}

func Init(a *app.App, root *mux.Router) *API {
	api := &API{
		App:        a,
		BaseRoutes: &Routes{},
	}
	api.BaseRoutes.Root = root
	api.BaseRoutes.ApiRoot = root.PathPrefix(model.API_URL_SUFFIX_V3).Subrouter()
	api.BaseRoutes.Users = api.BaseRoutes.ApiRoot.PathPrefix("/users").Subrouter()
	api.BaseRoutes.NeedUser = api.BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Teams = api.BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.NeedTeam = api.BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Channels = api.BaseRoutes.NeedTeam.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.NeedChannel = api.BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.NeedChannelName = api.BaseRoutes.Channels.PathPrefix("/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.Posts = api.BaseRoutes.NeedChannel.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.NeedPost = api.BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Commands = api.BaseRoutes.NeedTeam.PathPrefix("/commands").Subrouter()
	api.BaseRoutes.TeamFiles = api.BaseRoutes.NeedTeam.PathPrefix("/files").Subrouter()
	api.BaseRoutes.Files = api.BaseRoutes.ApiRoot.PathPrefix("/files").Subrouter()
	api.BaseRoutes.NeedFile = api.BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.Hooks = api.BaseRoutes.NeedTeam.PathPrefix("/hooks").Subrouter()
	api.BaseRoutes.OAuth = api.BaseRoutes.ApiRoot.PathPrefix("/oauth").Subrouter()
	api.BaseRoutes.Admin = api.BaseRoutes.ApiRoot.PathPrefix("/admin").Subrouter()
	api.BaseRoutes.General = api.BaseRoutes.ApiRoot.PathPrefix("/general").Subrouter()
	api.BaseRoutes.Preferences = api.BaseRoutes.ApiRoot.PathPrefix("/preferences").Subrouter()
	api.BaseRoutes.License = api.BaseRoutes.ApiRoot.PathPrefix("/license").Subrouter()
	api.BaseRoutes.Public = api.BaseRoutes.ApiRoot.PathPrefix("/public").Subrouter()
	api.BaseRoutes.Emoji = api.BaseRoutes.ApiRoot.PathPrefix("/emoji").Subrouter()
	api.BaseRoutes.Webrtc = api.BaseRoutes.ApiRoot.PathPrefix("/webrtc").Subrouter()

	api.InitUser()
	api.InitTeam()
	api.InitChannel()
	api.InitPost()
	api.InitWebSocket()
	api.InitFile()
	api.InitCommand()
	api.InitAdmin()
	api.InitGeneral()
	api.InitOAuth()
	api.InitWebhook()
	api.InitPreference()
	api.InitLicense()
	api.InitEmoji()
	api.InitStatus()
	api.InitWebrtc()
	api.InitReaction()

	// 404 on any api route before web.go has a chance to serve it
	root.Handle("/api/{anything:.*}", http.HandlerFunc(Handle404))

	a.InitEmailBatching()

	if *a.Config().ServiceSettings.EnableAPIv3 {
		l4g.Info("API version 3 is scheduled for deprecation. Please see https://api.mattermost.com for details.")
	}

	return api
}

func ReturnStatusOK(w http.ResponseWriter) {
	m := make(map[string]string)
	m[model.STATUS] = model.STATUS_OK
	w.Write([]byte(model.MapToJson(m)))
}
