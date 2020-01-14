// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
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
	return api.app.GetSanitizedConfig()
}

// GetUnsanitizedConfig gets the configuration for a system admin without removing secrets.
func (api *PluginAPI) GetUnsanitizedConfig() *model.Config {
	return api.app.Config().Clone()
}

func (api *PluginAPI) SaveConfig(config *model.Config) *model.AppError {
	return api.app.SaveConfig(config, true)
}

func (api *PluginAPI) GetPluginConfig() map[string]interface{} {
	cfg := api.app.GetSanitizedConfig()
	if pluginConfig, isOk := cfg.PluginSettings.Plugins[api.manifest.Id]; isOk {
		return pluginConfig
	}
	return map[string]interface{}{}
}

func (api *PluginAPI) SavePluginConfig(pluginConfig map[string]interface{}) *model.AppError {
	cfg := api.app.GetSanitizedConfig()
	cfg.PluginSettings.Plugins[api.manifest.Id] = pluginConfig
	return api.app.SaveConfig(cfg, true)
}

func (api *PluginAPI) GetBundlePath() (string, error) {
	bundlePath, err := filepath.Abs(filepath.Join(*api.GetConfig().PluginSettings.Directory, api.manifest.Id))
	if err != nil {
		return "", err
	}

	return bundlePath, err
}

func (api *PluginAPI) GetLicense() *model.License {
	return api.app.License()
}

func (api *PluginAPI) GetServerVersion() string {
	return model.CurrentVersion
}

func (api *PluginAPI) GetSystemInstallDate() (int64, *model.AppError) {
	return api.app.getSystemInstallDate()
}

func (api *PluginAPI) GetDiagnosticId() string {
	return api.app.DiagnosticId()
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

func (api *PluginAPI) SearchTeams(term string) ([]*model.Team, *model.AppError) {
	teams, _, err := api.app.SearchAllTeams(&model.TeamSearch{Term: term})
	return teams, err
}

func (api *PluginAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	return api.app.GetTeamByName(name)
}

func (api *PluginAPI) GetTeamsUnreadForUser(userId string) ([]*model.TeamUnread, *model.AppError) {
	return api.app.GetTeamsUnreadForUser("", userId)
}

func (api *PluginAPI) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.UpdateTeam(team)
}

func (api *PluginAPI) GetTeamsForUser(userId string) ([]*model.Team, *model.AppError) {
	return api.app.GetTeamsForUser(userId)
}

func (api *PluginAPI) CreateTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	return api.app.AddTeamMember(teamId, userId)
}

func (api *PluginAPI) CreateTeamMembers(teamId string, userIds []string, requestorId string) ([]*model.TeamMember, *model.AppError) {
	members, err := api.app.AddTeamMembers(teamId, userIds, requestorId, false)
	if err != nil {
		return nil, err
	}
	return model.TeamMembersWithErrorToTeamMembers(members), nil
}

func (api *PluginAPI) CreateTeamMembersGracefully(teamId string, userIds []string, requestorId string) ([]*model.TeamMemberWithError, *model.AppError) {
	return api.app.AddTeamMembers(teamId, userIds, requestorId, true)
}

func (api *PluginAPI) DeleteTeamMember(teamId, userId, requestorId string) *model.AppError {
	return api.app.RemoveUserFromTeam(teamId, userId, requestorId)
}

func (api *PluginAPI) GetTeamMembers(teamId string, page, perPage int) ([]*model.TeamMember, *model.AppError) {
	return api.app.GetTeamMembers(teamId, page*perPage, perPage, nil)
}

func (api *PluginAPI) GetTeamMember(teamId, userId string) (*model.TeamMember, *model.AppError) {
	return api.app.GetTeamMember(teamId, userId)
}

func (api *PluginAPI) GetTeamMembersForUser(userId string, page int, perPage int) ([]*model.TeamMember, *model.AppError) {
	return api.app.GetTeamMembersForUserWithPagination(userId, page, perPage)
}

