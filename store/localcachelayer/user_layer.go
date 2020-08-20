// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheUserStore struct {
	store.UserStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheUserStore) handleClusterInvalidateScheme(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.userProfileByIdsCache.Purge()
	} else {
		s.rootStore.userProfileByIdsCache.Remove(msg.Data)
	}
}

func (s *LocalCacheUserStore) handleClusterInvalidateProfilesInChannel(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.profilesInChannelCache.Purge()
	} else {
		s.rootStore.profilesInChannelCache.Remove(msg.Data)
	}
}

func (s LocalCacheUserStore) ClearCaches() {
	s.rootStore.userProfileByIdsCache.Purge()
	s.rootStore.profilesInChannelCache.Purge()

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Purge")
	}
}

func (s LocalCacheUserStore) InvalidateProfileCacheForUser(userId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userProfileByIdsCache, userId)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Remove")
	}
}

func (s LocalCacheUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {
	keys, err := s.rootStore.profilesInChannelCache.Keys()
	if err == nil {
		for _, key := range keys {
			var userMap map[string]*model.User
			if err = s.rootStore.profilesInChannelCache.Get(key, &userMap); err == nil {
				if _, userInCache := userMap[userId]; userInCache {
					s.rootStore.doInvalidateCacheCluster(s.rootStore.profilesInChannelCache, key)
					if s.rootStore.metrics != nil {
						s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Remove by User")
					}
				}
			}
		}
	}
}

func (s LocalCacheUserStore) InvalidateProfilesInChannelCache(channelId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.profilesInChannelCache, channelId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Remove by Channel")
	}
}

func (s LocalCacheUserStore) GetAllProfilesInChannel(channelId string, allowFromCache bool) (map[string]*model.User, *model.AppError) {
	if allowFromCache {
		var cachedMap map[string]*model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.profilesInChannelCache, channelId, &cachedMap); err == nil {
			return cachedMap, nil
		}
	}

	userMap, err := s.UserStore.GetAllProfilesInChannel(channelId, allowFromCache)
	if err != nil {
		return nil, err
	}

	if allowFromCache {
		s.rootStore.doStandardAddToCache(s.rootStore.profilesInChannelCache, channelId, userMap)
	}

	return userMap, nil
}

func (s LocalCacheUserStore) GetProfileByIds(userIds []string, options *store.UserGetByIdsOpts, allowFromCache bool) ([]*model.User, *model.AppError) {
	if !allowFromCache {
		return s.UserStore.GetProfileByIds(userIds, options, false)
	}

	if options == nil {
		options = &store.UserGetByIdsOpts{}
	}

	users := []*model.User{}
	remainingUserIds := make([]string, 0)

	for _, userId := range userIds {
		var cacheItem *model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, userId, &cacheItem); err == nil {
			if options.Since == 0 || cacheItem.UpdateAt > options.Since {
				users = append(users, cacheItem)
			}
		} else {
			remainingUserIds = append(remainingUserIds, userId)
		}
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.AddMemCacheHitCounter("Profile By Ids", float64(len(users)))
		s.rootStore.metrics.AddMemCacheMissCounter("Profile By Ids", float64(len(remainingUserIds)))
	}

	if len(remainingUserIds) > 0 {
		remainingUsers, err := s.UserStore.GetProfileByIds(remainingUserIds, options, false)
		if err != nil {
			return nil, err
		}
		for _, user := range remainingUsers {
			s.rootStore.doStandardAddToCache(s.rootStore.userProfileByIdsCache, user.Id, user)
			users = append(users, user)
		}
	}

	return users, nil
}

// Get is a cache wrapper around the SqlStore method to get a user profile by id.
// It checks if the user entry is present in the cache, returning the entry from cache
// if it is present. Otherwise, it fetches the entry from the store and stores it in the
// cache.
func (s LocalCacheUserStore) Get(id string) (*model.User, *model.AppError) {
	var cacheItem *model.User
	if err := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, id, &cacheItem); err == nil {
		if s.rootStore.metrics != nil {
			s.rootStore.metrics.AddMemCacheHitCounter("Profile By Id", float64(1))
		}
		return cacheItem, nil
	}
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.AddMemCacheMissCounter("Profile By Id", float64(1))
	}
	user, err := s.UserStore.Get(id)
	if err != nil {
		return nil, err
	}
	s.rootStore.doStandardAddToCache(s.rootStore.userProfileByIdsCache, id, user)
	return user, nil
}
