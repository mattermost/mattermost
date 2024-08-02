package pluginapi

import (
	"github.com/blang/semver/v4"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
)

// Client is a streamlined wrapper over the mattermost plugin API.
type Client struct {
	api plugin.API

	Bot           BotService
	Channel       ChannelService
	Cluster       ClusterService
	Configuration ConfigurationService
	SlashCommand  SlashCommandService
	OAuth         OAuthService
	Emoji         EmojiService
	File          FileService
	Frontend      FrontendService
	Group         GroupService
	KV            KVService
	Log           LogService
	Mail          MailService
	Plugin        PluginService
	Post          PostService
	Session       SessionService
	Store         *StoreService
	System        SystemService
	Team          TeamService
	User          UserService
}

// NewClient creates a new instance of Client.
//
// This client must only be created once per plugin to
// prevent reacquiring of resources.
func NewClient(api plugin.API, driver plugin.Driver) *Client {
	return &Client{
		api: api,

		Bot:           BotService{api: api},
		Channel:       ChannelService{api: api},
		Cluster:       ClusterService{api: api},
		Configuration: ConfigurationService{api: api},
		SlashCommand:  SlashCommandService{api: api},
		OAuth:         OAuthService{api: api},
		Emoji:         EmojiService{api: api},
		File:          FileService{api: api},
		Frontend:      FrontendService{api: api},
		Group:         GroupService{api: api},
		KV:            KVService{api: api},
		Log:           LogService{api: api},
		Mail:          MailService{api: api},
		Plugin:        PluginService{api: api},
		Post:          PostService{api: api},
		Session:       SessionService{api: api},
		Store: &StoreService{
			api:    api,
			driver: driver,
		},
		System: SystemService{api: api},
		Team:   TeamService{api: api},
		User:   UserService{api: api},
	}
}

func ensureServerVersion(api plugin.API, required string) error {
	serverVersion := api.GetServerVersion()
	currentVersion := semver.MustParse(serverVersion)
	requiredVersion := semver.MustParse(required)

	if currentVersion.LT(requiredVersion) {
		return errors.Errorf("incompatible server version for plugin, minimum required version: %s, current version: %s", required, serverVersion)
	}

	return nil
}
