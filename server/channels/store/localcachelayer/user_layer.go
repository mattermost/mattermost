// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"context"
	"sort"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

type LocalCacheUserStore struct {
	store.UserStore
	rootStore                     *LocalCacheStore
	userProfileByIdsMut           sync.Mutex
	userProfileByIdsInvalidations map[string]bool
}

const allUserKey = "ALL"

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

func (s *LocalCacheUserStore) handleClusterInvalidateAllProfiles(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.allUserCache.Purge()
	} else {
		s.rootStore.allUserCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheUserStore) ClearCaches() {
	s.rootStore.userProfileByIdsCache.Purge()
	s.rootStore.allUserCache.Purge()
	s.rootStore.profilesInChannelCache.Purge()

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userProfileByIdsCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.profilesInChannelCache.Name())
	}
}

func (s *LocalCacheUserStore) InvalidateProfileCacheForUser(userId string) {
	s.userProfileByIdsMut.Lock()
	s.userProfileByIdsInvalidations[userId] = true
	s.userProfileByIdsMut.Unlock()
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userProfileByIdsCache, userId, nil)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.allUserCache, allUserKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userProfileByIdsCache.Name())
	}
}

func (s *LocalCacheUserStore) InvalidateProfilesInChannelCacheByUser(userId string) {
	var toDelete []string
	err := s.rootStore.profilesInChannelCache.Scan(func(keys []string) error {
		if len(keys) == 0 {
			return nil
		}

		toPass := allocateCacheTargets[model.UserMap](len(keys))
		errs := s.rootStore.doMultiReadCache(s.rootStore.profilesInChannelCache, keys, toPass)
		for i, err := range errs {
			if err != nil {
				if err != cache.ErrKeyNotFound {
					return err
				}
				continue
			}
			gotMap := *(toPass[i].(*model.UserMap))
			if gotMap == nil {
				s.rootStore.logger.Warn("Found nil userMap in InvalidateProfilesInChannelCacheByUser. This is not expected")
				continue
			}
			if _, ok := gotMap[userId]; ok {
				toDelete = append(toDelete, keys[i])
			}
		}
		return nil
	})
	if err != nil {
		s.rootStore.logger.Warn("Error while scanning in InvalidateProfilesInChannelCacheByUser", mlog.Err(err))
		return
	}
	s.rootStore.doMultiInvalidateCacheCluster(s.rootStore.profilesInChannelCache, toDelete, nil)
}

func (s *LocalCacheUserStore) InvalidateProfilesInChannelCache(channelID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.profilesInChannelCache, channelID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.profilesInChannelCache.Name())
	}
}

func (s *LocalCacheUserStore) GetAllProfiles(options *model.UserGetOptions) ([]*model.User, error) {
	if isEmptyOptions(options) &&
		options.Page == 0 && options.PerPage == 100 { // This is hardcoded to the webapp call.
		// read from cache
		var users []*model.User
		if err := s.rootStore.doStandardReadCache(s.rootStore.allUserCache, allUserKey, &users); err == nil {
			return users, nil
		}

		users, err := s.UserStore.GetAllProfiles(options)
		if err != nil {
			return nil, err
		}

		// populate the cache only for those options.
		s.rootStore.doStandardAddToCache(s.rootStore.allUserCache, allUserKey, users)

		return users, nil
	}

	// For any other case, simply use the store
	return s.UserStore.GetAllProfiles(options)
}

func (s *LocalCacheUserStore) GetAllProfilesInChannel(ctx context.Context, channelId string, allowFromCache bool) (map[string]*model.User, error) {
	if allowFromCache {
		var cachedMap model.UserMap
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
	toPass := allocateCacheTargets[model.User](len(userIds))
	errs := s.rootStore.doMultiReadCache(s.rootStore.userProfileByIdsCache, userIds, toPass)
	for i, err := range errs {
		if err != nil {
			if err != cache.ErrKeyNotFound {
				s.rootStore.logger.Warn("Error in UserStore.GetProfileByIds: ", mlog.Err(err))
			}
			// If it was invalidated, then we need to query master.
			s.userProfileByIdsMut.Lock()
			if s.userProfileByIdsInvalidations[userIds[i]] {
				fromMaster = true
				// And then remove the key from the map.
				delete(s.userProfileByIdsInvalidations, userIds[i])
			}
			s.userProfileByIdsMut.Unlock()
			remainingUserIds = append(remainingUserIds, userIds[i])
		} else {
			gotUser := toPass[i].(*model.User)
			if (gotUser != nil) && (options.Since == 0 || gotUser.UpdateAt > options.Since) {
				users = append(users, gotUser)
			} else if gotUser == nil {
				s.rootStore.logger.Warn("Found nil user in GetProfileByIds. This is not expected")
			}
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

func (s *LocalCacheUserStore) UpdateFailedPasswordAttempts(userID string, attempts int) error {
	s.InvalidateProfileCacheForUser(userID)
	return s.UserStore.UpdateFailedPasswordAttempts(userID, attempts)
}

// Get is a cache wrapper around the SqlStore method to get a user profile by id.
// It checks if the user entry is present in the cache, returning the entry from cache
// if it is present. Otherwise, it fetches the entry from the store and stores it in the
// cache.
func (s *LocalCacheUserStore) Get(ctx context.Context, id string) (*model.User, error) {
	var cacheItem model.User
	if err := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, id, &cacheItem); err == nil {
		return &cacheItem, nil
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
	toPass := allocateCacheTargets[model.User](len(uniqIDs))
	errs := s.rootStore.doMultiReadCache(s.rootStore.userProfileByIdsCache, uniqIDs, toPass)
	for i, err := range errs {
		if err != nil {
			if err != cache.ErrKeyNotFound {
				s.rootStore.logger.Warn("Error in UserStore.GetMany: ", mlog.Err(err))
			}
			// If it was invalidated, then we need to query master.
			s.userProfileByIdsMut.Lock()
			if s.userProfileByIdsInvalidations[uniqIDs[i]] {
				fromMaster = true
				// And then remove the key from the map.
				delete(s.userProfileByIdsInvalidations, uniqIDs[i])
			}
			s.userProfileByIdsMut.Unlock()
			notCachedUserIds = append(notCachedUserIds, uniqIDs[i])
		} else {
			gotUser := toPass[i].(*model.User)
			if gotUser != nil {
				cachedUsers = append(cachedUsers, gotUser)
			} else {
				s.rootStore.logger.Warn("Found nil user in GetMany. This is not expected")
			}
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

func isEmptyOptions(options *model.UserGetOptions) bool {
	// We check to see if any of the options are set or not, and then
	// use the cache only if none are set, which is the most common case.
	// options.WithoutTeam, Sort is unused
	if options.InTeamId == "" &&
		options.NotInTeamId == "" &&
		options.InChannelId == "" &&
		options.NotInChannelId == "" &&
		options.InGroupId == "" &&
		options.NotInGroupId == "" &&
		!options.GroupConstrained &&
		!options.Inactive &&
		!options.Active &&
		options.Role == "" &&
		len(options.Roles) == 0 &&
		len(options.ChannelRoles) == 0 &&
		len(options.TeamRoles) == 0 &&
		options.ViewRestrictions == nil {
		return true
	}
	return false
}
