// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"net/http"

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

func (s LocalCacheUserStore) ClearCaches() {
	s.rootStore.userProfileByIdsCache.Purge()

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Purge")
	}
}

func (s LocalCacheUserStore) InvalidatProfileCacheForUser(userId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userProfileByIdsCache, userId)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Profile By Ids - Remove")
	}
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
		if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.userProfileByIdsCache, userId); cacheItem != nil {
			u := &model.User{}
			*u = *cacheItem.(*model.User)

			if options.Since == 0 || u.UpdateAt > options.Since {
				users = append(users, u)
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
			return nil, model.NewAppError("SqlUserStore.GetProfileByIds", "store.sql_user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		users = append(users, remainingUsers...)

		for _, user := range remainingUsers {
			s.rootStore.doStandardAddToCache(s.rootStore.userProfileByIdsCache, user.Id, user)
		}

	}

	return users, nil
}
