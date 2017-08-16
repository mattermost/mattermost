// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
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

	Teams              *mux.Router // 'api/v4/teams'
	TeamsForUser       *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams'
	Team               *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}'
	TeamForUser        *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}'
	TeamByName         *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}'
	TeamMembers        *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9_-]+}/members'
	TeamMember         *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9_-]+}/members/{user_id:[A-Za-z0-9_-]+}'
	TeamMembersForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/members'

	Channels                 *mux.Router // 'api/v4/channels'
	Channel                  *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelForUser           *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/channels/{channel_id:[A-Za-z0-9]+}'
	ChannelByName            *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelByNameForTeamName *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}/channels/name/{channel_name:[A-Za-z0-9_-]+}'
	ChannelsForTeam          *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/channels'
	ChannelMembers           *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members'
	ChannelMember            *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
	ChannelMembersForUser    *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}/channels/members'

	Posts           *mux.Router // 'api/v4/posts'
	Post            *mux.Router // 'api/v4/posts/{post_id:[A-Za-z0-9]+}'
	PostsForChannel *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/posts'
	PostsForUser    *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts'
	PostForUser     *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Files *mux.Router // 'api/v4/files'
	File  *mux.Router // 'api/v4/files/{file_id:[A-Za-z0-9]+}'

	PublicFile *mux.Router // 'files/{file_id:[A-Za-z0-9]+}/public'

	Commands *mux.Router // 'api/v4/commands'
	Command  *mux.Router // 'api/v4/commands/{command_id:[A-Za-z0-9]+}'

	Hooks         *mux.Router // 'api/v4/hooks'
	IncomingHooks *mux.Router // 'api/v4/hooks/incoming'
	IncomingHook  *mux.Router // 'api/v4/hooks/incoming/{hook_id:[A-Za-z0-9]+}'
	OutgoingHooks *mux.Router // 'api/v4/hooks/outgoing'
	OutgoingHook  *mux.Router // 'api/v4/hooks/outgoing/{hook_id:[A-Za-z0-9]+}'

	OAuth     *mux.Router // 'api/v4/oauth'
	OAuthApps *mux.Router // 'api/v4/oauth/apps'
	OAuthApp  *mux.Router // 'api/v4/oauth/apps/{app_id:[A-Za-z0-9]+}'

	OpenGraph *mux.Router // 'api/v4/opengraph'

	SAML       *mux.Router // 'api/v4/saml'
	Compliance *mux.Router // 'api/v4/compliance'
	Cluster    *mux.Router // 'api/v4/cluster'

	LDAP *mux.Router // 'api/v4/ldap'

	Elasticsearch *mux.Router // 'api/v4/elasticsearch'

	Brand *mux.Router // 'api/v4/brand'

	System *mux.Router // 'api/v4/system'

	Jobs *mux.Router // 'api/v4/jobs'

	Preferences *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/preferences'

	License *mux.Router // 'api/v4/license'

	Public *mux.Router // 'api/v4/public'

	Reactions *mux.Router // 'api/v4/reactions'

	Emojis *mux.Router // 'api/v4/emoji'
	Emoji  *mux.Router // 'api/v4/emoji/{emoji_id:[A-Za-z0-9]+}'

	ReactionByNameForPostForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}/reactions/{emoji_name:[A-Za-z0-9_-+]+}'

	Webrtc *mux.Router // 'api/v4/webrtc'
}

var BaseRoutes *Routes

func InitRouter() {
	app.Srv.Router = mux.NewRouter()
	app.Srv.Router.NotFoundHandler = http.HandlerFunc(Handle404)
}

