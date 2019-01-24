// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package plugin

import (
	plugin "github.com/hashicorp/go-plugin"
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

	// GetPluginConfig fetches the currently persisted config of plugin
	//
	// Minimum server version: 5.6
	GetPluginConfig() map[string]interface{}

	// SavePluginConfig sets the given config for plugin and persists the changes
	//
	// Minimum server version: 5.6
	SavePluginConfig(config map[string]interface{}) *model.AppError

	// GetServerVersion return the current Mattermost server version
	//
	// Minimum server version: 5.4
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

	// GetUsersByUsernames gets users by their usernames.
	//
	// Minimum server version: 5.6
	GetUsersByUsernames(usernames []string) ([]*model.User, *model.AppError)

	// GetUsersInTeam gets users in team.
	//
	// Minimum server version: 5.6
	GetUsersInTeam(teamId string, page int, perPage int) ([]*model.User, *model.AppError)

	// GetTeamIcon gets the team icon.
	//
	// Minimum server version: 5.6
	GetTeamIcon(teamId string) ([]byte, *model.AppError)

	// SetTeamIcon sets the team icon.
	//
	// Minimum server version: 5.6
	SetTeamIcon(teamId string, data []byte) *model.AppError

	// RemoveTeamIcon removes the team icon.
	//
	// Minimum server version: 5.6
	RemoveTeamIcon(teamId string) *model.AppError

	// UpdateUser updates a user.
	UpdateUser(user *model.User) (*model.User, *model.AppError)

	// GetUserStatus will get a user's status.
	GetUserStatus(userId string) (*model.Status, *model.AppError)

	// GetUserStatusesByIds will return a list of user statuses based on the provided slice of user IDs.
	GetUserStatusesByIds(userIds []string) ([]*model.Status, *model.AppError)

	// UpdateUserStatus will set a user's status until the user, or another integration/plugin, sets it back to online.
	// The status parameter can be: "online", "away", "dnd", or "offline".
	UpdateUserStatus(userId, status string) (*model.Status, *model.AppError)

	// UpdateUserActive deactivates or reactivates an user.
	//
	// Minimum server version: 5.8
	UpdateUserActive(userId string, active bool) *model.AppError

	// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
	// The sortBy parameter can be: "username" or "status".
	//
	// Minimum server version: 5.6
	GetUsersInChannel(channelId, sortBy string, page, perPage int) ([]*model.User, *model.AppError)

	// GetLDAPUserAttributes will return LDAP attributes for a user.
	// The attributes parameter should be a list of attributes to pull.
	// Returns a map with attribute names as keys and the user's attributes as values.
	// Requires an enterprise license, LDAP to be configured and for the user to use LDAP as an authentication method.
	//
	// Minimum server version: 5.3
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

	// GetTeamsUnreadForUser gets the unread message and mention counts for each team to which the given user belongs.
	//
	// Minimum server version: 5.6
	GetTeamsUnreadForUser(userId string) ([]*model.TeamUnread, *model.AppError)

	// UpdateTeam updates a team.
	UpdateTeam(team *model.Team) (*model.Team, *model.AppError)

	// SearchTeams search a team.
	//
	// Minimum server version: 5.8
	SearchTeams(term string) ([]*model.Team, *model.AppError)

	// GetTeamsForUser returns list of teams of given user ID.
	//
	// Minimum server version: 5.6
	GetTeamsForUser(userId string) ([]*model.Team, *model.AppError)

	// CreateTeamMember creates a team membership.
	CreateTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)

	// CreateTeamMember creates a team membership for all provided user ids.
	CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, *model.AppError)

	// DeleteTeamMember deletes a team membership.
	DeleteTeamMember(teamId, userId, requestorId string) *model.AppError

	// GetTeamMembers returns the memberships of a specific team.
	GetTeamMembers(teamId string, page, perPage int) ([]*model.TeamMember, *model.AppError)

	// GetTeamMember returns a specific membership.
	GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)

	// UpdateTeamMemberRoles updates the role for a team membership.
	UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, *model.AppError)

	// CreateChannel creates a channel.
	CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// DeleteChannel deletes a channel.
	DeleteChannel(channelId string) *model.AppError

	// GetPublicChannelsForTeam gets a list of all channels.
	GetPublicChannelsForTeam(teamId string, page, perPage int) ([]*model.Channel, *model.AppError)

	// GetChannel gets a channel.
	GetChannel(channelId string) (*model.Channel, *model.AppError)

	// GetChannelByName gets a channel by its name, given a team id.
	GetChannelByName(teamId, name string, includeDeleted bool) (*model.Channel, *model.AppError)

	// GetChannelByNameForTeamName gets a channel by its name, given a team name.
	GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, *model.AppError)

	// GetChannelsForTeamForUser gets a list of channels for given user ID in given team ID.
	//
	// Minimum server version: 5.6
	GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool) ([]*model.Channel, *model.AppError)

	// GetChannelStats gets statistics for a channel.
	//
	// Minimum server version: 5.6
	GetChannelStats(channelId string) (*model.ChannelStats, *model.AppError)

	// GetDirectChannel gets a direct message channel.
	// If the channel does not exist it will create it.
	GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError)

	// GetGroupChannel gets a group message channel.
	// If the channel does not exist it will create it.
	GetGroupChannel(userIds []string) (*model.Channel, *model.AppError)

	// UpdateChannel updates a channel.
	UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError)

	// SearchChannels returns the channels on a team matching the provided search term.
	//
	// Minimum server version: 5.6
	SearchChannels(teamId string, term string) ([]*model.Channel, *model.AppError)

	// SearchUsers returns a list of users based on some search criteria.
	//
	// Minimum server version: 5.6
	SearchUsers(search *model.UserSearch) ([]*model.User, *model.AppError)

	// AddChannelMember creates a channel membership for a user.
	AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)

	// GetChannelMember gets a channel membership for a user.
	GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)

	// GetChannelMembers gets a channel membership for all users.
	//
	// Minimum server version: 5.6
	GetChannelMembers(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError)

	// GetChannelMembersByIds gets a channel membership for a particular User
	//
	// Minimum server version: 5.6
	GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError)

	// UpdateChannelMemberRoles updates a user's roles for a channel.
	UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError)

	// UpdateChannelMemberNotifications updates a user's notification properties for a channel.
	UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError)

	// DeleteChannelMember deletes a channel membership for a user.
	DeleteChannelMember(channelId, userId string) *model.AppError

	// CreatePost creates a post.
	CreatePost(post *model.Post) (*model.Post, *model.AppError)

	// AddReaction add a reaction to a post.
	//
	// Minimum server version: 5.3
	AddReaction(reaction *model.Reaction) (*model.Reaction, *model.AppError)

	// RemoveReaction remove a reaction from a post.
	//
	// Minimum server version: 5.3
	RemoveReaction(reaction *model.Reaction) *model.AppError

	// GetReaction get the reactions of a post.
	//
	// Minimum server version: 5.3
	GetReactions(postId string) ([]*model.Reaction, *model.AppError)

	// SendEphemeralPost creates an ephemeral post.
	SendEphemeralPost(userId string, post *model.Post) *model.Post

	// DeletePost deletes a post.
	DeletePost(postId string) *model.AppError

	// GetPostThread gets a post with all the other posts in the same thread.
	//
	// Minimum server version: 5.6
	GetPostThread(postId string) (*model.PostList, *model.AppError)

	// GetPost gets a post.
	GetPost(postId string) (*model.Post, *model.AppError)

	// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
	//
	// Minimum server version: 5.6
	GetPostsSince(channelId string, time int64) (*model.PostList, *model.AppError)

	// GetPostsAfter gets a page of posts that were posted after the post provided.
	//
	// Minimum server version: 5.6
	GetPostsAfter(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError)

	// GetPostsBefore gets a page of posts that were posted before the post provided.
	//
	// Minimum server version: 5.6
	GetPostsBefore(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError)

	// GetPostsForChannel gets a list of posts for a channel.
	//
	// Minimum server version: 5.6
	GetPostsForChannel(channelId string, page, perPage int) (*model.PostList, *model.AppError)

	// GetTeamStats gets a team's statistics
	//
	// Minimum server version: 5.8
	GetTeamStats(teamId string) (*model.TeamStats, *model.AppError)

	// UpdatePost updates a post.
	UpdatePost(post *model.Post) (*model.Post, *model.AppError)

	// GetProfileImage gets user's profile image.
	//
	// Minimum server version: 5.6
	GetProfileImage(userId string) ([]byte, *model.AppError)

	// SetProfileImage sets a user's profile image.
	//
	// Minimum server version: 5.6
	SetProfileImage(userId string, data []byte) *model.AppError

	// GetEmojiList returns a page of custom emoji on the system.
	//
	// The sortBy parameter can be: "name".
	//
	// Minimum server version: 5.6
	GetEmojiList(sortBy string, page, perPage int) ([]*model.Emoji, *model.AppError)

	// GetEmojiByName gets an emoji by it's name.
	//
	// Minimum server version: 5.6
	GetEmojiByName(name string) (*model.Emoji, *model.AppError)

	// GetEmoji returns a custom emoji based on the emojiId string.
	//
	// Minimum server version: 5.6
	GetEmoji(emojiId string) (*model.Emoji, *model.AppError)

	// CopyFileInfos duplicates the FileInfo objects referenced by the given file ids,
	// recording the given user id as the new creator and returning the new set of file ids.
	//
	// The duplicate FileInfo objects are not initially linked to a post, but may now be passed
	// to CreatePost. Use this API to duplicate a post and its file attachments without
	// actually duplicating the uploaded files.
	CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError)

	// GetFileInfo gets a File Info for a specific fileId
	//
	// Minimum server version: 5.3
	GetFileInfo(fileId string) (*model.FileInfo, *model.AppError)

	// GetFile gets content of a file by it's ID
	//
	// Minimum Server version: 5.8
	GetFile(fileId string) ([]byte, *model.AppError)

	// GetFileLink gets the public link to a file by fileId.
	//
	// Minimum server version: 5.6
	GetFileLink(fileId string) (string, *model.AppError)

	// ReadFileAtPath reads the file from the backend for a specific path
	//
	// Minimum server version: 5.3
	ReadFile(path string) ([]byte, *model.AppError)

	// GetEmojiImage returns the emoji image.
	//
	// Minimum server version: 5.6
	GetEmojiImage(emojiId string) ([]byte, string, *model.AppError)

	// UploadFile will upload a file to a channel using a multipart request, to be later attached to a post.
	//
	// Minimum server version: 5.6
	UploadFile(data []byte, channelId string, filename string) (*model.FileInfo, *model.AppError)

	// OpenInteractiveDialog will open an interactive dialog on a user's client that
	// generated the trigger ID. Used with interactive message buttons, menus
	// and slash commands.
	//
	// Minimum server version: 5.6
	OpenInteractiveDialog(dialog model.OpenDialogRequest) *model.AppError

	// Plugin Section

	// GetPlugins will return a list of plugin manifests for currently active plugins.
	//
	// Minimum server version: 5.6
	GetPlugins() ([]*model.Manifest, *model.AppError)

	// EnablePlugin will enable an plugin installed.
	//
	// Minimum server version: 5.6
	EnablePlugin(id string) *model.AppError

	// DisablePlugin will disable an enabled plugin.
	//
	// Minimum server version: 5.6
	DisablePlugin(id string) *model.AppError

	// RemovePlugin will disable and delete a plugin.
	//
	// Minimum server version: 5.6
	RemovePlugin(id string) *model.AppError

	// GetPluginStatus will return the status of a plugin.
	//
	// Minimum server version: 5.6
	GetPluginStatus(id string) (*model.PluginStatus, *model.AppError)

	// KV Store Section

	// KVSet will store a key-value pair, unique per plugin.
	KVSet(key string, value []byte) *model.AppError

	// KVSet will store a key-value pair, unique per plugin with an expiry time
	//
	// Minimum server version: 5.6
	KVSetWithExpiry(key string, value []byte, expireInSeconds int64) *model.AppError

	// KVGet will retrieve a value based on the key. Returns nil for non-existent keys.
	KVGet(key string) ([]byte, *model.AppError)

	// KVDelete will remove a key-value pair. Returns nil for non-existent keys.
	KVDelete(key string) *model.AppError

	// KVDeleteAll will remove all key-value pairs for a plugin.
	//
	// Minimum server version: 5.6
	KVDeleteAll() *model.AppError

	// KVList will list all keys for a plugin.
	//
	// Minimum server version: 5.6
	KVList(page, perPage int) ([]string, *model.AppError)

	// PublishWebSocketEvent sends an event to WebSocket connections.
	// event is the type and will be prepended with "custom_<pluginid>_".
	// payload is the data sent with the event. Interface values must be primitive Go types or mattermost-server/model types.
	// broadcast determines to which users to send the event.
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)

	// HasPermissionTo check if the user has the permission at system scope.
	//
	// Minimum server version: 5.3
	HasPermissionTo(userId string, permission *model.Permission) bool

	// HasPermissionToTeam check if the user has the permission at team scope.
	//
	// Minimum server version: 5.3
	HasPermissionToTeam(userId, teamId string, permission *model.Permission) bool

	// HasPermissionToChannel check if the user has the permission at channel scope.
	//
	// Minimum server version: 5.3
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

	// SendMail sends an email to a specific address
	//
	// Minimum server version: 5.7
	SendMail(to, subject, htmlBody string) *model.AppError
}

var handshake = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "MATTERMOST_PLUGIN",
	MagicCookieValue: "Securely message teams, anywhere.",
}
