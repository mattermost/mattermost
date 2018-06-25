// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
)

type PluginAPI struct {
	id  string
	app *App
}

func NewPluginAPI(a *App, manifest *model.Manifest) *PluginAPI {
	return &PluginAPI{
		id:  manifest.Id,
		app: a,
	}
}

func (api *PluginAPI) LoadPluginConfiguration(dest interface{}) error {
	if b, err := json.Marshal(api.app.Config().PluginSettings.Plugins[api.id]); err != nil {
		return err
	} else {
		return json.Unmarshal(b, dest)
	}
}

func (api *PluginAPI) RegisterCommand(command *model.Command) error {
	return api.app.RegisterPluginCommand(api.id, command)
}

func (api *PluginAPI) UnregisterCommand(teamId, trigger string) error {
	api.app.UnregisterPluginCommand(api.id, teamId, trigger)
	return nil
}

func (api *PluginAPI) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	return api.app.CreateTeam(team)
}

func (api *PluginAPI) DeleteTeam(teamId string) *model.AppError {
	return api.app.SoftDeleteTeam(teamId)
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

func (api *PluginAPI) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannel(channelId)
}

func (api *PluginAPI) GetChannelByName(name, teamId string) (*model.Channel, *model.AppError) {
	return api.app.GetChannelByName(name, teamId)
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

	return api.app.AddChannelMember(userId, channel, userRequestorId, postRootId)
}

func (api *PluginAPI) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	return api.app.GetChannelMember(channelId, userId)
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

func (api *PluginAPI) KVSet(key string, value []byte) *model.AppError {
	return api.app.SetPluginKey(api.id, key, value)
}

func (api *PluginAPI) KVGet(key string) ([]byte, *model.AppError) {
	return api.app.GetPluginKey(api.id, key)
}

func (api *PluginAPI) KVDelete(key string) *model.AppError {
	return api.app.DeletePluginKey(api.id, key)
}
