// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"

	_ "github.com/nicksnyder/go-i18n/i18n"
)

type Routes struct {
	Root    *mux.Router // ''
	ApiRoot *mux.Router // 'api/v4'

	Users          *mux.Router // 'api/v4/users'
	User           *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}'
	UserByUsername *mux.Router // 'api/v4/users/username/{username:[A-Za-z0-9_-\.]+}'
	UserByEmail    *mux.Router // 'api/v4/users/email/{email}'

	Teams        *mux.Router // 'api/v4/teams'
	TeamsForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams'
	Team         *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}'
	TeamByName   *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}'
	TeamMembers  *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9_-]+}/members'
	TeamMember   *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9_-]+}/members/{user_id:[A-Za-z0-9_-]+}'

	Channels              *mux.Router // 'api/v4/channels'
	Channel               *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelByName         *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelsForTeam       *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels'
	ChannelMembers        *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members'
	ChannelMember         *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	ChannelMembersForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/channels/members'

	Posts           *mux.Router // 'api/v4/posts'
	Post            *mux.Router // 'api/v4/posts/{post_id:[A-Za-z0-9]+}'
	PostsForChannel *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/posts'

	Files *mux.Router // 'api/v4/files'
	File  *mux.Router // 'api/v4/files/{file_id:[A-Za-z0-9]+}'

	Commands        *mux.Router // 'api/v4/commands'
	Command         *mux.Router // 'api/v4/commands/{command_id:[A-Za-z0-9]+}'
	CommandsForTeam *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/commands'

	Hooks         *mux.Router // 'api/v4/teams/hooks'
	IncomingHooks *mux.Router // 'api/v4/teams/hooks/incoming'
	IncomingHook  *mux.Router // 'api/v4/teams/hooks/incoming/{hook_id:[A-Za-z0-9]+}'
	OutgoingHooks *mux.Router // 'api/v4/teams/hooks/outgoing'
	OutgoingHook  *mux.Router // 'api/v4/teams/hooks/outgoing/{hook_id:[A-Za-z0-9]+}'

	OAuth *mux.Router // 'api/v4/oauth'

	Admin *mux.Router // 'api/v4/admin'

	System *mux.Router // 'api/v4/system'

	Preferences *mux.Router // 'api/v4/preferences'

	License *mux.Router // 'api/v4/license'

	Public *mux.Router // 'api/v4/public'

	Emojis *mux.Router // 'api/v4/emoji'
	Emoji  *mux.Router // 'api/v4/emoji/{emoji_id:[A-Za-z0-9]+}'

	Webrtc *mux.Router // 'api/v4/webrtc'
}

var BaseRoutes *Routes

func InitRouter() {
	app.Srv.Router = mux.NewRouter()
	app.Srv.Router.NotFoundHandler = http.HandlerFunc(Handle404)
	app.Srv.WebSocketRouter = app.NewWebSocketRouter()
}

