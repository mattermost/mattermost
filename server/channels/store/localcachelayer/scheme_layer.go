// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
)

type LocalCacheSchemeStore struct {
	store.SchemeStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheSchemeStore) handleClusterInvalidateScheme(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.schemeCache.Purge()
	} else {
		s.rootStore.schemeCache.Remove(string(msg.Data))
	}
}

func (s LocalCacheSchemeStore) Save(scheme *model.Scheme) (*model.Scheme, error) {
	if scheme.Id != "" {
		defer s.rootStore.doInvalidateCacheCluster(s.rootStore.schemeCache, scheme.Id)
	}
	return s.SchemeStore.Save(scheme)
}

func (s LocalCacheSchemeStore) Get(schemeId string) (*model.Scheme, error) {
	var scheme *model.Scheme
	if err := s.rootStore.doStandardReadCache(s.rootStore.schemeCache, schemeId, &scheme); err == nil {
		return scheme, nil
	}

	scheme, err := s.SchemeStore.Get(schemeId)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.schemeCache, schemeId, scheme)

	return scheme, nil
}

func (s LocalCacheSchemeStore) Delete(schemeId string) (*model.Scheme, error) {
	defer s.rootStore.doInvalidateCacheCluster(s.rootStore.schemeCache, schemeId)
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)
	defer s.rootStore.doClearCacheCluster(s.rootStore.rolePermissionsCache)
	return s.SchemeStore.Delete(schemeId)
}

func (s LocalCacheSchemeStore) PermanentDeleteAll() error {
	defer s.rootStore.doClearCacheCluster(s.rootStore.schemeCache)
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)
	defer s.rootStore.doClearCacheCluster(s.rootStore.rolePermissionsCache)
	return s.SchemeStore.PermanentDeleteAll()
}
