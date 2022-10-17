// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
)

type ChannelsIFace interface {
	GetChannel(c request.CTX, channelID string) (*model.Channel, *model.AppError)
	GetChannels(c request.CTX, channelIDs []string) ([]*model.Channel, *model.AppError)
	CreateChannel(c request.CTX, channel *model.Channel, addMember bool) (*model.Channel, *model.AppError)
	GetOrCreateDirectChannel(c request.CTX, userID, otherUserID string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError)
	GetOrCreateDirectChannelWithUser(c request.CTX, user, otherUser *model.User) (*model.Channel, *model.AppError)
	SaveSharedChannel(c request.CTX, sc *model.SharedChannel) (*model.SharedChannel, error)
	PermanentDeleteChannel(c request.CTX, channel *model.Channel) *model.AppError
	UpdateChannelScheme(c request.CTX, channel *model.Channel) (*model.Channel, *model.AppError)
	AddDirectChannels(c request.CTX, teamID, userID string) *model.AppError
	GetChannelsForTeamForUser(c request.CTX, teamID string, userID string, opts *model.ChannelSearchOpts) (model.ChannelList, *model.AppError)
	JoinDefaultChannels(c request.CTX, teamID string, user *model.User, shouldBeAdmin bool, userRequestorId string) *model.AppError
	GetChannelMembersForUser(c request.CTX, teamID string, userID string) (model.ChannelMembers, *model.AppError)
	GetPublicChannelsForTeam(c request.CTX, teamID string, offset int, limit int) (model.ChannelList, *model.AppError)
	GetChannelMembersPage(c request.CTX, channelID string, page, perPage int) (model.ChannelMembers, *model.AppError)
	UpdateChannelMemberSchemeRoles(c request.CTX, channelID string, userID string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.ChannelMember, *model.AppError)
	GetChannelGuestCount(c request.CTX, channelID string) (int64, *model.AppError)
	GetChannelByName(c request.CTX, channelName, teamID string, includeDeleted bool) (*model.Channel, *model.AppError)
	GetGroupChannel(c request.CTX, userIDs []string) (*model.Channel, *model.AppError)
	AddToDefaultChannelsWithToken(c request.CTX, teamID, userID string, token *model.Token) *model.AppError

	GetChannelMember(c request.CTX, channelID string, userID string) (*model.ChannelMember, *model.AppError)
	AddUserToChannel(c request.CTX, user *model.User, channel *model.Channel, skipTeamMemberIntegrityCheck bool) (*model.ChannelMember, *model.AppError)

	GetPosts(channelID string, offset int, limit int) (*model.PostList, *model.AppError)
	CreatePost(c request.CTX, post *model.Post, channel *model.Channel, triggerWebhooks, setOnline bool) (savedPost *model.Post, err *model.AppError)
	CreatePostAsUser(c request.CTX, post *model.Post, currentSessionId string, setOnline bool) (*model.Post, *model.AppError)

	GetSidebarCategory(c request.CTX, categoryId string) (*model.SidebarCategoryWithChannels, *model.AppError)
	GetSidebarCategoriesForTeamForUser(c request.CTX, userID, teamID string) (*model.OrderedSidebarCategories, *model.AppError)
}
