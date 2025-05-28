// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type SearchEngineInterface interface {
	Start() *model.AppError
	Stop() *model.AppError
	GetFullVersion() string
	GetVersion() int
	GetPlugins() []string
	UpdateConfig(cfg *model.Config)
	GetName() string
	// IsEnabled returns a boolean indicating whether the engine is enabled in the settings
	IsEnabled() bool
	IsActive() bool
	IsIndexingEnabled() bool
	IsSearchEnabled() bool
	IsAutocompletionEnabled() bool
	IsIndexingSync() bool
	IndexPost(post *model.Post, teamId string) *model.AppError
	SearchPosts(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, model.PostSearchMatches, *model.AppError)
	DeletePost(post *model.Post) *model.AppError
	DeleteChannelPosts(rctx request.CTX, channelID string) *model.AppError
	DeleteUserPosts(rctx request.CTX, userID string) *model.AppError
	// IndexChannel indexes a given channel. The userIDs are only populated
	// for private channels.
	IndexChannel(rctx request.CTX, channel *model.Channel, userIDs, teamMemberIDs []string) *model.AppError
	SearchChannels(teamId, userID, term string, isGuest, includeDeleted bool) ([]string, *model.AppError)
	DeleteChannel(channel *model.Channel) *model.AppError
	IndexUser(rctx request.CTX, user *model.User, teamsIds, channelsIds []string) *model.AppError
	SearchUsersInChannel(teamId, channelId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, []string, *model.AppError)
	SearchUsersInTeam(teamId string, restrictedToChannels []string, term string, options *model.UserSearchOptions) ([]string, *model.AppError)
	DeleteUser(user *model.User) *model.AppError
	IndexFile(file *model.FileInfo, channelId string) *model.AppError
	SearchFiles(channels model.ChannelList, searchParams []*model.SearchParams, page, perPage int) ([]string, *model.AppError)
	DeleteFile(fileID string) *model.AppError
	DeletePostFiles(rctx request.CTX, postID string) *model.AppError
	DeleteUserFiles(rctx request.CTX, userID string) *model.AppError
	DeleteFilesBatch(rctx request.CTX, endTime, limit int64) *model.AppError
	TestConfig(rctx request.CTX, cfg *model.Config) *model.AppError
	PurgeIndexes(rctx request.CTX) *model.AppError
	PurgeIndexList(rctx request.CTX, indexes []string) *model.AppError
	RefreshIndexes(rctx request.CTX) *model.AppError
	DataRetentionDeleteIndexes(rctx request.CTX, cutoff time.Time) *model.AppError
}
