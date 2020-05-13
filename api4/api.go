// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/configservice"
	"github.com/mattermost/mattermost-server/v5/web"

	_ "github.com/mattermost/go-i18n/i18n"
)

type Routes struct {
	Root    *mux.Router // ''
	ApiRoot *mux.Router // 'api/v4'

	Users          *mux.Router // 'api/v4/users'
	User           *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}'
	UserByUsername *mux.Router // 'api/v4/users/username/{username:[A-Za-z0-9\\_\\-\\.]+}'
	UserByEmail    *mux.Router // 'api/v4/users/email/{email:.+}'

	Bots *mux.Router // 'api/v4/bots'
	Bot  *mux.Router // 'api/v4/bots/{bot_user_id:[A-Za-z0-9]+}'

	Teams              *mux.Router // 'api/v4/teams'
	TeamsForUser       *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams'
	Team               *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}'
	TeamForUser        *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/teams/{team_id:[A-Za-z0-9]+}'
	TeamByName         *mux.Router // 'api/v4/teams/name/{team_name:[A-Za-z0-9_-]+}'
	TeamMembers        *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members'
	TeamMember         *mux.Router // 'api/v4/teams/{team_id:[A-Za-z0-9]+}/members/{user_id:[A-Za-z0-9]+}'
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
	ChannelModerations       *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/moderations'

	Posts           *mux.Router // 'api/v4/posts'
	Post            *mux.Router // 'api/v4/posts/{post_id:[A-Za-z0-9]+}'
	PostsForChannel *mux.Router // 'api/v4/channels/{channel_id:[A-Za-z0-9]+}/posts'
	PostsForUser    *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts'
	PostForUser     *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}'

	Files *mux.Router // 'api/v4/files'
	File  *mux.Router // 'api/v4/files/{file_id:[A-Za-z0-9]+}'

	Plugins *mux.Router // 'api/v4/plugins'
	Plugin  *mux.Router // 'api/v4/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}'

	PublicFile *mux.Router // '/files/{file_id:[A-Za-z0-9]+}/public'

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

	Image *mux.Router // 'api/v4/image'

	LDAP *mux.Router // 'api/v4/ldap'

	Elasticsearch *mux.Router // 'api/v4/elasticsearch'

	DataRetention *mux.Router // 'api/v4/data_retention'

	Brand *mux.Router // 'api/v4/brand'

	System *mux.Router // 'api/v4/system'

	Jobs *mux.Router // 'api/v4/jobs'

	Preferences *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/preferences'

	License *mux.Router // 'api/v4/license'

	Public *mux.Router // 'api/v4/public'

	Reactions *mux.Router // 'api/v4/reactions'

	Roles   *mux.Router // 'api/v4/roles'
	Schemes *mux.Router // 'api/v4/schemes'

	Emojis      *mux.Router // 'api/v4/emoji'
	Emoji       *mux.Router // 'api/v4/emoji/{emoji_id:[A-Za-z0-9]+}'
	EmojiByName *mux.Router // 'api/v4/emoji/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	ReactionByNameForPostForUser *mux.Router // 'api/v4/users/{user_id:[A-Za-z0-9]+}/posts/{post_id:[A-Za-z0-9]+}/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}'

	TermsOfService *mux.Router // 'api/v4/terms_of_service'
	Groups         *mux.Router // 'api/v4/groups'
}

type API struct {
	ConfigService       configservice.ConfigService
	GetGlobalAppOptions app.AppOptionCreator
	BaseRoutes          *Routes
}

