// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type PluginAPI struct {
	id       string
	app      *App
	logger   *mlog.SugarLogger
	manifest *model.Manifest
}

func NewPluginAPI(a *App, manifest *model.Manifest) *PluginAPI {
	return &PluginAPI{
		id:       manifest.Id,
		manifest: manifest,
		app:      a,
		logger:   a.Log.With(mlog.String("plugin_id", manifest.Id)).Sugar(),
	}
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	finalConfig := make(map[string]interface{})

	// First set final config to defaults
	if api.manifest.SettingsSchema != nil {
		for _, setting := range api.manifest.SettingsSchema.Settings {
			finalConfig[strings.ToLower(setting.Key)] = setting.Default
		}
	}

	// If we have settings given we override the defaults with them
	for setting, value := range api.app.Config().PluginSettings.Plugins[api.id] {
		finalConfig[strings.ToLower(setting)] = value
	}

	if pluginSettingsJsonBytes, err := json.Marshal(finalConfig); err != nil {
		api.logger.Error("Error marshaling config for plugin", mlog.Err(err))
		return nil
	} else {
		err := json.Unmarshal(pluginSettingsJsonBytes, dest)
		if err != nil {
			api.logger.Error("Error unmarshaling config for plugin", mlog.Err(err))
		}
		return nil
	}
}

func (api *PluginAPI) RegisterCommand(command *model.Command) error {
	return api.app.RegisterPluginCommand(api.id, command)
}

func (api *PluginAPI) UnregisterCommand(teamId, trigger string) error {
	api.app.UnregisterPluginCommand(api.id, teamId, trigger)
	return nil
}

func (api *PluginAPI) GetSession(sessionId string) (*model.Session, *model.AppError) {
	session, err := api.app.GetSessionById(sessionId)

	if err != nil {
		return nil, err
	}

	return session, nil
}

func (api *PluginAPI) GetConfig() *model.Config {
	return api.app.GetConfig()
}

func (api *PluginAPI) SaveConfig(config *model.Config) *model.AppError {
	return api.app.SaveConfig(config, true)
}

func (api *PluginAPI) GetServerVersion() string {
	return model.CurrentVersion
}

func (api *PluginAPI) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.CreateTeam(team)
}

func (api *PluginAPI) DeleteTeam(teamId string) *model.AppError {
	return api.app.SoftDeleteTeam(teamId)
}

func (api *PluginAPI) GetTeams() ([]*model.Team, *model.AppError) {
	return api.app.GetAllTeams()
}

func (api *PluginAPI) GetTeam(teamId string) (*model.Team, *model.AppError) {
	return api.app.GetTeam(teamId)
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *PluginAPI) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.UpdateTeam(team)
}

func (api *PluginAPI) CreateTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	return api.app.AddTeamMember(teamId, userId)
}

func (api *PluginAPI) CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, *model.AppError) {
	return api.app.AddTeamMembers(teamId, userIds, requestorId)
}

func (api *PluginAPI) DeleteTeamMember(teamId, userId, requestorId string) *model.AppError {
	return api.app.RemoveUserFromTeam(teamId, userId, requestorId)
}

func (api *PluginAPI) GetTeamMembers(teamId string, offset, limit int) ([]*model.TeamMember, *model.AppError) {
	return api.app.GetTeamMembers(teamId, offset, limit)
}

func (api *PluginAPI) GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	return api.app.GetTeamMember(teamId, userId)
}

func (api *PluginAPI) UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, *model.AppError) {
	return api.app.UpdateTeamMemberRoles(teamId, userId, newRoles)
}

func (api *PluginAPI) CreateUser(user *model.User) (*model.User, *model.AppError) {
	return api.app.CreateUser(user)
}

func (api *PluginAPI) DeleteUser(userId string) *model.AppError {
	user, err := api.app.GetUser(userId)
	if err != nil {
		return err
	}
	_, err = api.app.UpdateActive(user, false)
	return err
}

func (api *PluginAPI) GetUser(userId string) (*model.User, *model.AppError) {
	return api.app.GetUser(userId)
}

func (api *PluginAPI) GetUserByEmail(email string) (*model.User, *model.AppError) {
	return api.app.GetUserByEmail(email)
}

func (api *PluginAPI) GetUserByUsername(name string) (*model.User, *model.AppError) {
	return api.app.GetUserByUsername(name)
}

func (api *PluginAPI) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	return api.app.UpdateUser(user, true)
}

func (api *PluginAPI) GetUserStatus(userId string) (*model.Status, *model.AppError) {
	return api.app.GetStatus(userId)
}

func (api *PluginAPI) GetUserStatusesByIds(userIds []string) ([]*model.Status, *model.AppError) {
	return api.app.GetUserStatusesByIds(userIds)
}

func (api *PluginAPI) UpdateUserStatus(userId, status string) (*model.Status, *model.AppError) {
	switch status {
	case model.STATUS_ONLINE:
		api.app.SetStatusOnline(userId, true)
	case model.STATUS_OFFLINE:
		api.app.SetStatusOffline(userId, true)
	case model.STATUS_AWAY:
		api.app.SetStatusAwayIfNeeded(userId, true)
	case model.STATUS_DND:
		api.app.SetStatusDoNotDisturb(userId)
	default:
		return nil, model.NewAppError("UpdateUserStatus", "plugin.api.update_user_status.bad_status", nil, "unrecognized status", http.StatusBadRequest)
	}

	return api.app.GetStatus(userId)
}
func (api *PluginAPI) GetLDAPUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError) {
	if api.app.Ldap == nil {
		return nil, model.NewAppError("GetLdapUserAttributes", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err := api.app.GetUser(userId)
	if err != nil {
		return nil, err
	}

	if user.AuthService != model.USER_AUTH_SERVICE_LDAP || user.AuthData == nil {
		return map[string]string{}, nil
	}

	return api.app.Ldap.GetUserAttributes(*user.AuthData, attributes)
}

func (api *PluginAPI) CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return api.app.CreateChannel(channel, false)
}

func (api *PluginAPI) DeleteChannel(channelId string) *model.AppError {
	channel, err := api.app.GetChannel(channelId)
	if err != nil {
		return err
	}
	return api.app.DeleteChannel(channel, "")
}

func (api *PluginAPI) GetPublicChannelsForTeam(teamId string, offset, limit int) (*model.ChannelList, *model.AppError) {
	return api.app.GetPublicChannelsForTeam(teamId, offset, limit)
}

func (api *PluginAPI) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannel(channelId)
}

