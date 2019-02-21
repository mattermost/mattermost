// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
)

type ElasticsearchInterface interface {
	Start() *model.AppError
	Stop() *model.AppError
	IndexPost(post *model.Post, teamId string) *model.AppError
	SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError)
	DeletePost(post *model.Post) *model.AppError
	IndexChannel(channel *model.Channel) *model.AppError
	SearchChannels(teamId, term string) ([]string, *model.AppError)
	DeleteChannel(channel *model.Channel) *model.AppError
	IndexUser(user *model.User, channelsIds []string) *model.AppError
	SearchUsersInChannelAndOutside(channelId string, outsideChannelIds []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError)
	SearchUsersInChannels(channelIds []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError)
	DeleteUser(user *model.User) *model.AppError
	TestConfig(cfg *model.Config) *model.AppError
	PurgeIndexes() *model.AppError
	DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError
}
