// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"

	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheTemporaryPostStore struct {
	store.TemporaryPostStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheTemporaryPostStore) handleClusterInvalidateTemporaryPosts(msg *model.ClusterMessage) {
	if err := s.rootStore.temporaryPostCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge temporary post cache", mlog.Err(err))
	}
}

func (s LocalCacheTemporaryPostStore) ClearCaches() {
	if err := s.rootStore.temporaryPostCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge temporary post cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.temporaryPostCache.Name())
	}
}

func (s LocalCacheTemporaryPostStore) InvalidateTemporaryPost(id string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.temporaryPostCache, id, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.temporaryPostCache.Name())
	}
}

func (s LocalCacheTemporaryPostStore) Get(rctx request.CTX, id string) (*model.TemporaryPost, error) {
	var post *model.TemporaryPost
	if err := s.rootStore.doStandardReadCache(s.rootStore.temporaryPostCache, id, &post); err == nil {
		return post, nil
	}

	post, err := s.TemporaryPostStore.Get(rctx, id)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.temporaryPostCache, id, post)
	return post, nil
}

func (s LocalCacheTemporaryPostStore) Delete(rctx request.CTX, id string) error {
	defer s.InvalidateTemporaryPost(id)
	return s.TemporaryPostStore.Delete(rctx, id)
}
