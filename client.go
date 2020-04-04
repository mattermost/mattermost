package pluginapi

import (
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// Client is a streamlined wrapper over the mattermost plugin API.
type Client struct {
	api plugin.API

	Bot           BotService
	Configuration ConfigurationService
	Channel       ChannelService
	SlashCommand  SlashCommandService
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
	System        SystemService
	Team          TeamService
	User          UserService
}

// NewClient creates a new instance of Client.
func NewClient(api plugin.API) *Client {
	return &Client{
		api: api,

		Bot:           BotService{api: api},
		Channel:       ChannelService{api: api},
		Configuration: ConfigurationService{api: api},
		SlashCommand:  SlashCommandService{api: api},
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
		System:        SystemService{api: api},
		Team:          TeamService{api: api},
		User:          UserService{api: api},
	}
}
