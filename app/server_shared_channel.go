// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/filestore"
)

type SharedChannelApp struct {
	app *App
	ctx *Context
}

func (a *SharedChannelApp) SendEphemeralPost(userId string, post *model.Post) *model.Post {
	return a.app.SendEphemeralPost(userId, post)
}

func (a *SharedChannelApp) CreateChannelWithUser(channel *model.Channel, userId string) (*model.Channel, *model.AppError) {
	return a.app.CreateChannelWithUser(a.ctx, channel, userId)
}

func (a *SharedChannelApp) GetOrCreateDirectChannel(userId, otherUserId string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError) {
	return a.app.GetOrCreateDirectChannel(a.ctx, userId, otherUserId)
}

func (a *SharedChannelApp) AddUserToChannel(user *model.User, channel *model.Channel, skipTeamMemberIntegrityCheck bool) (*model.ChannelMember, *model.AppError) {
	return a.app.AddUserToChannel(user, channel, skipTeamMemberIntegrityCheck)
}

func (a *SharedChannelApp) AddUserToTeamByTeamId(teamId string, user *model.User) *model.AppError {
	return a.app.AddUserToTeamByTeamId(a.ctx, teamId, user)
}

func (a *SharedChannelApp) PermanentDeleteChannel(channel *model.Channel) *model.AppError {
	return a.app.PermanentDeleteChannel(channel)
}

func (a *SharedChannelApp) CreatePost(post *model.Post, channel *model.Channel, triggerWebhooks bool, setOnline bool) (savedPost *model.Post, err *model.AppError) {
	return a.app.CreatePost(a.ctx, post, channel, triggerWebhooks, setOnline)
}

func (a *SharedChannelApp) UpdatePost(post *model.Post, safeUpdate bool) (*model.Post, *model.AppError) {
	return a.app.UpdatePost(a.ctx, post, safeUpdate)
}

func (a *SharedChannelApp) DeletePost(postID, deleteByID string) (*model.Post, *model.AppError) {
	return a.app.DeletePost(postID, deleteByID)
}

func (a *SharedChannelApp) SaveReactionForPost(reaction *model.Reaction) (*model.Reaction, *model.AppError) {
	return a.app.SaveReactionForPost(a.ctx, reaction)
}

func (a *SharedChannelApp) DeleteReactionForPost(reaction *model.Reaction) *model.AppError {
	return a.app.DeleteReactionForPost(a.ctx, reaction)
}

func (a *SharedChannelApp) PatchChannelModerationsForChannel(channel *model.Channel, channelModerationsPatch []*model.ChannelModerationPatch) ([]*model.ChannelModeration, *model.AppError) {
	return a.app.PatchChannelModerationsForChannel(channel, channelModerationsPatch)
}

func (a *SharedChannelApp) CreateUploadSession(us *model.UploadSession) (*model.UploadSession, *model.AppError) {
	return a.app.CreateUploadSession(us)
}

func (a *SharedChannelApp) FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return a.app.FileReader(path)
}

func (a *SharedChannelApp) MentionsToTeamMembers(message, teamID string) model.UserMentionMap {
	return a.app.MentionsToTeamMembers(message, teamID)
}

func (a *SharedChannelApp) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	return a.app.GetProfileImage(user)
}

func (a *SharedChannelApp) InvalidateCacheForUser(userID string) {
	a.app.InvalidateCacheForUser(userID)
}

func (a *SharedChannelApp) NotifySharedChannelUserUpdate(user *model.User) {
	a.app.NotifySharedChannelUserUpdate(user)
}