func (api *PluginAPI) UpdateTeamMemberRoles(teamId, userId, newRoles string) (*model.TeamMember, *model.AppError) {
	return api.app.UpdateTeamMemberRoles(teamId, userId, newRoles)
}

func (api *PluginAPI) GetTeamStats(teamId string) (*model.TeamStats, *model.AppError) {
	return api.app.GetTeamStats(teamId, nil)
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

func (api *PluginAPI) GetUsers(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	return api.app.GetUsers(options)
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

func (api *PluginAPI) GetUsersByUsernames(usernames []string) ([]*model.User, *model.AppError) {
	return api.app.GetUsersByUsernames(usernames, true, nil)
}

func (api *PluginAPI) GetUsersInTeam(teamId string, page int, perPage int) ([]*model.User, *model.AppError) {
	options := &model.UserGetOptions{InTeamId: teamId, Page: page, PerPage: perPage}
	return api.app.GetUsersInTeam(options)
}

func (api *PluginAPI) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	return api.app.UpdateUser(user, true)
}

func (api *PluginAPI) UpdateUserActive(userId string, active bool) *model.AppError {
	return api.app.UpdateUserActive(userId, active)
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

func (api *PluginAPI) GetUsersInChannel(channelId, sortBy string, page, perPage int) ([]*model.User, *model.AppError) {
	switch sortBy {
	case model.CHANNEL_SORT_BY_USERNAME:
		return api.app.GetUsersInChannel(channelId, page*perPage, perPage)
	case model.CHANNEL_SORT_BY_STATUS:
		return api.app.GetUsersInChannelByStatus(channelId, page*perPage, perPage)
	default:
		return nil, model.NewAppError("GetUsersInChannel", "plugin.api.get_users_in_channel", nil, "invalid sort option", http.StatusBadRequest)
	}
}

func (api *PluginAPI) GetLDAPUserAttributes(userId string, attributes []string) (map[string]string, *model.AppError) {
	if api.app.Ldap == nil {
		return nil, model.NewAppError("GetLdapUserAttributes", "ent.ldap.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	user, err := api.app.GetUser(userId)
	if err != nil {
		return nil, err
	}

	if user.AuthData == nil {
		return map[string]string{}, nil
	}

	// Only bother running the query if the user's auth service is LDAP or it's SAML and sync is enabled.
	if user.AuthService == model.USER_AUTH_SERVICE_LDAP ||
		(user.AuthService == model.USER_AUTH_SERVICE_SAML && *api.app.Config().SamlSettings.EnableSyncWithLdap) {
		return api.app.Ldap.GetUserAttributes(*user.AuthData, attributes)
	}

	return map[string]string{}, nil
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

func (api *PluginAPI) GetPublicChannelsForTeam(teamId string, page, perPage int) ([]*model.Channel, *model.AppError) {
	channels, err := api.app.GetPublicChannelsForTeam(teamId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}
	return *channels, err
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

func (api *PluginAPI) GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool) ([]*model.Channel, *model.AppError) {
	channels, err := api.app.GetChannelsForUser(teamId, userId, includeDeleted)
	if err != nil {
		return nil, err
	}
	return *channels, err
}

func (api *PluginAPI) GetChannelStats(channelId string) (*model.ChannelStats, *model.AppError) {
	memberCount, err := api.app.GetChannelMemberCount(channelId)
	if err != nil {
		return nil, err
	}
	guestCount, err := api.app.GetChannelMemberCount(channelId)
	if err != nil {
		return nil, err
	}
	return &model.ChannelStats{ChannelId: channelId, MemberCount: memberCount, GuestCount: guestCount}, nil
}

func (api *PluginAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	return api.app.GetOrCreateDirectChannel(userId1, userId2)
}

func (api *PluginAPI) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	return api.app.CreateGroupChannel(userIds, "")
}

func (api *PluginAPI) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	return api.app.UpdateChannel(channel)
}

func (api *PluginAPI) SearchChannels(teamId string, term string) ([]*model.Channel, *model.AppError) {
	channels, err := api.app.SearchChannels(teamId, term)
	if err != nil {
		return nil, err
	}
	return *channels, err
}

func (api *PluginAPI) SearchUsers(search *model.UserSearch) ([]*model.User, *model.AppError) {
	pluginSearchUsersOptions := &model.UserSearchOptions{
		IsAdmin:       true,
		AllowInactive: search.AllowInactive,
		Limit:         search.Limit,
	}
	return api.app.SearchUsers(search, pluginSearchUsersOptions)
}

func (api *PluginAPI) SearchPostsInTeam(teamId string, paramsList []*model.SearchParams) ([]*model.Post, *model.AppError) {
	postList, err := api.app.SearchPostsInTeam(teamId, paramsList)
	if err != nil {
		return nil, err
	}
	return postList.ToSlice(), nil
}

func (api *PluginAPI) AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	// For now, don't allow overriding these via the plugin API.
	userRequestorId := ""
	postRootId := ""

	channel, err := api.GetChannel(channelId)
	if err != nil {
		return nil, err
	}

	return api.app.AddChannelMember(userId, channel, userRequestorId, postRootId)
}

func (api *PluginAPI) AddUserToChannel(channelId, userId, asUserId string) (*model.ChannelMember, *model.AppError) {
	postRootId := ""

	channel, err := api.GetChannel(channelId)
	if err != nil {
		return nil, err
	}

	return api.app.AddChannelMember(userId, channel, asUserId, postRootId)
}

func (api *PluginAPI) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	return api.app.GetChannelMember(channelId, userId)
}

func (api *PluginAPI) GetChannelMembers(channelId string, page, perPage int) (*model.ChannelMembers, *model.AppError) {
	return api.app.GetChannelMembersPage(channelId, page, perPage)
}

func (api *PluginAPI) GetChannelMembersByIds(channelId string, userIds []string) (*model.ChannelMembers, *model.AppError) {
	return api.app.GetChannelMembersByIds(channelId, userIds)
}

func (api *PluginAPI) GetChannelMembersForUser(teamId, userId string, page, perPage int) ([]*model.ChannelMember, *model.AppError) {
	return api.app.GetChannelMembersForUserWithPagination(teamId, userId, page, perPage)
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

func (api *PluginAPI) GetGroup(groupId string) (*model.Group, *model.AppError) {
	return api.app.GetGroup(groupId)
}

func (api *PluginAPI) GetGroupByName(name string) (*model.Group, *model.AppError) {
	return api.app.GetGroupByName(name)
}

func (api *PluginAPI) GetGroupsForUser(userId string) ([]*model.Group, *model.AppError) {
	return api.app.GetGroupsByUserId(userId)
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

func (api *PluginAPI) UpdateEphemeralPost(userId string, post *model.Post) *model.Post {
	return api.app.UpdateEphemeralPost(userId, post)
}

func (api *PluginAPI) DeleteEphemeralPost(userId, postId string) {
	api.app.DeleteEphemeralPost(userId, postId)
}

func (api *PluginAPI) DeletePost(postId string) *model.AppError {
	_, err := api.app.DeletePost(postId, api.id)
	return err
}

func (api *PluginAPI) GetPostThread(postId string) (*model.PostList, *model.AppError) {
	return api.app.GetPostThread(postId, false)
}

func (api *PluginAPI) GetPost(postId string) (*model.Post, *model.AppError) {
	return api.app.GetSinglePost(postId)
}

func (api *PluginAPI) GetPostsSince(channelId string, time int64) (*model.PostList, *model.AppError) {
	return api.app.GetPostsSince(model.GetPostsSinceOptions{ChannelId: channelId, Time: time})
}

func (api *PluginAPI) GetPostsAfter(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError) {
	return api.app.GetPostsAfterPost(model.GetPostsOptions{ChannelId: channelId, PostId: postId, Page: page, PerPage: perPage})
}

func (api *PluginAPI) GetPostsBefore(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError) {
	return api.app.GetPostsBeforePost(model.GetPostsOptions{ChannelId: channelId, PostId: postId, Page: page, PerPage: perPage})
}

func (api *PluginAPI) GetPostsForChannel(channelId string, page, perPage int) (*model.PostList, *model.AppError) {
	return api.app.GetPostsPage(model.GetPostsOptions{ChannelId: channelId, Page: perPage, PerPage: page})
}

func (api *PluginAPI) UpdatePost(post *model.Post) (*model.Post, *model.AppError) {
	return api.app.UpdatePost(post, false)
}

func (api *PluginAPI) GetProfileImage(userId string) ([]byte, *model.AppError) {
	user, err := api.app.GetUser(userId)
	if err != nil {
		return nil, err
	}

	data, _, err := api.app.GetProfileImage(user)
	return data, err
}

func (api *PluginAPI) SetProfileImage(userId string, data []byte) *model.AppError {
	_, err := api.app.GetUser(userId)
	if err != nil {
		return err
	}

	return api.app.SetProfileImageFromFile(userId, bytes.NewReader(data))
}

func (api *PluginAPI) GetEmojiList(sortBy string, page, perPage int) ([]*model.Emoji, *model.AppError) {
	return api.app.GetEmojiList(page, perPage, sortBy)
}

func (api *PluginAPI) GetEmojiByName(name string) (*model.Emoji, *model.AppError) {
	return api.app.GetEmojiByName(name)
}

func (api *PluginAPI) GetEmoji(emojiId string) (*model.Emoji, *model.AppError) {
	return api.app.GetEmoji(emojiId)
}

func (api *PluginAPI) CopyFileInfos(userId string, fileIds []string) ([]string, *model.AppError) {
	return api.app.CopyFileInfos(userId, fileIds)
}

func (api *PluginAPI) GetFileInfo(fileId string) (*model.FileInfo, *model.AppError) {
	return api.app.GetFileInfo(fileId)
}

func (api *PluginAPI) GetFileLink(fileId string) (string, *model.AppError) {
	if !*api.app.Config().FileSettings.EnablePublicLink {
		return "", model.NewAppError("GetFileLink", "plugin_api.get_file_link.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	info, err := api.app.GetFileInfo(fileId)
	if err != nil {
		return "", err
	}

	if len(info.PostId) == 0 {
		return "", model.NewAppError("GetFileLink", "plugin_api.get_file_link.no_post.app_error", nil, "file_id="+info.Id, http.StatusBadRequest)
	}

	return api.app.GeneratePublicLink(api.app.GetSiteURL(), info), nil
}

func (api *PluginAPI) ReadFile(path string) ([]byte, *model.AppError) {
	return api.app.ReadFile(path)
}

func (api *PluginAPI) GetFile(fileId string) ([]byte, *model.AppError) {
	return api.app.GetFile(fileId)
}

func (api *PluginAPI) UploadFile(data []byte, channelId string, filename string) (*model.FileInfo, *model.AppError) {
	return api.app.UploadFile(data, channelId, filename)
}

func (api *PluginAPI) GetEmojiImage(emojiId string) ([]byte, string, *model.AppError) {
	return api.app.GetEmojiImage(emojiId)
}

func (api *PluginAPI) GetTeamIcon(teamId string) ([]byte, *model.AppError) {
	team, err := api.app.GetTeam(teamId)
	if err != nil {
		return nil, err
	}

	data, err := api.app.GetTeamIcon(team)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (api *PluginAPI) SetTeamIcon(teamId string, data []byte) *model.AppError {
	team, err := api.app.GetTeam(teamId)
	if err != nil {
		return err
	}

	return api.app.SetTeamIconFromFile(team, bytes.NewReader(data))
}

func (api *PluginAPI) OpenInteractiveDialog(dialog model.OpenDialogRequest) *model.AppError {
	return api.app.OpenInteractiveDialog(dialog)
}

func (api *PluginAPI) RemoveTeamIcon(teamId string) *model.AppError {
	_, err := api.app.GetTeam(teamId)
	if err != nil {
		return err
	}

	err = api.app.RemoveTeamIcon(teamId)
	if err != nil {
		return err
	}
	return nil
}

// Mail Section

func (api *PluginAPI) SendMail(to, subject, htmlBody string) *model.AppError {
	if to == "" {
		return model.NewAppError("SendMail", "plugin_api.send_mail.missing_to", nil, "", http.StatusBadRequest)
	}

	if subject == "" {
		return model.NewAppError("SendMail", "plugin_api.send_mail.missing_subject", nil, "", http.StatusBadRequest)
	}

	if htmlBody == "" {
		return model.NewAppError("SendMail", "plugin_api.send_mail.missing_htmlbody", nil, "", http.StatusBadRequest)
	}

	return api.app.SendNotificationMail(to, subject, htmlBody)
}

// Plugin Section

func (api *PluginAPI) GetPlugins() ([]*model.Manifest, *model.AppError) {
	plugins, err := api.app.GetPlugins()
	if err != nil {
		return nil, err
	}
	var manifests []*model.Manifest
	for _, manifest := range plugins.Active {
		manifests = append(manifests, &manifest.Manifest)
	}
	for _, manifest := range plugins.Inactive {
		manifests = append(manifests, &manifest.Manifest)
	}
	return manifests, nil
}

func (api *PluginAPI) EnablePlugin(id string) *model.AppError {
	return api.app.EnablePlugin(id)
}

func (api *PluginAPI) DisablePlugin(id string) *model.AppError {
	return api.app.DisablePlugin(id)
}

func (api *PluginAPI) RemovePlugin(id string) *model.AppError {
	return api.app.RemovePlugin(id)
}

func (api *PluginAPI) GetPluginStatus(id string) (*model.PluginStatus, *model.AppError) {
	return api.app.GetPluginStatus(id)
}

func (api *PluginAPI) InstallPlugin(file io.Reader, replace bool) (*model.Manifest, *model.AppError) {
	if !*api.app.Config().PluginSettings.Enable || !*api.app.Config().PluginSettings.EnableUploads {
		return nil, model.NewAppError("installPlugin", "app.plugin.upload_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	fileBuffer, err := ioutil.ReadAll(file)
	if err != nil {
		return nil, model.NewAppError("InstallPlugin", "api.plugin.upload.file.app_error", nil, "", http.StatusBadRequest)
	}

	return api.app.InstallPlugin(bytes.NewReader(fileBuffer), replace)
}

// KV Store Section

func (api *PluginAPI) KVSetWithOptions(key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	return api.app.SetPluginKeyWithOptions(api.id, key, value, options)
}

func (api *PluginAPI) KVSet(key string, value []byte) *model.AppError {
	return api.app.SetPluginKey(api.id, key, value)
}

func (api *PluginAPI) KVCompareAndSet(key string, oldValue, newValue []byte) (bool, *model.AppError) {
	return api.app.CompareAndSetPluginKey(api.id, key, oldValue, newValue)
}

func (api *PluginAPI) KVCompareAndDelete(key string, oldValue []byte) (bool, *model.AppError) {
	return api.app.CompareAndDeletePluginKey(api.id, key, oldValue)
}

func (api *PluginAPI) KVSetWithExpiry(key string, value []byte, expireInSeconds int64) *model.AppError {
	return api.app.SetPluginKeyWithExpiry(api.id, key, value, expireInSeconds)
}

func (api *PluginAPI) KVGet(key string) ([]byte, *model.AppError) {
	return api.app.GetPluginKey(api.id, key)
}

func (api *PluginAPI) KVDelete(key string) *model.AppError {
	return api.app.DeletePluginKey(api.id, key)
}

func (api *PluginAPI) KVDeleteAll() *model.AppError {
	return api.app.DeleteAllKeysForPlugin(api.id)
}

func (api *PluginAPI) KVList(page, perPage int) ([]string, *model.AppError) {
	return api.app.ListPluginKeys(api.id, page, perPage)
}

func (api *PluginAPI) PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *model.WebsocketBroadcast) {
	ev := model.NewWebSocketEvent(fmt.Sprintf("custom_%v_%v", api.id, event), "", "", "", nil)
	ev = ev.SetBroadcast(broadcast).SetData(payload)
	api.app.Publish(ev)
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

func (api *PluginAPI) CreateBot(bot *model.Bot) (*model.Bot, *model.AppError) {
	// Bots created by a plugin should use the plugin's ID for the creator field, unless
	// otherwise specified by the plugin.
	if bot.OwnerId == "" {
		bot.OwnerId = api.id
	}
	// Bots cannot be owners of other bots
	if user, err := api.app.GetUser(bot.OwnerId); err == nil {
		if user.IsBot {
			return nil, model.NewAppError("CreateBot", "plugin_api.bot_cant_create_bot", nil, "", http.StatusBadRequest)
		}
	}

	return api.app.CreateBot(bot)
}

func (api *PluginAPI) PatchBot(userId string, botPatch *model.BotPatch) (*model.Bot, *model.AppError) {
	return api.app.PatchBot(userId, botPatch)
}

func (api *PluginAPI) GetBot(userId string, includeDeleted bool) (*model.Bot, *model.AppError) {
	return api.app.GetBot(userId, includeDeleted)
}

func (api *PluginAPI) GetBots(options *model.BotGetOptions) ([]*model.Bot, *model.AppError) {
	bots, err := api.app.GetBots(options)

	return []*model.Bot(bots), err
}

func (api *PluginAPI) UpdateBotActive(userId string, active bool) (*model.Bot, *model.AppError) {
	return api.app.UpdateBotActive(userId, active)
}

func (api *PluginAPI) PermanentDeleteBot(userId string) *model.AppError {
	return api.app.PermanentDeleteBot(userId)
}

func (api *PluginAPI) GetBotIconImage(userId string) ([]byte, *model.AppError) {
	if _, err := api.app.GetBot(userId, true); err != nil {
		return nil, err
	}

	return api.app.GetBotIconImage(userId)
}

func (api *PluginAPI) SetBotIconImage(userId string, data []byte) *model.AppError {
	if _, err := api.app.GetBot(userId, true); err != nil {
		return err
	}

	return api.app.SetBotIconImage(userId, bytes.NewReader(data))
}

func (api *PluginAPI) DeleteBotIconImage(userId string) *model.AppError {
	if _, err := api.app.GetBot(userId, true); err != nil {
		return err
	}

	return api.app.DeleteBotIconImage(userId)
}

func (api *PluginAPI) PluginHTTP(request *http.Request) *http.Response {
	split := strings.SplitN(request.URL.Path, "/", 3)
	if len(split) != 3 {
		return &http.Response{
			StatusCode: http.StatusBadRequest,
			Body:       ioutil.NopCloser(bytes.NewBufferString("Not enough URL. Form of URL should be /<pluginid>/*")),
		}
	}
	destinationPluginId := split[1]
	newURL, err := url.Parse("/" + split[2])
	request.URL = newURL
	if destinationPluginId == "" || err != nil {
		message := "No plugin specified. Form of URL should be /<pluginid>/*"
		if err != nil {
			message = "Form of URL should be /<pluginid>/* Error: " + err.Error()
		}
		return &http.Response{
			StatusCode: http.StatusBadRequest,
			Body:       ioutil.NopCloser(bytes.NewBufferString(message)),
		}
	}
	responseTransfer := &PluginResponseWriter{}
	api.app.ServeInterPluginRequest(responseTransfer, request, api.id, destinationPluginId)
	return responseTransfer.GenerateResponse()
}
