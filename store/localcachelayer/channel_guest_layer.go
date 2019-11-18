package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"net/http"
)

type LocalCacheChannelGuestCountStore struct {
	store.ChannelStore
	rootStore *LocalCacheStore
}


func (s LocalCacheChannelGuestCountStore) InvalidateGuestCount(channelId string, deleted bool) {
	cacheKey := channelId
	if deleted {
		cacheKey += "_deleted"
	}
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelGuestsCountCache, cacheKey)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("ChannelGuestCount - Remove by channelId")
	}
}

func (s LocalCacheChannelGuestCountStore) GetGuestCountFromCache(channelId string) int64 {
	if cacheItem, ok := s.rootStore.channelGuestsCountCache.Get(channelId); ok {
		if s.rootStore.metrics != nil {
			s.rootStore.metrics.IncrementMemCacheHitCounter("Channel Guest Counts")
		}
		return cacheItem.(int64)
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheMissCounter("Channel Guest Counts")
	}

	count, err := s.GetGuestCount(channelId, true)
	if err != nil {
		return 0
	}

	return count
}


func (s LocalCacheChannelGuestCountStore) GetGuestCount(channelId string, allowFromCache bool) (int64, *model.AppError) {
	if allowFromCache {
		if cacheItem, ok := s.rootStore.channelGuestsCountCache.Get(channelId); ok {
			if s.rootStore.metrics != nil {
				s.rootStore.metrics.IncrementMemCacheHitCounter("Channel Guest Counts")
			}
			return cacheItem.(int64), nil
		}
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheMissCounter("Channel Guest Counts")
	}

	count, err := s.rootStore.GetReplica().SelectInt(`
		SELECT
			count(*)
		FROM
			ChannelMembers,
			Users
		WHERE
			ChannelMembers.UserId = Users.Id
			AND ChannelMembers.ChannelId = :ChannelId
			AND ChannelMembers.SchemeGuest = TRUE
			AND Users.DeleteAt = 0`, map[string]interface{}{"ChannelId": channelId})
	if err != nil {
		return 0, model.NewAppError("SqlChannelStore.GetGuestCount", "store.sql_channel.get_member_count.app_error", nil, "channel_id="+channelId+", "+err.Error(), http.StatusInternalServerError)
	}

	if allowFromCache {
		s.rootStore.channelGuestsCountCache.AddWithExpiresInSecs(channelId, count, CHANNEL_GUESTS_COUNT_CACHE_SEC)
	}

	return count, nil
}
