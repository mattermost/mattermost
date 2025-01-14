// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package shared

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type MessageExportStore interface {
	Post() store.PostStore
	ChannelMemberHistory() store.ChannelMemberHistoryStore
	Channel() store.ChannelStore
	Compliance() store.ComplianceStore
	FileInfo() MEFileInfoStore
}

type MEFileInfoStore interface {
	GetForPost(postID string, readFromMaster, includeDeleted, allowFromCache bool) ([]*model.FileInfo, error)
}

type messageExportStore struct {
	store.Store
}

// NewMessageExportStore returns a wrapped store.Store. Why? Because the CLI tool needs to "override" the GetForPost
// method in FileStore. Non-CLI code only needs to use the store.Store's methods. This can be removed when we deprecate
// the CLI tool. Tracked at MM-61139.
func NewMessageExportStore(s store.Store) messageExportStore {
	return messageExportStore{s}
}

func (ss messageExportStore) FileInfo() MEFileInfoStore {
	return ss.Store.FileInfo()
}
