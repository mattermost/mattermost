// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"fmt"
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

func (s LocalCachePostStore) GetPosts(options model.GetPostsOptions, allowFromCache bool) (*model.PostList, *model.AppError) {
	if !allowFromCache {
		return s.PostStore.GetPosts(options, allowFromCache)
	}

	offset := options.PerPage * options.Page
	// Caching only occurs on limits of 30 and 60, the common limits requested by MM clients
	if offset == 0 && (options.PerPage == 60 || options.PerPage == 30) {
		if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.postLastPostsCache, fmt.Sprintf("%s%v", options.ChannelId, options.PerPage)); cacheItem != nil {
			return cacheItem.(*model.PostList), nil
		}
	}

	list, err := s.PostStore.GetPosts(options, false)
	if err != nil {
		return nil, err
	}

	// Caching only occurs on limits of 30 and 60, the common limits requested by MM clients
	if offset == 0 && (options.PerPage == 60 || options.PerPage == 30) {
		s.rootStore.doStandardAddToCache(s.rootStore.postLastPostsCache, fmt.Sprintf("%s%v", options.ChannelId, options.PerPage), list)
	}

	return list, err
}
