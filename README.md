# mattermost-plugin-api

[![GoDoc](https://img.shields.io/static/v1?label=godoc&message=reference&color=blue)](https://pkg.go.dev/github.com/mattermost/mattermost-plugin-api)
[![Build Status](https://img.shields.io/circleci/project/github/mattermost/mattermost-plugin-api/master.svg)](https://circleci.com/gh/mattermost/mattermost-plugin-api)
[![Code Coverage](https://img.shields.io/codecov/c/github/mattermost/mattermost-plugin-api/master.svg)](https://codecov.io/gh/mattermost/mattermost-plugin-api/branch/master)

A hackathon project to explore reworking the Mattermost Plugin API.

The plugin API as exposed in [github.com/mattermost/mattermost-server/plugin](http://github.com/mattermost/mattermost-server/blob/master/plugin/api.go) began with the hope of adopting a consistent interface and style. But our vision for how to structure the API changed over time, along with our ability to remain consistent.

Fixing the API in place is difficult. Any backwards incompatible changes to the RPC API would break existing plugins. Even backwards incompatible changes to the plugin helpers would break semver, requiring a coordinated major version bump with parent repository. Adding new methods improves the experience for newer plugins, but forever clutters the [plugin GoDoc](https://godoc.org/github.com/mattermost/mattermost-server/plugin).

Instead, we opted to wrap the existing RPC API and helpers with a client hosted in this separate repository. Issues fixed and improvements added include:
* `*model.AppError` eliminated for all API calls, correctly returning an `error` interface instead
* methods logically organized by service instead of a flat API (e.g. `client.Users.List`)
* custom types eliminated in favour of simple splices (e.g. `[]*model.ChannelMember` instead of `model.ChannelMembers`)
* more consistent method names (e.g. `Get`, `List`, `Create`, `Update`, `Delete`)
* functional pattern for optional parameters (e.g. `List(teamId, page, perPage, ...TeamListOption)`)

The API exposed by this client officially replaces direct use of the RPC API and helpers. While we will maintain backwards compatibility with the existing RPC API, we may bump the major version of this repository in coordination with a breaking semver change. This will affect only plugin authors who opt in to the newer package, and existing plugins will continue to compile and run without changes using the older version of the package.

Usage of this package is altogether optional, allowing plugin authors to switch to this package as needed. However, note that all new helpers and abstractions over the RPC API are expected to be added only to this package.

## Getting Started

This package is in a pre-alpha state. To start using this API with your own plugin, first change all your import statements to reference the newly moduled `v6` version of the Mattermost server:
```diff
import (
-    "github.com/mattermost/mattermost-server"
+    "github.com/mattermost/mattermost-server/v6"
)
```

Finally, add this package as a dependency:
```sh
go get github.com/mattermost/mattermost-plugin-api
```

## Migration Guide

(This section is a work in progress)

A complete migration guide from the old API to the new API is as follows:

```
	LoadPluginConfiguration(dest interface{}) error
	RegisterCommand(command *model.Command) error
	UnregisterCommand(teamId, trigger string) error
	GetSession(sessionId string) (*model.Session, *model.AppError)
	GetConfig() *model.Config
	GetUnsanitizedConfig() *model.Config
	SaveConfig(config *model.Config) *model.AppError
	GetPluginConfig() map[string]interface{}
	SavePluginConfig(config map[string]interface{}) *model.AppError
	GetBundlePath() (string, error)
	GetLicense() *model.License
	GetServerVersion() string
	GetSystemInstallDate() (int64, *model.AppError)
	GetDiagnosticId() string
	CreateUser(user *model.User) (*model.User, *model.AppError)
	DeleteUser(userId string) *model.AppError
	GetUsers(options *model.UserGetOptions) ([]*model.User, *model.AppError)
	GetUser(userId string) (*model.User, *model.AppError)
	GetUserByEmail(email string) (*model.User, *model.AppError)
	GetUserByUsername(name string) (*model.User, *model.AppError)
	GetUsersByUsernames(usernames []string) ([]*model.User, *model.AppError)
	GetUsersInTeam(teamId string, page int, perPage int) ([]*model.User, *model.AppError)
	GetTeamIcon(teamId string) ([]byte, *model.AppError)
	SetTeamIcon(teamId string, data []byte) *model.AppError
	RemoveTeamIcon(teamId string) *model.AppError
	UpdateUser(user *model.User) (*model.User, *model.AppError)
	GetUserStatus(userId string) (*model.Status, *model.AppError)
	GetUserStatusesByIds(userIds []string) ([]*model.Status, *model.AppError)
	UpdateUserStatus(userId, status string) (*model.Status, *model.AppError)
	UpdateUserActive(userId string, active bool) *model.AppError
	GetUsersInChannel(channelId, sortBy string, page, perPage int) ([]*model.User, *model.AppError)
	GetLDAPUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError)
	CreateTeam(team *model.Team) (*model.Team, *model.AppError)
	DeleteTeam(teamId string) *model.AppError
	GetTeams() ([]*model.Team, *model.AppError)
	GetTeam(teamId string) (*model.Team, *model.AppError)
	GetTeamByName(name string) (*model.Team, *model.AppError)
	GetTeamsUnreadForUser(userId string) ([]*model.TeamUnread, *model.AppError)
	UpdateTeam(team *model.Team) (*model.Team, *model.AppError)
	SearchTeams(term string) ([]*model.Team, *model.AppError)
	GetTeamsForUser(userId string) ([]*model.Team, *model.AppError)
	CreateTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)
	CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, *model.AppError)
	DeleteTeamMember(teamId, userId, requestorId string) *model.AppError
	GetTeamMembers(teamId string, page, perPage int) ([]*model.TeamMember, *model.AppError)
	GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError)
	GetTeamMembersForUser(userId string, page int, perPage int) ([]*model.TeamMember, *model.AppError)
	UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, *model.AppError)
	CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError)
	DeleteChannel(channelId string) *model.AppError
	GetPublicChannelsForTeam(teamId string, page, perPage int) ([]*model.Channel, *model.AppError)
	GetChannel(channelId string) (*model.Channel, *model.AppError)
	GetChannelByName(teamId, name string, includeDeleted bool) (*model.Channel, *model.AppError)
	GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, *model.AppError)
	GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool) ([]*model.Channel, *model.AppError)
	GetChannelStats(channelId string) (*model.ChannelStats, *model.AppError)
	GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError)
	GetGroupChannel(userIds []string) (*model.Channel, *model.AppError)
	UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError)
	SearchChannels(teamId string, term string) ([]*model.Channel, *model.AppError)
	SearchUsers(search *model.UserSearch) ([]*model.User, *model.AppError)
	SearchPostsInTeam(teamId string, paramsList []*model.SearchParams) ([]*model.Post, *model.AppError)
	AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)
	AddUserToChannel(channelId, userId, asUserId string) (*model.ChannelMember, *model.AppError)
	GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError)
	GetChannelMembers(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError)
	GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError)
	GetChannelMembersForUser(teamId, userId string, page, perPage int) ([]*model.ChannelMember, *model.AppError)
	UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError)
	UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError)
	GetGroup(groupId string) (*model.Group, *model.AppError)
	GetGroupByName(name string) (*model.Group, *model.AppError)
	GetGroupsForUser(userId string) ([]*model.Group, *model.AppError)
	DeleteChannelMember(channelId, userId string) *model.AppError
	CreatePost(post *model.Post) (*model.Post, *model.AppError)
	AddReaction(reaction *model.Reaction) (*model.Reaction, *model.AppError)
	RemoveReaction(reaction *model.Reaction) *model.AppError
	GetReactions(postId string) ([]*model.Reaction, *model.AppError)
	SendEphemeralPost(userId string, post *model.Post) *model.Post
	UpdateEphemeralPost(userId string, post *model.Post) *model.Post
	DeleteEphemeralPost(userId, postId string)
	DeletePost(postId string) *model.AppError
	GetPostThread(postId string) (*model.PostList, *model.AppError)
	GetPost(postId string) (*model.Post, *model.AppError)
	GetPostsSince(channelId string, time int64) (*model.PostList, *model.AppError)
	GetPostsAfter(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError)
	GetPostsBefore(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError)
	GetPostsForChannel(channelId string, page, perPage int) (*model.PostList, *model.AppError)
	GetTeamStats(teamId string) (*model.TeamStats, *model.AppError)
	UpdatePost(post *model.Post) (*model.Post, *model.AppError)
	GetProfileImage(userId string) ([]byte, *model.AppError)
	SetProfileImage(userId string, data []byte) *model.AppError
	GetEmojiList(sortBy string, page, perPage int) ([]*model.Emoji, *model.AppError)
	GetEmojiByName(name string) (*model.Emoji, *model.AppError)
	GetEmoji(emojiId string) (*model.Emoji, *model.AppError)
	CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError)
	GetFileInfo(fileId string) (*model.FileInfo, *model.AppError)
	GetFile(fileId string) ([]byte, *model.AppError)
	GetFileLink(fileId string) (string, *model.AppError)
	ReadFile(path string) ([]byte, *model.AppError)
	GetEmojiImage(emojiId string) ([]byte, string, *model.AppError)
	UploadFile(data []byte, channelId string, filename string) (*model.FileInfo, *model.AppError)
	OpenInteractiveDialog(dialog model.OpenDialogRequest) *model.AppError
	GetPlugins() ([]*model.Manifest, *model.AppError)
	EnablePlugin(id string) *model.AppError
	DisablePlugin(id string) *model.AppError
	RemovePlugin(id string) *model.AppError
	GetPluginStatus(id string) (*model.PluginStatus, *model.AppError)
	InstallPlugin(file io.Reader, replace bool) (*model.Manifest, *model.AppError)
	KVSet(key string, value []byte) *model.AppError
	KVCompareAndSet(key string, oldValue, newValue []byte) (bool, *model.AppError)
	KVCompareAndDelete(key string, oldValue []byte) (bool, *model.AppError)
	KVSetWithOptions(key string, newValue interface{}, options model.PluginKVSetOptions) (bool, *model.AppError)
	KVSetWithExpiry(key string, value []byte, expireInSeconds int64) *model.AppError
	KVGet(key string) ([]byte, *model.AppError)
	KVDelete(key string) *model.AppError
	KVDeleteAll() *model.AppError
	KVList(page, perPage int) ([]string, *model.AppError)
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast)
	HasPermissionTo(userId string, permission *model.Permission) bool
	HasPermissionToTeam(userId, teamId string, permission *model.Permission) bool
	HasPermissionToChannel(userId, channelId string, permission *model.Permission) bool
	LogDebug(msg string, keyValuePairs ...interface{})
	LogInfo(msg string, keyValuePairs ...interface{})
	LogError(msg string, keyValuePairs ...interface{})
	LogWarn(msg string, keyValuePairs ...interface{})
	SendMail(to, subject, htmlBody string) *model.AppError
	CreateBot(bot *model.Bot) (*model.Bot, *model.AppError)
	PatchBot(botUserId string, botPatch *model.BotPatch) (*model.Bot, *model.AppError)
	GetBot(botUserId string, includeDeleted bool) (*model.Bot, *model.AppError)
	GetBots(options *model.BotGetOptions) ([]*model.Bot, *model.AppError)
	UpdateBotActive(botUserId string, active bool) (*model.Bot, *model.AppError)
	PermanentDeleteBot(botUserId string) *model.AppError
	GetBotIconImage(botUserId string) ([]byte, *model.AppError)
	SetBotIconImage(botUserId string, data []byte) *model.AppError
	DeleteBotIconImage(botUserId string) *model.AppError
	PluginHTTP(request *http.Request) *http.Response
```

