// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

type ElasticsearchInterface interface {
	Start() *model.AppError
	Stop() *model.AppError
	GetVersion() int
	IndexPost(post *model.Post, teamId string) *model.AppError
	SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError)
	DeletePost(post *model.Post) *model.AppError
	IndexChannel(channel *model.Channel) *model.AppError
	SearchChannels(teamId, term string) ([]string, *model.AppError)
	DeleteChannel(channel *model.Channel) *model.AppError
	IndexUser(user *model.User, teamsIds, channelsIds []string) *model.AppError
	SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError)
	SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError)
	DeleteUser(user *model.User) *model.AppError
	TestConfig(cfg *model.Config) *model.AppError
	PurgeIndexes() *model.AppError
	DataRetentionDeleteIndexes(cutoff time.Time) *model.AppError
}
