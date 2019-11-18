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

func (s LocalCachePostStore) ClearCaches() {
	s.PostStore.ClearCaches()

	s.rootStore.postLastPostsCache.Purge()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Last Posts Cache - Purge")
	}
}

func (s LocalCachePostStore) InvalidateLastPostTimeCache(channelId string) {
	s.PostStore.InvalidateLastPostTimeCache(channelId)

	// Keys are "{channelid}{limit}" and caching only occurs on limits of 30 and 60
	s.rootStore.doInvalidateCacheCluster(s.rootStore.postLastPostsCache, channelId+"30")
	s.rootStore.doInvalidateCacheCluster(s.rootStore.postLastPostsCache, channelId+"60")

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Last Posts Cache - Remove by Channel Id")
	}
}
