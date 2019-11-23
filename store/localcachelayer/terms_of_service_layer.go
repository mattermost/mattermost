// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCacheTermsOfServiceStore struct {
	store.TermsOfServiceStore
	rootStore *LocalCacheStore
}

const (
	termsOfServiceCacheName = "TermsOfServiceStore"
)

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

func (s LocalCacheTermsOfServiceStore) InvalidateTermsOfService(termsOfServiceId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.termsOfServiceCache, termsOfServiceId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Terms Of Service - Remove by TermsOfServiceId")
	}
}

func (s LocalCacheTermsOfServiceStore) Save(termsOfService *model.TermsOfService) (*model.TermsOfService, *model.AppError) {
	tos, err := s.TermsOfServiceStore.Save(termsOfService)
	if err != nil {
		return nil, err
	}
	s.rootStore.termsOfServiceCache.AddWithDefaultExpires(termsOfService.Id, termsOfService)
	return tos, nil
}

func (s LocalCacheTermsOfServiceStore) GetLatest(allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if s.rootStore.termsOfServiceCache.Len() != 0 {
			if cacheItem, ok := s.rootStore.termsOfServiceCache.Get(s.rootStore.termsOfServiceCache.Keys()[len(s.rootStore.termsOfServiceCache.Keys())-1]); ok {
				if s.rootStore.metrics != nil {
					s.rootStore.metrics.IncrementMemCacheHitCounter(termsOfServiceCacheName)
				}

				return cacheItem.(*model.TermsOfService), nil
			}
		}
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheMissCounter(termsOfServiceCacheName)
	}

	termsOfService, err := s.TermsOfServiceStore.GetLatest(allowFromCache)
	if err != nil {
		return nil, err
	}

	if allowFromCache {
		s.rootStore.termsOfServiceCache.AddWithDefaultExpires(termsOfService.Id, termsOfService)
	}

	return termsOfService, nil
}

func (s LocalCacheTermsOfServiceStore) Get(id string, allowFromCache bool) (*model.TermsOfService, *model.AppError) {
	if allowFromCache {
		if s.rootStore.termsOfServiceCache.Len() != 0 {
			if cacheItem, ok := s.rootStore.termsOfServiceCache.Get(id); ok {
				if s.rootStore.metrics != nil {
					s.rootStore.metrics.IncrementMemCacheHitCounter(termsOfServiceCacheName)
				}

				return cacheItem.(*model.TermsOfService), nil
			}
		}
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheMissCounter(termsOfServiceCacheName)
	}

	termsOfService, err := s.TermsOfServiceStore.Get(id, allowFromCache)

	if allowFromCache && err == nil {
		s.rootStore.termsOfServiceCache.AddWithDefaultExpires(termsOfService.Id, termsOfService)
	}

	return termsOfService, err
}
