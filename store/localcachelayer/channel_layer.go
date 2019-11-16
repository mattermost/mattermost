// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCacheChannelStore struct {
	store.ChannelStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelMemberCounts(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelMemberCountsCache.Purge()
	} else {
		s.rootStore.channelMemberCountsCache.Remove(msg.Data)
	}
}

func (s LocalCacheChannelStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelMemberCountsCache)
	s.ChannelStore.ClearCaches()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Purge")
	}
}

func (s LocalCacheChannelStore) InvalidateMemberCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelMemberCountsCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Remove by ChannelId")
	}
}

func (s LocalCacheChannelStore) GetMemberCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if count := s.rootStore.doStandardReadCache(s.rootStore.channelMemberCountsCache, channelId); count != nil {
			return count.(int64), nil
		}
	}
	count, err := s.ChannelStore.GetMemberCount(channelId, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelMemberCountsCache, channelId, count)
	}

	return count, err
}

func (s LocalCacheChannelStore) GetMemberCountFromCache(channelId string) int64 {
	if count := s.rootStore.doStandardReadCache(s.rootStore.channelMemberCountsCache, channelId); count != nil {
		return count.(int64)
	}

	count, err := s.GetMemberCount(channelId, true)
	if err != nil {
		return 0
	}

	return count
}
