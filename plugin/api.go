// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	"github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost-server/model"
)

// The API can be used to retrieve data or perform actions on behalf of the plugin. Most methods
// have direct counterparts in the REST API and very similar behavior.
//
// Plugins can obtain access to the API by implementing the OnActivate hook.
type API interface {
	// LoadPluginConfiguration loads the plugin's configuration. dest should be a pointer to a
	// struct that the configuration JSON can be unmarshalled to.
	LoadPluginConfiguration(dest interface{}) error

	// RegisterCommand registers a custom slash command. When the command is triggered, your plugin
	// can fulfill it via the ExecuteCommand hook.
	RegisterCommand(command *model.Command) error

	// UnregisterCommand unregisters a command previously registered via RegisterCommand.
	UnregisterCommand(teamId, trigger string) error

	// CreateUser creates a user.
	CreateUser(user *model.User) (*model.User, *model.AppError)

	// DeleteUser deletes a user.
	DeleteUser(userId string) *model.AppError

	// GetUser gets a user.
	GetUser(userId string) (*model.User, *model.AppError)

	// GetUserByEmail gets a user by their email address.
	GetUserByEmail(email string) (*model.User, *model.AppError)

	// GetUserByUsername gets a user by their username.
	GetUserByUsername(name string) (*model.User, *model.AppError)

	// UpdateUser updates a user.
	UpdateUser(user *model.User) (*model.User, *model.AppError)

	// CreateTeam creates a team.
	CreateTeam(team *model.Team) (*model.Team, *model.AppError)

	// DeleteTeam deletes a team.
	DeleteTeam(teamId string) *model.AppError

	// GetTeam gets a team.
	GetTeam(teamId string) (*model.Team, *model.AppError)

	// GetTeamByName gets a team by its name.
	GetTeamByName(name string) (*model.Team, *model.AppError)

	// UpdateTeam updates a team.
	UpdateTeam(team *model.Team) (*model.Team, *model.AppError)

	// CreateChannel creates a channel.
	CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// DeleteChannel deletes a channel.
	DeleteChannel(channelId string) *model.AppError

	// GetChannel gets a channel.
	GetChannel(channelId string) (*model.Channel, *model.AppError)

	// GetChannelByName gets a channel by its name.
	GetChannelByName(name, teamId string) (*model.Channel, *model.AppError)

	// GetDirectChannel gets a direct message channel.
	GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError)

	// GetGroupChannel gets a group message channel.
	GetGroupChannel(userIds []string) (*model.Channel, *model.AppError)

	// UpdateChannel updates a channel.
	UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// AddChannelMember creates a channel membership for a user.
	AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)

	// GetChannelMember gets a channel membership for a user.
	GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)

	// UpdateChannelMemberRoles updates a user's roles for a channel.
	UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError)

	// UpdateChannelMemberNotifications updates a user's notification properties for a channel.
	UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError)

	// DeleteChannelMember deletes a channel membership for a user.
	DeleteChannelMember(channelId, userId string) *model.AppError

	// CreatePost creates a post.
	CreatePost(post *model.Post) (*model.Post, *model.AppError)

	// DeletePost deletes a post.
	DeletePost(postId string) *model.AppError

	// GetPost gets a post.
	GetPost(postId string) (*model.Post, *model.AppError)

	// UpdatePost updates a post.
	UpdatePost(post *model.Post) (*model.Post, *model.AppError)

	// Set will store a key-value pair, unique per plugin.
	KVSet(key string, value []byte) *model.AppError

	// Get will retrieve a value based on the key. Returns nil for non-existent keys.
	KVGet(key string) ([]byte, *model.AppError)

	// Delete will remove a key-value pair. Returns nil for non-existent keys.
	KVDelete(key string) *model.AppError

	// PublishWebSocketEvent sends an event to WebSocket connections.
	// event is the type and will be prepended with "custom_<pluginid>_"
	// payload is the data sent with the event. Interface values must be primitive Go types or mattermost-server/model types
	// broadcast determines to which users to send the event
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)

	// LogDebug writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	LogDebug(msg string, keyValuePairs ...interface{})

	// LogInfo writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	LogInfo(msg string, keyValuePairs ...interface{})

	// LogError writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	LogError(msg string, keyValuePairs ...interface{})

	// LogWarn writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	LogWarn(msg string, keyValuePairs ...interface{})
}

var Handshake = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "MATTERMOST_PLUGIN",
	MagicCookieValue: "Securely message teams, anywhere.",
}
