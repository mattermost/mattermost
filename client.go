package pluginapi

import "github.com/mattermost/mattermost-server/v5/plugin"

// Client is a streamlined wrapper over the mattermost plugin API.
type Client struct {
	api plugin.API

	User     UserService
	Post     PostService
	Reaction ReactionService
	Emoji    EmojiService
	File     FileService
	KV       KVService
	Bot      BotService
	Log      LogService
	Command  CommandService
	Mail     MailService
	Frontend FrontendService
	Group    GroupService
	LDAP     LDAPService
	Plugin   PluginService
	Session  SessionService
}

// NewClient creates a new instance of Client.
func NewClient(api plugin.API) *Client {
	return &Client{
		api:      api,
		User:     UserService{api},
		Post:     PostService{api},
		Reaction: ReactionService{api},
		Emoji:    EmojiService{api},
		File:     FileService{api},
		KV:       KVService{api},
		Bot:      BotService{api},
		Log:      LogService{api},
		Command:  CommandService{api},
		Mail:     MailService{api},
		Frontend: FrontendService{api},
		Group:    GroupService{api},
		LDAP:     LDAPService{api},
		Plugin:   PluginService{api},
		Session:  SessionService{api},
	}
}