func InitApi(full bool) {
	BaseRoutes = &Routes{}
	BaseRoutes.Root = app.Srv.Router
	BaseRoutes.ApiRoot = app.Srv.Router.PathPrefix(model.API_URL_SUFFIX).Subrouter()

	BaseRoutes.Users = BaseRoutes.ApiRoot.PathPrefix("/users").Subrouter()
	BaseRoutes.User = BaseRoutes.ApiRoot.PathPrefix("/users/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.UserByUsername = BaseRoutes.Users.PathPrefix("/username/{username:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	BaseRoutes.UserByEmail = BaseRoutes.Users.PathPrefix("/email/{email}").Subrouter()

	BaseRoutes.Teams = BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()
	BaseRoutes.TeamsForUser = BaseRoutes.User.PathPrefix("/teams").Subrouter()
	BaseRoutes.Team = BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.TeamForUser = BaseRoutes.TeamsForUser.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.TeamByName = BaseRoutes.Teams.PathPrefix("/name/{team_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.TeamMembers = BaseRoutes.Team.PathPrefix("/members").Subrouter()
	BaseRoutes.TeamMember = BaseRoutes.TeamMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.TeamMembersForUser = BaseRoutes.User.PathPrefix("/teams/members").Subrouter()

	BaseRoutes.Channels = BaseRoutes.ApiRoot.PathPrefix("/channels").Subrouter()
	BaseRoutes.Channel = BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.ChannelForUser = BaseRoutes.User.PathPrefix("/channels/{channel_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.ChannelByName = BaseRoutes.Team.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.ChannelByNameForTeamName = BaseRoutes.TeamByName.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	BaseRoutes.ChannelsForTeam = BaseRoutes.Team.PathPrefix("/channels").Subrouter()
	BaseRoutes.ChannelMembers = BaseRoutes.Channel.PathPrefix("/members").Subrouter()
	BaseRoutes.ChannelMember = BaseRoutes.ChannelMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.ChannelMembersForUser = BaseRoutes.User.PathPrefix("/teams/{team_id:[A-Za-z0-9]+}/channels/members").Subrouter()

	BaseRoutes.Posts = BaseRoutes.ApiRoot.PathPrefix("/posts").Subrouter()
	BaseRoutes.Post = BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.PostsForChannel = BaseRoutes.Channel.PathPrefix("/posts").Subrouter()
	BaseRoutes.PostsForUser = BaseRoutes.User.PathPrefix("/posts").Subrouter()
	BaseRoutes.PostForUser = BaseRoutes.PostsForUser.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Files = BaseRoutes.ApiRoot.PathPrefix("/files").Subrouter()
	BaseRoutes.File = BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.PublicFile = BaseRoutes.Root.PathPrefix("/files/{file_id:[A-Za-z0-9]+}/public").Subrouter()

	BaseRoutes.Commands = BaseRoutes.ApiRoot.PathPrefix("/commands").Subrouter()
	BaseRoutes.Command = BaseRoutes.Commands.PathPrefix("/{command_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Hooks = BaseRoutes.ApiRoot.PathPrefix("/hooks").Subrouter()
	BaseRoutes.IncomingHooks = BaseRoutes.Hooks.PathPrefix("/incoming").Subrouter()
	BaseRoutes.IncomingHook = BaseRoutes.IncomingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	BaseRoutes.OutgoingHooks = BaseRoutes.Hooks.PathPrefix("/outgoing").Subrouter()
	BaseRoutes.OutgoingHook = BaseRoutes.OutgoingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.SAML = BaseRoutes.ApiRoot.PathPrefix("/saml").Subrouter()

	BaseRoutes.OAuth = BaseRoutes.ApiRoot.PathPrefix("/oauth").Subrouter()
	BaseRoutes.OAuthApps = BaseRoutes.OAuth.PathPrefix("/apps").Subrouter()
	BaseRoutes.OAuthApp = BaseRoutes.OAuthApps.PathPrefix("/{app_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.Compliance = BaseRoutes.ApiRoot.PathPrefix("/compliance").Subrouter()
	BaseRoutes.Cluster = BaseRoutes.ApiRoot.PathPrefix("/cluster").Subrouter()
	BaseRoutes.LDAP = BaseRoutes.ApiRoot.PathPrefix("/ldap").Subrouter()
	BaseRoutes.Brand = BaseRoutes.ApiRoot.PathPrefix("/brand").Subrouter()
	BaseRoutes.System = BaseRoutes.ApiRoot.PathPrefix("/system").Subrouter()
	BaseRoutes.Preferences = BaseRoutes.User.PathPrefix("/preferences").Subrouter()
	BaseRoutes.License = BaseRoutes.ApiRoot.PathPrefix("/license").Subrouter()
	BaseRoutes.Public = BaseRoutes.ApiRoot.PathPrefix("/public").Subrouter()
	BaseRoutes.Reactions = BaseRoutes.ApiRoot.PathPrefix("/reactions").Subrouter()
	BaseRoutes.Jobs = BaseRoutes.ApiRoot.PathPrefix("/jobs").Subrouter()
	BaseRoutes.Elasticsearch = BaseRoutes.ApiRoot.PathPrefix("/elasticsearch").Subrouter()

	BaseRoutes.Emojis = BaseRoutes.ApiRoot.PathPrefix("/emoji").Subrouter()
	BaseRoutes.Emoji = BaseRoutes.Emojis.PathPrefix("/{emoji_id:[A-Za-z0-9]+}").Subrouter()

	BaseRoutes.ReactionByNameForPostForUser = BaseRoutes.PostForUser.PathPrefix("/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}").Subrouter()

	BaseRoutes.Webrtc = BaseRoutes.ApiRoot.PathPrefix("/webrtc").Subrouter()

	BaseRoutes.OpenGraph = BaseRoutes.ApiRoot.PathPrefix("/opengraph").Subrouter()

	InitUser()
	InitTeam()
	InitChannel()
	InitPost()
	InitFile()
	InitSystem()
	InitWebhook()
	InitPreference()
	InitSaml()
	InitCompliance()
	InitCluster()
	InitLdap()
	InitElasticsearch()
	InitBrand()
	InitJob()
	InitCommand()
	InitStatus()
	InitWebSocket()
	InitEmoji()
	InitOAuth()
	InitReaction()
	InitWebrtc()
	InitOpenGraph()

	app.Srv.Router.Handle("/api/v4/{anything:.*}", http.HandlerFunc(Handle404))

	// REMOVE CONDITION WHEN APIv3 REMOVED
	if full {
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
