// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheSchemeStore struct {
	store.SchemeStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheSchemeStore) handleClusterInvalidateScheme(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.schemeCache.Purge()
	} else {
		s.rootStore.schemeCache.Remove(msg.Data)
	}
}

func (s LocalCacheSchemeStore) Save(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if len(scheme.Id) != 0 {
		defer s.rootStore.doInvalidateCacheCluster(s.rootStore.schemeCache, scheme.Id)
	}
	return s.SchemeStore.Save(scheme)
}

func (s LocalCacheSchemeStore) Get(schemeId string) (*model.Scheme, *model.AppError) {
	if scheme := s.rootStore.doStandardReadCache(s.rootStore.schemeCache, schemeId); scheme != nil {
		return scheme.(*model.Scheme), nil
	}

	scheme, err := s.SchemeStore.Get(schemeId)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.schemeCache, schemeId, scheme)

	return scheme, nil
}

func (s LocalCacheSchemeStore) Delete(schemeId string) (*model.Scheme, *model.AppError) {
	defer s.rootStore.doInvalidateCacheCluster(s.rootStore.schemeCache, schemeId)
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)

	return s.SchemeStore.Delete(schemeId)
}

func (s LocalCacheSchemeStore) PermanentDeleteAll() *model.AppError {
	defer s.rootStore.doClearCacheCluster(s.rootStore.schemeCache)
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)

	return s.SchemeStore.PermanentDeleteAll()
}
