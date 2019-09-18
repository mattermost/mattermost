// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import (
	"time"

	"github.com/mattermost/mattermost-server/model"
)

type ElasticsearchInterface interface {
	Start() error
	Stop() error
	IndexPost(post *model.Post, teamId string) error
	SearchPosts(channels *model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, error)
	DeletePost(post *model.Post) error
	IndexChannel(channel *model.Channel) error
	SearchChannels(teamId, term string) ([]string, error)
	DeleteChannel(channel *model.Channel) error
	IndexUser(user *model.User, teamsIds, channelsIds []string) error
	SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, error)
	SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, error)
	DeleteUser(user *model.User) error
	TestConfig(cfg *model.Config) error
	PurgeIndexes() error
	DataRetentionDeleteIndexes(cutoff time.Time) error
}
