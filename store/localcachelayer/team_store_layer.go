// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCacheTeamStore struct {
	store.TeamStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheTeamStore) handleClusterInvalidateTeam(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.teamCache.Purge()
	} else {
		s.rootStore.teamCache.Remove(msg.Data)
	}
}

func (s LocalCacheTeamStore) ClearCaches() {
	s.rootStore.teamCache.Purge()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("All Team Ids for User - Purge")
	}
}

func (s LocalCacheTeamStore) InvalidateAllTeamIdsForUser(userId string) {
	s.rootStore.teamCache.Remove(userId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("All Team Ids for User - Remove by UserId")
	}
}

func (s LocalCacheTeamStore) GetUserTeamIds(userID string, allowFromCache bool) ([]string, *model.AppError) {
	if !allowFromCache {
		return s.TeamStore.GetUserTeamIds(userID, allowFromCache)
	}

	if userTeamIds := s.rootStore.doStandardReadCache(s.rootStore.teamCache, userID); userTeamIds != nil {
		return userTeamIds.([]string), nil
	}

	userTeamIds, err := s.TeamStore.GetUserTeamIds(userID, allowFromCache)
	if err != nil {
		return nil, err
	}

	if len(userTeamIds) > 0 {
		s.rootStore.doStandardAddToCache(s.rootStore.teamCache, userID, userTeamIds)
	}

	return userTeamIds, nil
}
