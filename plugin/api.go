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
	//
	// Minimum server version: 5.2
	LoadPluginConfiguration(dest interface{}) error

	// RegisterCommand registers a custom slash command. When the command is triggered, your plugin
	// can fulfill it via the ExecuteCommand hook.
	//
	// Minimum server version: 5.2
	RegisterCommand(command *model.Command) error

	// UnregisterCommand unregisters a command previously registered via RegisterCommand.
	//
	// Minimum server version: 5.2
	UnregisterCommand(teamId, trigger string) error

	// GetSession returns the session object for the Session ID
	//
	// Minimum server version: 5.2
	GetSession(sessionId string) (*model.Session, error)

	// GetConfig fetches the currently persisted config
	//
	// Minimum server version: 5.2
	GetConfig() *model.Config

	// GetUnsanitizedConfig fetches the currently persisted config without removing secrets.
	//
	// Minimum server version: 5.16
	GetUnsanitizedConfig() *model.Config

	// SaveConfig sets the given config and persists the changes
	//
	// Minimum server version: 5.2
	SaveConfig(config *model.Config) error

	// GetPluginConfig fetches the currently persisted config of plugin
	//
	// Minimum server version: 5.6
	GetPluginConfig() map[string]interface{}

	// SavePluginConfig sets the given config for plugin and persists the changes
	//
	// Minimum server version: 5.6
	SavePluginConfig(config map[string]interface{}) error

	// GetBundlePath returns the absolute path where the plugin's bundle was unpacked.
	//
	// Minimum server version: 5.10
	GetBundlePath() (string, error)

	// GetLicense returns the current license used by the Mattermost server. Returns nil if the
	// the server does not have a license.
	//
	// Minimum server version: 5.10
	GetLicense() *model.License

	// GetServerVersion return the current Mattermost server version
	//
	// Minimum server version: 5.4
	GetServerVersion() string

	// GetSystemInstallDate returns the time that Mattermost was first installed and ran.
	//
	// Minimum server version: 5.10
	GetSystemInstallDate() (int64, error)

	// GetDiagnosticId returns a unique identifier used by the server for diagnostic reports.
	//
	// Minimum server version: 5.10
	GetDiagnosticId() string

	// CreateUser creates a user.
	//
	// Minimum server version: 5.2
	CreateUser(user *model.User) (*model.User, error)

	// DeleteUser deletes a user.
	//
	// Minimum server version: 5.2
	DeleteUser(userId string) error

	// GetUsers a list of users based on search options.
	//
	// Minimum server version: 5.10
	GetUsers(options *model.UserGetOptions) ([]*model.User, error)

	// GetUser gets a user.
	//
	// Minimum server version: 5.2
	GetUser(userId string) (*model.User, error)

	// GetUserByEmail gets a user by their email address.
	//
	// Minimum server version: 5.2
	GetUserByEmail(email string) (*model.User, error)

	// GetUserByUsername gets a user by their username.
	//
	// Minimum server version: 5.2
	GetUserByUsername(name string) (*model.User, error)

	// GetUsersByUsernames gets users by their usernames.
	//
	// Minimum server version: 5.6
	GetUsersByUsernames(usernames []string) ([]*model.User, error)

	// GetUsersInTeam gets users in team.
	//
	// Minimum server version: 5.6
	GetUsersInTeam(teamId string, page int, perPage int) ([]*model.User, error)

	// GetTeamIcon gets the team icon.
	//
	// Minimum server version: 5.6
	GetTeamIcon(teamId string) ([]byte, error)

	// SetTeamIcon sets the team icon.
	//
	// Minimum server version: 5.6
	SetTeamIcon(teamId string, data []byte) error

	// RemoveTeamIcon removes the team icon.
	//
	// Minimum server version: 5.6
	RemoveTeamIcon(teamId string) error

	// UpdateUser updates a user.
	//
	// Minimum server version: 5.2
	UpdateUser(user *model.User) (*model.User, error)

	// GetUserStatus will get a user's status.
	//
	// Minimum server version: 5.2
	GetUserStatus(userId string) (*model.Status, error)

	// GetUserStatusesByIds will return a list of user statuses based on the provided slice of user IDs.
	//
	// Minimum server version: 5.2
	GetUserStatusesByIds(userIds []string) ([]*model.Status, error)

	// UpdateUserStatus will set a user's status until the user, or another integration/plugin, sets it back to online.
	// The status parameter can be: "online", "away", "dnd", or "offline".
	//
	// Minimum server version: 5.2
	UpdateUserStatus(userId, status string) (*model.Status, error)

	// UpdateUserActive deactivates or reactivates an user.
	//
	// Minimum server version: 5.8
	UpdateUserActive(userId string, active bool) error

	// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
	// The sortBy parameter can be: "username" or "status".
	//
	// Minimum server version: 5.6
	GetUsersInChannel(channelId, sortBy string, page, perPage int) ([]*model.User, error)

	// GetLDAPUserAttributes will return LDAP attributes for a user.
	// The attributes parameter should be a list of attributes to pull.
	// Returns a map with attribute names as keys and the user's attributes as values.
	// Requires an enterprise license, LDAP to be configured and for the user to use LDAP as an authentication method.
	//
	// Minimum server version: 5.3
	GetLDAPUserAttributes(userId string, attributes []string) (map[string]string, error)

	// CreateTeam creates a team.
	//
	// Minimum server version: 5.2
	CreateTeam(team *model.Team) (*model.Team, error)

	// DeleteTeam deletes a team.
	//
	// Minimum server version: 5.2
	DeleteTeam(teamId string) error

	// GetTeam gets all teams.
	//
	// Minimum server version: 5.2
	GetTeams() ([]*model.Team, error)

	// GetTeam gets a team.
	//
	// Minimum server version: 5.2
	GetTeam(teamId string) (*model.Team, error)

	// GetTeamByName gets a team by its name.
	//
	// Minimum server version: 5.2
	GetTeamByName(name string) (*model.Team, error)

	// GetTeamsUnreadForUser gets the unread message and mention counts for each team to which the given user belongs.
	//
	// Minimum server version: 5.6
	GetTeamsUnreadForUser(userId string) ([]*model.TeamUnread, error)

	// UpdateTeam updates a team.
	//
	// Minimum server version: 5.2
	UpdateTeam(team *model.Team) (*model.Team, error)

	// SearchTeams search a team.
	//
	// Minimum server version: 5.8
	SearchTeams(term string) ([]*model.Team, error)

	// GetTeamsForUser returns list of teams of given user ID.
	//
	// Minimum server version: 5.6
	GetTeamsForUser(userId string) ([]*model.Team, error)

	// CreateTeamMember creates a team membership.
	//
	// Minimum server version: 5.2
	CreateTeamMember(teamId, userId string) (*model.TeamMember, error)

	// CreateTeamMember creates a team membership for all provided user ids.
	//
	// Minimum server version: 5.2
	CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, error)

	// DeleteTeamMember deletes a team membership.
	//
	// Minimum server version: 5.2
	DeleteTeamMember(teamId, userId, requestorId string) error

	// GetTeamMembers returns the memberships of a specific team.
	//
	// Minimum server version: 5.2
	GetTeamMembers(teamId string, page, perPage int) ([]*model.TeamMember, error)

	// GetTeamMember returns a specific membership.
	//
	// Minimum server version: 5.2
	GetTeamMember(teamId, userId string) (*model.TeamMember, error)

	// GetTeamMembersForUser returns all team memberships for a user.
	//
	// Minimum server version: 5.10
	GetTeamMembersForUser(userId string, page int, perPage int) ([]*model.TeamMember, error)

	// UpdateTeamMemberRoles updates the role for a team membership.
	//
	// Minimum server version: 5.2
	UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, error)

	// CreateChannel creates a channel.
	//
	// Minimum server version: 5.2
	CreateChannel(channel *model.Channel) (*model.Channel, error)

	// DeleteChannel deletes a channel.
	//
	// Minimum server version: 5.2
	DeleteChannel(channelId string) error

	// GetPublicChannelsForTeam gets a list of all channels.
	//
	// Minimum server version: 5.2
	GetPublicChannelsForTeam(teamId string, page, perPage int) ([]*model.Channel, error)

	// GetChannel gets a channel.
	//
	// Minimum server version: 5.2
	GetChannel(channelId string) (*model.Channel, error)

	// GetChannelByName gets a channel by its name, given a team id.
	//
	// Minimum server version: 5.2
	GetChannelByName(teamId, name string, includeDeleted bool) (*model.Channel, error)

	// GetChannelByNameForTeamName gets a channel by its name, given a team name.
	//
	// Minimum server version: 5.2
	GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, error)

	// GetChannelsForTeamForUser gets a list of channels for given user ID in given team ID.
	//
	// Minimum server version: 5.6
	GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool) ([]*model.Channel, error)

	// GetChannelStats gets statistics for a channel.
	//
	// Minimum server version: 5.6
	GetChannelStats(channelId string) (*model.ChannelStats, error)

	// GetDirectChannel gets a direct message channel.
	// If the channel does not exist it will create it.
	//
	// Minimum server version: 5.2
	GetDirectChannel(userId1, userId2 string) (*model.Channel, error)

	// GetGroupChannel gets a group message channel.
	// If the channel does not exist it will create it.
	//
	// Minimum server version: 5.2
	GetGroupChannel(userIds []string) (*model.Channel, error)

	// UpdateChannel updates a channel.
	//
	// Minimum server version: 5.2
	UpdateChannel(channel *model.Channel) (*model.Channel, error)

	// SearchChannels returns the channels on a team matching the provided search term.
	//
	// Minimum server version: 5.6
	SearchChannels(teamId string, term string) ([]*model.Channel, error)

	// SearchUsers returns a list of users based on some search criteria.
	//
	// Minimum server version: 5.6
	SearchUsers(search *model.UserSearch) ([]*model.User, error)

	// SearchPostsInTeam returns a list of posts in a specific team that match the given params.
	//
	// Minimum server version: 5.10
	SearchPostsInTeam(teamId string, paramsList []*model.SearchParams) ([]*model.Post, error)

	// AddChannelMember creates a channel membership for a user.
	//
	// Minimum server version: 5.2
	AddChannelMember(channelId, userId string) (*model.ChannelMember, error)

	// GetChannelMember gets a channel membership for a user.
	//
	// Minimum server version: 5.2
	GetChannelMember(channelId, userId string) (*model.ChannelMember, error)

	// GetChannelMembers gets a channel membership for all users.
	//
	// Minimum server version: 5.6
	GetChannelMembers(channelId string, page, perPage int) (*model.ChannelMembers, error)

	// GetChannelMembersByIds gets a channel membership for a particular User
	//
	// Minimum server version: 5.6
	GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, error)

	// GetChannelMembersForUser returns all channel memberships on a team for a user.
	//
	// Minimum server version: 5.10
	GetChannelMembersForUser(teamId, userId string, page, perPage int) ([]*model.ChannelMember, error)

	// UpdateChannelMemberRoles updates a user's roles for a channel.
	//
	// Minimum server version: 5.2
	UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, error)

	// UpdateChannelMemberNotifications updates a user's notification properties for a channel.
	//
	// Minimum server version: 5.2
	UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, error)

	// DeleteChannelMember deletes a channel membership for a user.
	//
	// Minimum server version: 5.2
	DeleteChannelMember(channelId, userId string) error

	// CreatePost creates a post.
	//
	// Minimum server version: 5.2
	CreatePost(post *model.Post) (*model.Post, error)

	// AddReaction add a reaction to a post.
	//
	// Minimum server version: 5.3
	AddReaction(reaction *model.Reaction) (*model.Reaction, error)

	// RemoveReaction remove a reaction from a post.
	//
	// Minimum server version: 5.3
	RemoveReaction(reaction *model.Reaction) error

	// GetReaction get the reactions of a post.
	//
	// Minimum server version: 5.3
	GetReactions(postId string) ([]*model.Reaction, error)

	// SendEphemeralPost creates an ephemeral post.
	//
	// Minimum server version: 5.2
	SendEphemeralPost(userId string, post *model.Post) *model.Post

	// UpdateEphemeralPost updates an ephemeral message previously sent to the user.
	// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
	//
	// Minimum server version: 5.2
	UpdateEphemeralPost(userId string, post *model.Post) *model.Post

	// DeleteEphemeralPost deletes an ephemeral message previously sent to the user.
	// EXPERIMENTAL: This API is experimental and can be changed without advance notice.
	//
	// Minimum server version: 5.2
	DeleteEphemeralPost(userId, postId string)

	// DeletePost deletes a post.
	//
	// Minimum server version: 5.2
	DeletePost(postId string) error

	// GetPostThread gets a post with all the other posts in the same thread.
	//
	// Minimum server version: 5.6
	GetPostThread(postId string) (*model.PostList, error)

	// GetPost gets a post.
	//
	// Minimum server version: 5.2
	GetPost(postId string) (*model.Post, error)

	// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
	//
	// Minimum server version: 5.6
	GetPostsSince(channelId string, time int64) (*model.PostList, error)

	// GetPostsAfter gets a page of posts that were posted after the post provided.
	//
	// Minimum server version: 5.6
	GetPostsAfter(channelId, postId string, page, perPage int) (*model.PostList, error)

	// GetPostsBefore gets a page of posts that were posted before the post provided.
	//
	// Minimum server version: 5.6
	GetPostsBefore(channelId, postId string, page, perPage int) (*model.PostList, error)

	// GetPostsForChannel gets a list of posts for a channel.
	//
	// Minimum server version: 5.6
	GetPostsForChannel(channelId string, page, perPage int) (*model.PostList, error)

	// GetTeamStats gets a team's statistics
	//
	// Minimum server version: 5.8
	GetTeamStats(teamId string) (*model.TeamStats, error)

	// UpdatePost updates a post.
	//
	// Minimum server version: 5.2
	UpdatePost(post *model.Post) (*model.Post, error)

	// GetProfileImage gets user's profile image.
	//
	// Minimum server version: 5.6
	GetProfileImage(userId string) ([]byte, error)

	// SetProfileImage sets a user's profile image.
	//
	// Minimum server version: 5.6
	SetProfileImage(userId string, data []byte) error

	// GetEmojiList returns a page of custom emoji on the system.
	//
	// The sortBy parameter can be: "name".
	//
	// Minimum server version: 5.6
	GetEmojiList(sortBy string, page, perPage int) ([]*model.Emoji, error)

	// GetEmojiByName gets an emoji by it's name.
	//
	// Minimum server version: 5.6
	GetEmojiByName(name string) (*model.Emoji, error)

	// GetEmoji returns a custom emoji based on the emojiId string.
	//
	// Minimum server version: 5.6
	GetEmoji(emojiId string) (*model.Emoji, error)

	// CopyFileInfos duplicates the FileInfo objects referenced by the given file ids,
	// recording the given user id as the new creator and returning the new set of file ids.
	//
	// The duplicate FileInfo objects are not initially linked to a post, but may now be passed
	// to CreatePost. Use this API to duplicate a post and its file attachments without
	// actually duplicating the uploaded files.
	//
	// Minimum server version: 5.2
	CopyFileInfos(userId string, fileIds []string) ([]string, error)

	// GetFileInfo gets a File Info for a specific fileId
	//
	// Minimum server version: 5.3
	GetFileInfo(fileId string) (*model.FileInfo, error)

	// GetFile gets content of a file by it's ID
	//
	// Minimum server version: 5.8
	GetFile(fileId string) ([]byte, error)

	// GetFileLink gets the public link to a file by fileId.
	//
	// Minimum server version: 5.6
	GetFileLink(fileId string) (string, error)

	// ReadFileAtPath reads the file from the backend for a specific path
	//
	// Minimum server version: 5.3
	ReadFile(path string) ([]byte, error)

	// GetEmojiImage returns the emoji image.
	//
	// Minimum server version: 5.6
	GetEmojiImage(emojiId string) ([]byte, string, error)

	// UploadFile will upload a file to a channel using a multipart request, to be later attached to a post.
	//
	// Minimum server version: 5.6
	UploadFile(data []byte, channelId string, filename string) (*model.FileInfo, error)

	// OpenInteractiveDialog will open an interactive dialog on a user's client that
	// generated the trigger ID. Used with interactive message buttons, menus
	// and slash commands.
	//
	// Minimum server version: 5.6
	OpenInteractiveDialog(dialog model.OpenDialogRequest) error

	// Plugin Section

	// GetPlugins will return a list of plugin manifests for currently active plugins.
	//
	// Minimum server version: 5.6
	GetPlugins() ([]*model.Manifest, error)

	// EnablePlugin will enable an plugin installed.
	//
	// Minimum server version: 5.6
	EnablePlugin(id string) error

	// DisablePlugin will disable an enabled plugin.
	//
	// Minimum server version: 5.6
	DisablePlugin(id string) error

	// RemovePlugin will disable and delete a plugin.
	//
	// Minimum server version: 5.6
	RemovePlugin(id string) error

	// GetPluginStatus will return the status of a plugin.
	//
	// Minimum server version: 5.6
	GetPluginStatus(id string) (*model.PluginStatus, error)

	// KV Store Section

	// KVSet stores a key-value pair, unique per plugin.
	// Provided helper functions and internal plugin code will use the prefix `mmi_` before keys. Do not use this prefix.
	//
	// Minimum server version: 5.2
	KVSet(key string, value []byte) error

	// KVCompareAndSet updates a key-value pair, unique per plugin, but only if the current value matches the given oldValue.
	// Inserts a new key if oldValue == nil.
	// Returns (false, err) if DB error occurred
	// Returns (false, nil) if current value != oldValue or key already exists when inserting
	// Returns (true, nil) if current value == oldValue or new key is inserted
	//
	// Minimum server version: 5.12
	KVCompareAndSet(key string, oldValue, newValue []byte) (bool, error)

	// KVCompareAndDelete deletes a key-value pair, unique per plugin, but only if the current value matches the given oldValue.
	// Returns (false, err) if DB error occurred
	// Returns (false, nil) if current value != oldValue or key does not exist when deleting
	// Returns (true, nil) if current value == oldValue and the key was deleted
	//
	// Minimum server version: 5.16
	KVCompareAndDelete(key string, oldValue []byte) (bool, error)

	// KVSet stores a key-value pair with an expiry time, unique per plugin.
	//
	// Minimum server version: 5.6
	KVSetWithExpiry(key string, value []byte, expireInSeconds int64) error

	// KVGet retrieves a value based on the key, unique per plugin. Returns nil for non-existent keys.
	//
	// Minimum server version: 5.2
	KVGet(key string) ([]byte, error)

	// KVDelete removes a key-value pair, unique per plugin. Returns nil for non-existent keys.
	//
	// Minimum server version: 5.2
	KVDelete(key string) error

	// KVDeleteAll removes all key-value pairs for a plugin.
	//
	// Minimum server version: 5.6
	KVDeleteAll() error

	// KVList lists all keys for a plugin.
	//
	// Minimum server version: 5.6
	KVList(page, perPage int) ([]string, error)

	// PublishWebSocketEvent sends an event to WebSocket connections.
	// event is the type and will be prepended with "custom_<pluginid>_".
	// payload is the data sent with the event. Interface values must be primitive Go types or mattermost-server/model types.
	// broadcast determines to which users to send the event.
	//
	// Minimum server version: 5.2
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
	//
	// Minimum server version: 5.2
	LogDebug(msg string, keyValuePairs ...interface{})

	// LogInfo writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	//
	// Minimum server version: 5.2
	LogInfo(msg string, keyValuePairs ...interface{})

	// LogError writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	//
	// Minimum server version: 5.2
	LogError(msg string, keyValuePairs ...interface{})

	// LogWarn writes a log message to the Mattermost server log file.
	// Appropriate context such as the plugin name will already be added as fields so plugins
	// do not need to add that info.
	// keyValuePairs should be primitive go types or other values that can be encoded by encoding/gob
	//
	// Minimum server version: 5.2
	LogWarn(msg string, keyValuePairs ...interface{})

	// SendMail sends an email to a specific address
	//
	// Minimum server version: 5.7
	SendMail(to, subject, htmlBody string) error

	// CreateBot creates the given bot and corresponding user.
	//
	// Minimum server version: 5.10
	CreateBot(bot *model.Bot) (*model.Bot, error)

	// PatchBot applies the given patch to the bot and corresponding user.
	//
	// Minimum server version: 5.10
	PatchBot(botUserId string, botPatch *model.BotPatch) (*model.Bot, error)

	// GetBot returns the given bot.
	//
	// Minimum server version: 5.10
	GetBot(botUserId string, includeDeleted bool) (*model.Bot, error)

	// GetBots returns the requested page of bots.
	//
	// Minimum server version: 5.10
	GetBots(options *model.BotGetOptions) ([]*model.Bot, error)

	// UpdateBotActive marks a bot as active or inactive, along with its corresponding user.
	//
	// Minimum server version: 5.10
	UpdateBotActive(botUserId string, active bool) (*model.Bot, error)

	// PermanentDeleteBot permanently deletes a bot and its corresponding user.
	//
	// Minimum server version: 5.10
	PermanentDeleteBot(botUserId string) error

	// GetBotIconImage gets LHS bot icon image.
	//
	// Minimum server version: 5.14
	GetBotIconImage(botUserId string) ([]byte, error)

	// SetBotIconImage sets LHS bot icon image.
	// Icon image must be SVG format, all other formats are rejected.
	//
	// Minimum server version: 5.14
	SetBotIconImage(botUserId string, data []byte) error

	// DeleteBotIconImage deletes LHS bot icon image.
	//
	// Minimum server version: 5.14
	DeleteBotIconImage(botUserId string) error
}

var handshake = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "MATTERMOST_PLUGIN",
	MagicCookieValue: "Securely message teams, anywhere.",
}
