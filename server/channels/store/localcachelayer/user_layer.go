// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"context"
	"sort"
	"sync"

	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/channels/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/model"
)

type LocalCacheUserStore struct {
	store.UserStore
	rootStore                     *LocalCacheStore
	userProfileByIdsMut           sync.Mutex
	userProfileByIdsInvalidations map[string]bool
}

func (s *LocalCacheUserStore) handleClusterInvalidateScheme(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.userProfileByIdsCache.Purge()
	} else {
		s.userProfileByIdsMut.Lock()
		s.userProfileByIdsInvalidations[string(msg.Data)] = true
		s.userProfileByIdsMut.Unlock()
		s.rootStore.userProfileByIdsCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheUserStore) handleClusterInvalidateProfilesInChannel(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.profilesInChannelCache.Purge()
	} else {
		s.rootStore.profilesInChannelCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheUserStore) ClearCaches() {
	s.rootStore.userProfileByIdsCache.Purge()
	s.rootStore.profilesInChannelCache.Purge()

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Purge")
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Purge")
	}
}

func (s *LocalCacheUserStore) InvalidateProfileCacheForUser(userId string) {
	s.userProfileByIdsMut.Lock()
	s.userProfileByIdsInvalidations[userId] = true
	s.userProfileByIdsMut.Unlock()
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userProfileByIdsCache, userId)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Remove")
	}
}

func (s *LocalCacheUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {
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

func (s *LocalCacheUserStore) InvalidateProfilesInChannelCache(channelID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.profilesInChannelCache, channelID)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profiles in Channel - Remove by Channel")
	}
}

func (s *LocalCacheUserStore) GetAllProfilesInChannel(ctx context.Context, channelId string, allowFromCache bool) (map[string]*model.User, error) {
	if allowFromCache {
		var cachedMap map[string]*model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.profilesInChannelCache, channelId, &cachedMap); err == nil {
			return cachedMap, nil
		}
	}

	userMap, err := s.UserStore.GetAllProfilesInChannel(ctx, channelId, allowFromCache)
	if err != nil {
		return nil, err
	}

	if allowFromCache {
		s.rootStore.doStandardAddToCache(s.rootStore.profilesInChannelCache, channelId, model.UserMap(userMap))
	}

	return userMap, nil
}

func (s *LocalCacheUserStore) GetProfileByIds(ctx context.Context, userIds []string, options *store.UserGetByIdsOpts, allowFromCache bool) ([]*model.User, error) {
	if !allowFromCache {
		return s.UserStore.GetProfileByIds(ctx, userIds, options, false)
	}

	if options == nil {
		options = &store.UserGetByIdsOpts{}
	}

	users := []*model.User{}
	remainingUserIds := make([]string, 0)

	fromMaster := false
	for _, userId := range userIds {
		var cacheItem *model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, userId, &cacheItem); err == nil {
			if options.Since == 0 || cacheItem.UpdateAt > options.Since {
				users = append(users, cacheItem)
			}
		} else {
			// If it was invalidated, then we need to query master.
			s.userProfileByIdsMut.Lock()
			if s.userProfileByIdsInvalidations[userId] {
				fromMaster = true
				// And then remove the key from the map.
				delete(s.userProfileByIdsInvalidations, userId)
			}
			s.userProfileByIdsMut.Unlock()
			remainingUserIds = append(remainingUserIds, userId)
		}
	}

	if len(remainingUserIds) > 0 {
		if fromMaster {
			ctx = sqlstore.WithMaster(ctx)
		}
		remainingUsers, err := s.UserStore.GetProfileByIds(ctx, remainingUserIds, options, false)
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
func (s *LocalCacheUserStore) Get(ctx context.Context, id string) (*model.User, error) {
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

	// If it was invalidated, then we need to query master.
	s.userProfileByIdsMut.Lock()
	if s.userProfileByIdsInvalidations[id] {
		ctx = sqlstore.WithMaster(ctx)
		// And then remove the key from the map.
		delete(s.userProfileByIdsInvalidations, id)
	}
	s.userProfileByIdsMut.Unlock()

	user, err := s.UserStore.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	s.rootStore.doStandardAddToCache(s.rootStore.userProfileByIdsCache, id, user)
	return user, nil
}

// GetMany is a cache wrapper around the SqlStore method to get a user profiles by ids.
// It checks if the user entries are present in the cache, returning the entries from cache
// if it is present. Otherwise, it fetches the entries from the store and stores it in the
// cache.
func (s *LocalCacheUserStore) GetMany(ctx context.Context, ids []string) ([]*model.User, error) {
	// we are doing a loop instead of caching the full set in the cache because the number of permutations that we can have
	// in this func is making caching of the total set not beneficial.
	var cachedUsers []*model.User
	var notCachedUserIds []string
	uniqIDs := dedup(ids)

	fromMaster := false
	for _, id := range uniqIDs {
		var cachedUser *model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, id, &cachedUser); err == nil {
			if s.rootStore.metrics != nil {
				s.rootStore.metrics.AddMemCacheHitCounter("Profile By Id", float64(1))
			}
			cachedUsers = append(cachedUsers, cachedUser)
		} else {
			if s.rootStore.metrics != nil {
				s.rootStore.metrics.AddMemCacheMissCounter("Profile By Id", float64(1))
			}
			// If it was invalidated, then we need to query master.
			s.userProfileByIdsMut.Lock()
			if s.userProfileByIdsInvalidations[id] {
				fromMaster = true
				// And then remove the key from the map.
				delete(s.userProfileByIdsInvalidations, id)
			}
			s.userProfileByIdsMut.Unlock()

			notCachedUserIds = append(notCachedUserIds, id)
		}
	}

	if len(notCachedUserIds) > 0 {
		if fromMaster {
			ctx = sqlstore.WithMaster(ctx)
		}
		dbUsers, err := s.UserStore.GetMany(ctx, notCachedUserIds)
		if err != nil {
			return nil, err
		}
		for _, user := range dbUsers {
			s.rootStore.doStandardAddToCache(s.rootStore.userProfileByIdsCache, user.Id, user)
			cachedUsers = append(cachedUsers, user)
		}
	}

	return cachedUsers, nil
}

func dedup(elements []string) []string {
	if len(elements) == 0 {
		return elements
	}

	sort.Strings(elements)

	j := 0
	for i := 1; i < len(elements); i++ {
		if elements[j] == elements[i] {
			continue
		}
		j++
		// preserve the original data
		// in[i], in[j] = in[j], in[i]
		// only set what is required
		elements[j] = elements[i]
	}

	return elements[:j+1]
}
