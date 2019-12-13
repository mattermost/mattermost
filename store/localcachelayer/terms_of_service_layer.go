// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

const (
	LATEST_KEY = "latest"
)

type LocalCacheTermsOfServiceStore struct {
	store.TermsOfServiceStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheTermsOfServiceStore) handleClusterInvalidateTermsOfService(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.termsOfServiceCache.Purge()
	} else {
		s.rootStore.termsOfServiceCache.Remove(msg.Data)
	}
}

func (s LocalCacheTermsOfServiceStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.termsOfServiceCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Terms Of Service - Purge")
	}
}

func (s LocalCacheTermsOfServiceStore) Save(termsOfService *model.TermsOfService) (*model.TermsOfService, *model.AppError) {
	tos, err := s.TermsOfServiceStore.Save(termsOfService)

	if err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.termsOfServiceCache, tos.Id, tos)
		s.rootStore.doInvalidateCacheCluster(s.rootStore.termsOfServiceCache, LATEST_KEY)
	}
	return tos, err
}

func (s LocalCacheTermsOfServiceStore) GetLatest(allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if s.rootStore.termsOfServiceCache.Len() != 0 {
			if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.termsOfServiceCache, LATEST_KEY); cacheItem != nil {
				return cacheItem.(*model.TermsOfService), nil
			}
		}
	}

	termsOfService, err := s.TermsOfServiceStore.GetLatest(allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.termsOfServiceCache, termsOfService.Id, termsOfService)
		s.rootStore.doStandardAddToCache(s.rootStore.termsOfServiceCache, LATEST_KEY, termsOfService)
	}

	return termsOfService, err
}

func (s LocalCacheTermsOfServiceStore) Get(id string, allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if cacheItem := s.rootStore.doStandardReadCache(s.rootStore.termsOfServiceCache, id); cacheItem != nil {
			return cacheItem.(*model.TermsOfService), nil
		}
	}

	termsOfService, err := s.TermsOfServiceStore.Get(id, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.termsOfServiceCache, termsOfService.Id, termsOfService)
	}

	return termsOfService, err
}
