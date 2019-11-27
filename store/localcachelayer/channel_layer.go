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

func (s *LocalCacheChannelStore) handleClusterInvalidateChannelByName(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.channelByNameCache.Purge()
	} else {
		s.rootStore.channelByNameCache.Remove(msg.Data)
	}
}

func (s LocalCacheChannelStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelMemberCountsCache)
	s.rootStore.doClearCacheCluster(s.rootStore.channelByNameCache)
	s.ChannelStore.ClearCaches()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel By Name - Purge")
	}
}

func (s LocalCacheChannelStore) InvalidateMemberCount(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelMemberCountsCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel Member Counts - Remove by ChannelId")
	}
}

func (s LocalCacheChannelStore) InvalidateChannelByName(teamId, name string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelByNameCache, teamId+name)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Channel by Name - Remove by TeamId and Name")
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

// ChannelCacheByName methods
func (s LocalCacheChannelStore) GetByName(teamId string, name string, allowFromCache bool) (*model.Channel, *model.AppError) {
	return s.getByName(teamId, name, false, allowFromCache)
}

func (s LocalCacheChannelStore) GetByNames(teamId string, names []string, allowFromCache bool) ([]*model.Channel, *model.AppError) {
	var channels []*model.Channel

	if allowFromCache {
		var misses []string
		visited := make(map[string]struct{})
		for _, name := range names {
			if _, ok := visited[name]; ok {
				continue
			}
			visited[name] = struct{}{}
			if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.channelByNameCache, teamId + name); cacheItem != nil {
				channels = append(channels, cacheItem.(*model.Channel))
			} else {
				misses = append(misses, name)
			}
		}
		names = misses
	}

	if len(names) > 0 {
		dbChannels, err := s.ChannelStore.GetByNames(teamId, names, allowFromCache)

		if err != nil {
			return nil, err
		}

		for _, channel := range dbChannels {
			s.rootStore.doStandardAddToCache(s.rootStore.channelByNameCache, teamId+channel.Name, channel)
			channels = append(channels, channel) // add missing channels to the ones just found
		}
	}

	return channels, nil
}

func (s LocalCacheChannelStore) getByName(teamId string, name string, includeDeleted bool, allowFromCache bool) (*model.Channel, *model.AppError) {
	if allowFromCache {
		if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.channelByNameCache, teamId + name); cacheItem != nil {
			return cacheItem.(*model.Channel), nil
		}
	}

	channel, err := s.ChannelStore.GetByName(teamId, name, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.channelByNameCache, teamId+name, channel)
	}

	return channel, err
}
