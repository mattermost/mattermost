// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type MEPostStore interface {
	AnalyticsPostCount(options *model.PostCountOptions) (int64, error)
}

type MEChannelMemberHistoryStore interface {
	GetChannelsWithActivityDuring(startTime int64, endTime int64) ([]string, error)
	GetUsersInChannelDuring(startTime int64, endTime int64, channelID []string) ([]*model.ChannelMemberHistoryResult, error)
}

type MEChannelStore interface {
	GetMany(ids []string, allowFromCache bool) (model.ChannelList, error)
	GetForPost(postID string) (*model.Channel, error)
}

type MEComplianceStore interface {
	MessageExport(c request.CTX, cursor model.MessageExportCursor, limit int) ([]*model.MessageExport, model.MessageExportCursor, error)
}

type MEFileInfoStore interface {
	GetForPost(postID string, readFromMaster, includeDeleted, allowFromCache bool) ([]*model.FileInfo, error)
}

type MessageExportStore interface {
	Post() MEPostStore
	ChannelMemberHistory() MEChannelMemberHistoryStore
	Channel() MEChannelStore
	Compliance() MEComplianceStore
	FileInfo() MEFileInfoStore
}

type SparseStore struct {
	store.Store
}

func NewMessageExportStore(s store.Store) SparseStore {
	return SparseStore{s}
}

func (ss SparseStore) Post() MEPostStore {
	return ss.Store.Post()
}

func (ss SparseStore) ChannelMemberHistory() MEChannelMemberHistoryStore {
	return ss.Store.ChannelMemberHistory()
}

func (ss SparseStore) Channel() MEChannelStore {
	return ss.Store.Channel()
}

func (ss SparseStore) Compliance() MEComplianceStore {
	return ss.Store.Compliance()
}

func (ss SparseStore) FileInfo() MEFileInfoStore {
	return ss.Store.FileInfo()
}
