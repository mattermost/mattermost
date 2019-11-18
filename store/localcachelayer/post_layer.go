// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCachePostStore struct {
	store.PostStore
	rootStore *LocalCacheStore
}

func (s *LocalCachePostStore) handleClusterInvalidateLastPosts(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.postLastPostsCache.Purge()
	} else {
		s.rootStore.postLastPostsCache.Remove(msg.Data)
	}
}
