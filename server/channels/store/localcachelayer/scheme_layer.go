// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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
		defer doInvalidateCacheCluster(s.rootStore.cluster, s.rootStore.schemeCache, scheme.Id)
	}
	return s.SchemeStore.Save(scheme)
}

func (s LocalCacheSchemeStore) Get(schemeId string) (*model.Scheme, error) {
	var scheme *model.Scheme
	if err := doStandardReadCache(s.rootStore.metrics, s.rootStore.schemeCache, schemeId, &scheme); err == nil {
		return scheme, nil
	}

	scheme, err := s.SchemeStore.Get(schemeId)
	if err != nil {
		return nil, err
	}

	doStandardAddToCache(s.rootStore.schemeCache, schemeId, scheme)

	return scheme, nil
}

func (s LocalCacheSchemeStore) Delete(schemeId string) (*model.Scheme, error) {
	defer doInvalidateCacheCluster(s.rootStore.cluster, s.rootStore.schemeCache, schemeId)
	defer doClearCacheCluster(s.rootStore.cluster, s.rootStore.roleCache)
	defer doClearCacheCluster(s.rootStore.cluster, s.rootStore.rolePermissionsCache)
	return s.SchemeStore.Delete(schemeId)
}

func (s LocalCacheSchemeStore) PermanentDeleteAll() error {
	defer doClearCacheCluster(s.rootStore.cluster, s.rootStore.schemeCache)
	defer doClearCacheCluster(s.rootStore.cluster, s.rootStore.roleCache)
	defer doClearCacheCluster(s.rootStore.cluster, s.rootStore.rolePermissionsCache)
	return s.SchemeStore.PermanentDeleteAll()
}