func (api *PluginAPI) GetChannelByName(teamId, name string, includeDeleted bool) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId, includeDeleted)
}

func (api *PluginAPI) GetChannelByNameForTeamName(teamName, channelName string, includeDeleted bool) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByNameForTeamName(channelName, teamName, includeDeleted)
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return api.app.GetDirectChannel(userId1, userId2)
}

func (api *PluginAPI) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	return api.app.CreateGroupChannel(userIds, "")
}

func (api *PluginAPI) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return api.app.UpdateChannel(channel)
}

func (api *PluginAPI) AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	// For now, don't allow overriding these via the plugin API.
	userRequestorId := ""
	postRootId := ""

	channel, err := api.GetChannel(channelId)
	if err != nil {
		return nil, err
	}

	return api.app.AddChannelMember(userId, channel, userRequestorId, postRootId, false)
}

func (api *PluginAPI) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	return api.app.GetChannelMember(channelId, userId)
}

func (api *PluginAPI) GetChannelMembers(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	return api.app.GetChannelMembersPage(channelId, page, perPage)
}

func (api *PluginAPI) UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError) {
	return api.app.UpdateChannelMemberRoles(channelId, userId, newRoles)
}

func (api *PluginAPI) UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError) {
	return api.app.UpdateChannelMemberNotifyProps(notifications, channelId, userId)
}

func (api *PluginAPI) DeleteChannelMember(channelId, userId string) *model.AppError {
	return api.app.LeaveChannel(channelId, userId)
}

func (api *PluginAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.CreatePostMissingChannel(post, true)
}

func (api *PluginAPI) AddReaction(reaction *model.Reaction) (*model.Reaction, *model.AppError) {
	return api.app.SaveReactionForPost(reaction)
}

func (api *PluginAPI) RemoveReaction(reaction *model.Reaction) *model.AppError {
	return api.app.DeleteReactionForPost(reaction)
}

func (api *PluginAPI) GetReactions(postId string) ([]*model.Reaction, *model.AppError) {
	return api.app.GetReactionsForPost(postId)
}

func (api *PluginAPI) SendEphemeralPost(userId string, post *model.Post) *model.Post {
	return api.app.SendEphemeralPost(userId, post)
}

func (api *PluginAPI) DeletePost(postId string) *model.AppError {
	_, err := api.app.DeletePost(postId, api.id)
	return err
}

func (api *PluginAPI) GetPost(postId string) (*model.Post, *model.AppError) {
	return api.app.GetSinglePost(postId)
}

func (api *PluginAPI) UpdatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.UpdatePost(post, false)
}

func (api *PluginAPI) CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError) {
	return api.app.CopyFileInfos(userId, fileIds)
}

func (api *PluginAPI) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	return api.app.GetFileInfo(fileId)
}

func (api *PluginAPI) ReadFile(path string) ([]byte, *model.AppError) {
	return api.app.ReadFile(path)
}

func (api *PluginAPI) KVSet(key string, value []byte) *model.AppError {
	return api.app.SetPluginKey(api.id, key, value)
}

func (api *PluginAPI) KVGet(key string) ([]byte, *model.AppError) {
	return api.app.GetPluginKey(api.id, key)
}

func (api *PluginAPI) KVDelete(key string) *model.AppError {
	return api.app.DeletePluginKey(api.id, key)
}

func (api *PluginAPI) KVList(page, perPage int) ([]string, *model.AppError) {
	return api.app.ListPluginKeys(api.id, page, perPage)
}

func (api *PluginAPI) PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast) {
	api.app.Publish(&model.WebSocketEvent{
		Event:     fmt.Sprintf("custom_%v_%v", api.id, event),
		Data:      payload,
		Broadcast: broadcast,
	})
}

func (api *PluginAPI) HasPermissionTo(userId string, permission *model.Permission) bool {
	return api.app.HasPermissionTo(userId, permission)
}

func (api *PluginAPI) HasPermissionToTeam(userId, teamId string, permission *model.Permission) bool {
	return api.app.HasPermissionToTeam(userId, teamId, permission)
}

func (api *PluginAPI) HasPermissionToChannel(userId, channelId string, permission *model.Permission) bool {
	return api.app.HasPermissionToChannel(userId, channelId, permission)
}

func (api *PluginAPI) LogDebug(msg string, keyValuePairs ...interface{}) {
	api.logger.Debug(msg, keyValuePairs...)
}
func (api *PluginAPI) LogInfo(msg string, keyValuePairs ...interface{}) {
	api.logger.Info(msg, keyValuePairs...)
}
func (api *PluginAPI) LogError(msg string, keyValuePairs ...interface{}) {
	api.logger.Error(msg, keyValuePairs...)
}
func (api *PluginAPI) LogWarn(msg string, keyValuePairs ...interface{}) {
	api.logger.Warn(msg, keyValuePairs...)
}