func InitApi(full bool) {
	BaseRoutes = &Routes{}
	BaseRoutes.Root = app.Srv.Router
	BaseRoutes.ApiRoot = app.Srv.Router.PathPrefix(model.API_URL_SUFFIX).Subrouter()

	BaseRoutes.Users = BaseRoutes.ApiRoot.PathPrefix("/users").Subrouter()
	BaseRoutes.User = BaseRoutes.Users.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.UserByUsername = BaseRoutes.Users.PathPrefix("/username/{username:[A-Za-z0-9_-.]+}").Subrouter()
	BaseRoutes.UserByEmail = BaseRoutes.Users.PathPrefix("/email/{email}").Subrouter()

	BaseRoutes.Teams = BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()
	BaseRoutes.TeamsForUser = BaseRoutes.Users.PathPrefix("/teams").Subrouter()
	BaseRoutes.Team = BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.TeamByName = BaseRoutes.Teams.PathPrefix("/name/{team_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.TeamMembers = BaseRoutes.Team.PathPrefix("/members").Subrouter()
	BaseRoutes.TeamMember = BaseRoutes.TeamMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Channels = BaseRoutes.ApiRoot.PathPrefix("/channels").Subrouter()
	BaseRoutes.Channel = BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.ChannelByName = BaseRoutes.Team.PathPrefix("/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.ChannelsForTeam = BaseRoutes.Team.PathPrefix("/channels").Subrouter()
	BaseRoutes.ChannelMembers = BaseRoutes.Channel.PathPrefix("/members").Subrouter()
	BaseRoutes.ChannelMember = BaseRoutes.ChannelMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.ChannelMembersForUser = BaseRoutes.User.PathPrefix("/channels/members").Subrouter()

	BaseRoutes.Posts = BaseRoutes.ApiRoot.PathPrefix("/posts").Subrouter()
	BaseRoutes.Post = BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.PostsForChannel = BaseRoutes.Channel.PathPrefix("/posts").Subrouter()

	BaseRoutes.Files = BaseRoutes.ApiRoot.PathPrefix("/files").Subrouter()
	BaseRoutes.File = BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Commands = BaseRoutes.ApiRoot.PathPrefix("/commands").Subrouter()
	BaseRoutes.Command = BaseRoutes.Commands.PathPrefix("/{command_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.CommandsForTeam = BaseRoutes.Team.PathPrefix("/commands").Subrouter()

	BaseRoutes.Hooks = BaseRoutes.ApiRoot.PathPrefix("/hooks").Subrouter()
	BaseRoutes.IncomingHooks = BaseRoutes.Hooks.PathPrefix("/incoming").Subrouter()
	BaseRoutes.IncomingHook = BaseRoutes.IncomingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.OutgoingHooks = BaseRoutes.Hooks.PathPrefix("/outgoing").Subrouter()
	BaseRoutes.OutgoingHook = BaseRoutes.OutgoingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.OAuth = BaseRoutes.ApiRoot.PathPrefix("/oauth").Subrouter()
	BaseRoutes.Admin = BaseRoutes.ApiRoot.PathPrefix("/admin").Subrouter()
	BaseRoutes.System = BaseRoutes.ApiRoot.PathPrefix("/system").Subrouter()
	BaseRoutes.Preferences = BaseRoutes.ApiRoot.PathPrefix("/preferences").Subrouter()
	BaseRoutes.License = BaseRoutes.ApiRoot.PathPrefix("/license").Subrouter()
	BaseRoutes.Public = BaseRoutes.ApiRoot.PathPrefix("/public").Subrouter()

	BaseRoutes.Emojis = BaseRoutes.ApiRoot.PathPrefix("/emoji").Subrouter()
	BaseRoutes.Emoji = BaseRoutes.Emojis.PathPrefix("/{emoji_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Webrtc = BaseRoutes.ApiRoot.PathPrefix("/webrtc").Subrouter()

	InitUser()

	// REMOVE CONDITION WHEN APIv3 REMOVED
	if full {
		// 404 on any api route before web.go has a chance to serve it
		app.Srv.Router.Handle("/api/{anything:.*}", http.HandlerFunc(Handle404))

		utils.InitHTML()

		app.InitEmailBatching()
	}
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

func Handle404(w http.ResponseWriter, r *http.Request) {
	err := model.NewLocAppError("Handle404", "api.context.404.app_error", nil, "")
	err.Translate(utils.T)
	err.StatusCode = http.StatusNotFound

	l4g.Debug("%v: code=404 ip=%v", r.URL.Path, utils.GetIpAddress(r))

	w.WriteHeader(err.StatusCode)
	err.DetailedError = "There doesn't appear to be an api call for the url='" + r.URL.Path + "'."
	w.Write([]byte(err.ToJson()))
}

func ReturnStatusOK(w http.ResponseWriter) {
	m := make(map[string]string)
	m[model.STATUS] = model.STATUS_OK
	w.Write([]byte(model.MapToJson(m)))
}
