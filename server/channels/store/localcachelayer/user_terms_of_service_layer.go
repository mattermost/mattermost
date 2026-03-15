// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheUserTermsOfServiceStore struct {
	store.UserTermsOfServiceStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheUserTermsOfServiceStore) handleClusterInvalidateUserTermsOfService(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.userTermsOfServiceCache.Purge(); err != nil {
			s.rootStore.logger.Warn("Error while purging cache", mlog.Err(err), mlog.String("cache_name", s.rootStore.userTermsOfServiceCache.Name()))
		}
	} else {
		if err := s.rootStore.userTermsOfServiceCache.Remove(string(msg.Data)); err != nil {
			s.rootStore.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", s.rootStore.userTermsOfServiceCache.Name()), mlog.String("key", string(msg.Data)))
		}
	}
}

func (s LocalCacheUserTermsOfServiceStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.userTermsOfServiceCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userTermsOfServiceCache.Name())
	}
}

func (s LocalCacheUserTermsOfServiceStore) GetByUser(userID string) (*model.UserTermsOfService, error) {
	var cacheItem *model.UserTermsOfService
	if err := s.rootStore.doStandardReadCache(s.rootStore.userTermsOfServiceCache, userID, &cacheItem); err == nil {
		return cacheItem, nil
	}

	userTermsOfService, err := s.UserTermsOfServiceStore.GetByUser(userID)

	if err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.userTermsOfServiceCache, userID, userTermsOfService)
	}

	return userTermsOfService, err
}

func (s LocalCacheUserTermsOfServiceStore) Save(userTermsOfService *model.UserTermsOfService) (*model.UserTermsOfService, error) {
	utos, err := s.UserTermsOfServiceStore.Save(userTermsOfService)

	if err == nil {
		s.rootStore.doStandardAddToCache(s.rootStore.userTermsOfServiceCache, utos.UserId, utos)
	}
	return utos, err
}

func (s LocalCacheUserTermsOfServiceStore) Delete(userID, termsOfServiceID string) error {
	err := s.UserTermsOfServiceStore.Delete(userID, termsOfServiceID)

	if err == nil {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.userTermsOfServiceCache, userID, nil)
	}

	return err
}
