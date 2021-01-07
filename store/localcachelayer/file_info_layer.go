// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheFileInfoStore struct {
	store.FileInfoStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheFileInfoStore) handleClusterInvalidateFileInfo(msg *model.ClusterMessage) {
	if msg.Data == ClearCacheMessageData {
		s.rootStore.fileInfoCache.Purge()
		return
	}
	s.rootStore.fileInfoCache.Remove(msg.Data)
}

func (s LocalCacheFileInfoStore) GetForPost(postId string, readFromMaster, includeDeleted, allowFromCache bool) ([]*model.FileInfo, error) {
	if !allowFromCache {
		return s.FileInfoStore.GetForPost(postId, readFromMaster, includeDeleted, allowFromCache)
	}

	cacheKey := postId
	if includeDeleted {
		cacheKey += "_deleted"
	}

	var fileInfo []*model.FileInfo
	if err := s.rootStore.doStandardReadCache(s.rootStore.fileInfoCache, cacheKey, &fileInfo); err == nil {
		return fileInfo, nil
	}

	fileInfos, err := s.FileInfoStore.GetForPost(postId, readFromMaster, includeDeleted, allowFromCache)
	if err != nil {
		return nil, err
	}

	if len(fileInfos) > 0 {
		s.rootStore.doStandardAddToCache(s.rootStore.fileInfoCache, cacheKey, fileInfos)
	}

	return fileInfos, nil
}

func (s LocalCacheFileInfoStore) ClearCaches() {
	s.rootStore.fileInfoCache.Purge()
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("File Info Cache - Purge")
	}
}

func (s LocalCacheFileInfoStore) InvalidateFileInfosForPostCache(postId string, deleted bool) {
	cacheKey := postId
	if deleted {
		cacheKey += "_deleted"
	}
	s.rootStore.doInvalidateCacheCluster(s.rootStore.fileInfoCache, cacheKey)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("File Info Cache - Remove by PostId")
	}
}
