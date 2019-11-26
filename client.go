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

		Bot:           BotService{api},
		Channel:       ChannelService{api},
		Configuration: ConfigurationService{api},
		SlashCommand:  SlashCommandService{api},
		Emoji:         EmojiService{api},
		File:          FileService{api},
		Frontend:      FrontendService{api},
		Group:         GroupService{api},
		KV:            KVService{api},
		Log:           LogService{api},
		Mail:          MailService{api},
		Plugin:        PluginService{api},
		Post:          PostService{api},
		Session:       SessionService{api},
		System:        SystemService{api},
		Team:          TeamService{api},
		User:          UserService{api},
	}
}