func Init(configservice configservice.ConfigService, globalOptionsFunc app.AppOptionCreator, root *mux.Router) *API {
	api := &API{
		ConfigService:       configservice,
		GetGlobalAppOptions: globalOptionsFunc,
		BaseRoutes:          &Routes{},
	}

	api.BaseRoutes.Root = root
	api.BaseRoutes.ApiRoot = root.PathPrefix(model.API_URL_SUFFIX).Subrouter()

	api.BaseRoutes.Users = api.BaseRoutes.ApiRoot.PathPrefix("/users").Subrouter()
	api.BaseRoutes.User = api.BaseRoutes.ApiRoot.PathPrefix("/users/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.UserByUsername = api.BaseRoutes.Users.PathPrefix("/username/{username:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	api.BaseRoutes.UserByEmail = api.BaseRoutes.Users.PathPrefix("/email/{email:.+}").Subrouter()

	api.BaseRoutes.Bots = api.BaseRoutes.ApiRoot.PathPrefix("/bots").Subrouter()
	api.BaseRoutes.Bot = api.BaseRoutes.ApiRoot.PathPrefix("/bots/{bot_user_id:[A-Za-z0-9]+}").Subrouter()

	api.BaseRoutes.Teams = api.BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.TeamsForUser = api.BaseRoutes.User.PathPrefix("/teams").Subrouter()
	api.BaseRoutes.Team = api.BaseRoutes.Teams.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamForUser = api.BaseRoutes.TeamsForUser.PathPrefix("/{team_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamByName = api.BaseRoutes.Teams.PathPrefix("/name/{team_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.TeamMembers = api.BaseRoutes.Team.PathPrefix("/members").Subrouter()
	api.BaseRoutes.TeamMember = api.BaseRoutes.TeamMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.TeamMembersForUser = api.BaseRoutes.User.PathPrefix("/teams/members").Subrouter()

	api.BaseRoutes.Channels = api.BaseRoutes.ApiRoot.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.Channel = api.BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelForUser = api.BaseRoutes.User.PathPrefix("/channels/{channel_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelByName = api.BaseRoutes.Team.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelByNameForTeamName = api.BaseRoutes.TeamByName.PathPrefix("/channels/name/{channel_name:[A-Za-z0-9_-]+}").Subrouter()
	api.BaseRoutes.ChannelsForTeam = api.BaseRoutes.Team.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.ChannelMembers = api.BaseRoutes.Channel.PathPrefix("/members").Subrouter()
	api.BaseRoutes.ChannelMember = api.BaseRoutes.ChannelMembers.PathPrefix("/{user_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.ChannelMembersForUser = api.BaseRoutes.User.PathPrefix("/teams/{team_id:[A-Za-z0-9]+}/channels/members").Subrouter()
	api.BaseRoutes.ChannelModerations = api.BaseRoutes.Channel.PathPrefix("/moderations").Subrouter()

	api.BaseRoutes.Posts = api.BaseRoutes.ApiRoot.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.Post = api.BaseRoutes.Posts.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.PostsForChannel = api.BaseRoutes.Channel.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.PostsForUser = api.BaseRoutes.User.PathPrefix("/posts").Subrouter()
	api.BaseRoutes.PostForUser = api.BaseRoutes.PostsForUser.PathPrefix("/{post_id:[A-Za-z0-9]+}").Subrouter()

	api.BaseRoutes.Files = api.BaseRoutes.ApiRoot.PathPrefix("/files").Subrouter()
	api.BaseRoutes.File = api.BaseRoutes.Files.PathPrefix("/{file_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.PublicFile = api.BaseRoutes.Root.PathPrefix("/files/{file_id:[A-Za-z0-9]+}/public").Subrouter()

	api.BaseRoutes.Plugins = api.BaseRoutes.ApiRoot.PathPrefix("/plugins").Subrouter()
	api.BaseRoutes.Plugin = api.BaseRoutes.Plugins.PathPrefix("/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()

	api.BaseRoutes.Commands = api.BaseRoutes.ApiRoot.PathPrefix("/commands").Subrouter()
	api.BaseRoutes.Command = api.BaseRoutes.Commands.PathPrefix("/{command_id:[A-Za-z0-9]+}").Subrouter()

	api.BaseRoutes.Hooks = api.BaseRoutes.ApiRoot.PathPrefix("/hooks").Subrouter()
	api.BaseRoutes.IncomingHooks = api.BaseRoutes.Hooks.PathPrefix("/incoming").Subrouter()
	api.BaseRoutes.IncomingHook = api.BaseRoutes.IncomingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.OutgoingHooks = api.BaseRoutes.Hooks.PathPrefix("/outgoing").Subrouter()
	api.BaseRoutes.OutgoingHook = api.BaseRoutes.OutgoingHooks.PathPrefix("/{hook_id:[A-Za-z0-9]+}").Subrouter()

	api.BaseRoutes.SAML = api.BaseRoutes.ApiRoot.PathPrefix("/saml").Subrouter()

	api.BaseRoutes.OAuth = api.BaseRoutes.ApiRoot.PathPrefix("/oauth").Subrouter()
	api.BaseRoutes.OAuthApps = api.BaseRoutes.OAuth.PathPrefix("/apps").Subrouter()
	api.BaseRoutes.OAuthApp = api.BaseRoutes.OAuthApps.PathPrefix("/{app_id:[A-Za-z0-9]+}").Subrouter()

	api.BaseRoutes.Compliance = api.BaseRoutes.ApiRoot.PathPrefix("/compliance").Subrouter()
	api.BaseRoutes.Cluster = api.BaseRoutes.ApiRoot.PathPrefix("/cluster").Subrouter()
	api.BaseRoutes.LDAP = api.BaseRoutes.ApiRoot.PathPrefix("/ldap").Subrouter()
	api.BaseRoutes.Brand = api.BaseRoutes.ApiRoot.PathPrefix("/brand").Subrouter()
	api.BaseRoutes.System = api.BaseRoutes.ApiRoot.PathPrefix("/system").Subrouter()
	api.BaseRoutes.Preferences = api.BaseRoutes.User.PathPrefix("/preferences").Subrouter()
	api.BaseRoutes.License = api.BaseRoutes.ApiRoot.PathPrefix("/license").Subrouter()
	api.BaseRoutes.Public = api.BaseRoutes.ApiRoot.PathPrefix("/public").Subrouter()
	api.BaseRoutes.Reactions = api.BaseRoutes.ApiRoot.PathPrefix("/reactions").Subrouter()
	api.BaseRoutes.Jobs = api.BaseRoutes.ApiRoot.PathPrefix("/jobs").Subrouter()
	api.BaseRoutes.Elasticsearch = api.BaseRoutes.ApiRoot.PathPrefix("/elasticsearch").Subrouter()
	api.BaseRoutes.DataRetention = api.BaseRoutes.ApiRoot.PathPrefix("/data_retention").Subrouter()

	api.BaseRoutes.Emojis = api.BaseRoutes.ApiRoot.PathPrefix("/emoji").Subrouter()
	api.BaseRoutes.Emoji = api.BaseRoutes.ApiRoot.PathPrefix("/emoji/{emoji_id:[A-Za-z0-9]+}").Subrouter()
	api.BaseRoutes.EmojiByName = api.BaseRoutes.Emojis.PathPrefix("/name/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}").Subrouter()

	api.BaseRoutes.ReactionByNameForPostForUser = api.BaseRoutes.PostForUser.PathPrefix("/reactions/{emoji_name:[A-Za-z0-9\\_\\-\\+]+}").Subrouter()

	api.BaseRoutes.OpenGraph = api.BaseRoutes.ApiRoot.PathPrefix("/opengraph").Subrouter()

	api.BaseRoutes.Roles = api.BaseRoutes.ApiRoot.PathPrefix("/roles").Subrouter()
	api.BaseRoutes.Schemes = api.BaseRoutes.ApiRoot.PathPrefix("/schemes").Subrouter()

	api.BaseRoutes.Image = api.BaseRoutes.ApiRoot.PathPrefix("/image").Subrouter()

	api.BaseRoutes.TermsOfService = api.BaseRoutes.ApiRoot.PathPrefix("/terms_of_service").Subrouter()
	api.BaseRoutes.Groups = api.BaseRoutes.ApiRoot.PathPrefix("/groups").Subrouter()

	api.InitUser()
	api.InitBot()
	api.InitTeam()
	api.InitChannel()
	api.InitPost()
	api.InitFile()
	api.InitSystem()
	api.InitLicense()
	api.InitConfig()
	api.InitWebhook()
	api.InitPreference()
	api.InitSaml()
	api.InitCompliance()
	api.InitCluster()
	api.InitLdap()
	api.InitElasticsearch()
	api.InitDataRetention()
	api.InitBrand()
	api.InitJob()
	api.InitCommand()
	api.InitStatus()
	api.InitWebSocket()
	api.InitEmoji()
	api.InitOAuth()
	api.InitReaction()
	api.InitOpenGraph()
	api.InitPlugin()
	api.InitRole()
	api.InitScheme()
	api.InitImage()
	api.InitTermsOfService()
	api.InitGroup()
	api.InitAction()

	root.Handle("/api/v4/{anything:.*}", http.HandlerFunc(api.Handle404))

	return api
}

func InitLocal(configservice configservice.ConfigService, globalOptionsFunc app.AppOptionCreator, root *mux.Router) *API {
	api := &API{
		ConfigService:       configservice,
		GetGlobalAppOptions: globalOptionsFunc,
		BaseRoutes:          &Routes{},
	}

	api.BaseRoutes.Root = root
	api.BaseRoutes.ApiRoot = root.PathPrefix(model.API_URL_SUFFIX).Subrouter()

	api.BaseRoutes.Teams = api.BaseRoutes.ApiRoot.PathPrefix("/teams").Subrouter()

	api.BaseRoutes.Channels = api.BaseRoutes.ApiRoot.PathPrefix("/channels").Subrouter()
	api.BaseRoutes.Channel = api.BaseRoutes.Channels.PathPrefix("/{channel_id:[A-Za-z0-9]+}").Subrouter()

	api.InitChannelLocal()
	api.InitTeamLocal()

	root.Handle("/api/v4/{anything:.*}", http.HandlerFunc(api.Handle404))

	return api
}

func (api *API) Handle404(w http.ResponseWriter, r *http.Request) {
	web.Handle404(api.ConfigService, w, r)
}

var ReturnStatusOK = web.ReturnStatusOK
