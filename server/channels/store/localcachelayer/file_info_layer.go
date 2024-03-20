// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheFileInfoStore struct {
	store.FileInfoStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheFileInfoStore) handleClusterInvalidateFileInfo(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.fileInfoCache.Purge()
		return
	}
	s.rootStore.fileInfoCache.Remove(string(msg.Data))
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
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.fileInfoCache.Name())
	}
}

func (s LocalCacheFileInfoStore) InvalidateFileInfosForPostCache(postId string, deleted bool) {
	cacheKey := postId
	if deleted {
		cacheKey += "_deleted"
	}
	s.rootStore.doInvalidateCacheCluster(s.rootStore.fileInfoCache, cacheKey, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.fileInfoCache.Name())
	}
}

func (s LocalCacheFileInfoStore) GetStorageUsage(allowFromCache, includeDeleted bool) (int64, error) {
	storageUsageKey := "storage_usage"
	if includeDeleted {
		storageUsageKey += "_deleted"
	}

	if !allowFromCache {
		usage, err := s.FileInfoStore.GetStorageUsage(allowFromCache, includeDeleted)
		if err != nil {
			return 0, err
		}

		s.rootStore.doStandardAddToCache(s.rootStore.fileInfoCache, storageUsageKey, usage)
		return usage, nil
	}

	var usage int64
	if err := s.rootStore.doStandardReadCache(s.rootStore.fileInfoCache, storageUsageKey, &usage); err == nil {
		return usage, nil
	}

	usage, err := s.FileInfoStore.GetStorageUsage(allowFromCache, includeDeleted)
	if err != nil {
		return 0, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.fileInfoCache, storageUsageKey, usage)
	return usage, nil
}
