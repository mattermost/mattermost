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
// Plugins obtain access to the API by embedding MattermostPlugin and accessing the API member
// directly.
type API interface {
	// LoadPluginConfiguration loads the plugin's configuration. dest should be a pointer to a
	// struct that the configuration JSON can be unmarshalled to.
	LoadPluginConfiguration(dest interface{}) error

	// RegisterCommand registers a custom slash command. When the command is triggered, your plugin
	// can fulfill it via the ExecuteCommand hook.
	RegisterCommand(command *model.Command) error

	// UnregisterCommand unregisters a command previously registered via RegisterCommand.
	UnregisterCommand(teamId, trigger string) error

	// GetSession returns the session object for the Session ID
	GetSession(sessionId string) (*model.Session, *model.AppError)

	// GetConfig fetches the currently persisted config
	GetConfig() *model.Config

	// SaveConfig sets the given config and persists the changes
	SaveConfig(config *model.Config) *model.AppError

	// GetServerVersion return the current Mattermost server version
	GetServerVersion() string

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

	// GetUserStatus will get a user's status.
	GetUserStatus(userId string) (*model.Status, *model.AppError)

	// GetUserStatusesByIds will return a list of user statuses based on the provided slice of user IDs.
	GetUserStatusesByIds(userIds []string) ([]*model.Status, *model.AppError)

	// UpdateUserStatus will set a user's status until the user, or another integration/plugin, sets it back to online.
	// The status parameter can be: "online", "away", "dnd", or "offline".
	UpdateUserStatus(userId, status string) (*model.Status, *model.AppError)

	// GetLDAPUserAttributes will return LDAP attributes for a user.
	// The attributes parameter should be a list of attributes to pull.
	// Returns a map with attribute names as keys and the user's attributes as values.
	// Requires an enterprise license, LDAP to be configured and for the user to use LDAP as an authentication method.
	GetLDAPUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError)

	// CreateTeam creates a team.
	CreateTeam(team *model.Team) (*model.Team, *model.AppError)

	// DeleteTeam deletes a team.
	DeleteTeam(teamId string) *model.AppError

	// GetTeam gets all teams.
	GetTeams() ([]*model.Team, *model.AppError)

	// GetTeam gets a team.
	GetTeam(teamId string) (*model.Team, *model.AppError)

	// GetTeamByName gets a team by its name.
	GetTeamByName(name string) (*model.Team, *model.AppError)

	// UpdateTeam updates a team.
	UpdateTeam(team *model.Team) (*model.Team, *model.AppError)

	// CreateTeamMember creates a team membership.
	CreateTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)

	// CreateTeamMember creates a team membership for all provided user ids.
	CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, *model.AppError)

	// DeleteTeamMember deletes a team membership.
	DeleteTeamMember(teamId, userId, requestorId string) *model.AppError

	// GetTeamMembers returns the memberships of a specific team.
	GetTeamMembers(teamId string, offset, limit int) ([]*model.TeamMember, *model.AppError)

	// GetTeamMember returns a specific membership.
	GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)

	// UpdateTeamMemberRoles updates the role for a team membership.
	UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, *model.AppError)

	// CreateChannel creates a channel.
	CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// DeleteChannel deletes a channel.
	DeleteChannel(channelId string) *model.AppError

	// GetPublicChannelsForTeam gets a list of all channels.
	GetPublicChannelsForTeam(teamId string, offset, limit int) (*model.ChannelList, *model.AppError)

	// GetChannel gets a channel.
	GetChannel(channelId string) (*model.Channel, *model.AppError)

	// GetChannelByName gets a channel by its name, given a team id.
	GetChannelByName(teamId, name string, includeDeleted bool) (*model.Channel, *model.AppError)

	// GetChannelByNameForTeamName gets a channel by its name, given a team name.
	GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, *model.AppError)

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

	// AddReaction add a reaction to a post.
	AddReaction(reaction *model.Reaction) (*model.Reaction, *model.AppError)

	// RemoveReaction remove a reaction from a post.
	RemoveReaction(reaction *model.Reaction) *model.AppError

	// GetReaction get the reactions of a post.
	GetReactions(postId string) ([]*model.Reaction, *model.AppError)

	// SendEphemeralPost creates an ephemeral post.
	SendEphemeralPost(userId string, post *model.Post) *model.Post

	// DeletePost deletes a post.
	DeletePost(postId string) *model.AppError

	// GetPost gets a post.
	GetPost(postId string) (*model.Post, *model.AppError)

	// UpdatePost updates a post.
	UpdatePost(post *model.Post) (*model.Post, *model.AppError)

	// CopyFileInfos duplicates the FileInfo objects referenced by the given file ids,
	// recording the given user id as the new creator and returning the new set of file ids.
	//
	// The duplicate FileInfo objects are not initially linked to a post, but may now be passed
	// to CreatePost. Use this API to duplicate a post and its file attachments without
	// actually duplicating the uploaded files.
	CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError)

	// GetFileInfo gets a File Info for a specific fileId
	GetFileInfo(fileId string) (*model.FileInfo, *model.AppError)

	// ReadFileAtPath reads the file from the backend for a specific path
	ReadFile(path string) ([]byte, *model.AppError)

	// KVSet will store a key-value pair, unique per plugin.
	KVSet(key string, value []byte) *model.AppError

	// KVGet will retrieve a value based on the key. Returns nil for non-existent keys.
	KVGet(key string) ([]byte, *model.AppError)

	// KVDelete will remove a key-value pair. Returns nil for non-existent keys.
	KVDelete(key string) *model.AppError

	// PublishWebSocketEvent sends an event to WebSocket connections.
	// event is the type and will be prepended with "custom_<pluginid>_"
	// payload is the data sent with the event. Interface values must be primitive Go types or mattermost-server/model types
	// broadcast determines to which users to send the event
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)

	// HasPermissionTo check if the user has the permission at system scope.
	HasPermissionTo(userId string, permission *model.Permission) bool

	// HasPermissionToTeam check if the user has the permission at team scope.
	HasPermissionToTeam(userId, teamId string, permission *model.Permission) bool

	// HasPermissionToChannel check if the user has the permission at channel scope.
	HasPermissionToChannel(userId, channelId string, permission *model.Permission) bool

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

var handshake = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "MATTERMOST_PLUGIN",
	MagicCookieValue: "Securely message teams, anywhere.",
}
