package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCacheChannelStore struct {
	store.ChannelStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelGuestCounts(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelGuestsCountCache.Purge()
	} else {
		s.rootStore.channelGuestsCountCache.Remove(msg.Data)
	}
}

func (s LocalCacheChannelStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelGuestsCountCache)
	s.ChannelStore.ClearCaches()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Purge")
	}
}

func (s LocalCacheChannelStore) InvalidateGuestCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelGuestsCountCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Guests Count - Remove by channelId")
	}
}

func (s LocalCacheChannelStore) GetGuestCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if count := s.rootStore.doStandardReadCache(s.rootStore.channelGuestsCountCache, channelId); count != nil {
			return count.(int64), nil
		}
	}
	count, err := s.ChannelStore.GetGuestCount(channelId, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelGuestsCountCache, channelId, count)
	}

	return count, err
}

func (s LocalCacheChannelStore) GetGuestCountFromCache(channelId string) int64 {
	if count := s.rootStore.doStandardReadCache(s.rootStore.channelGuestsCountCache, channelId); count != nil {
		return count.(int64)
	}

	count, err := s.GetMemberCount(channelId, true)
	if err != nil {
		return 0
	}

	return count
}
