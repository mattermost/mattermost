// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

type LocalCacheReadReceiptStore struct {
	store.ReadReceiptStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheReadReceiptStore) handleClusterInvalidateReadReceipts(msg *model.ClusterMessage) {
	if err := s.rootStore.readReceiptCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge read receipt cache", mlog.Err(err))
	}
}

func (s LocalCacheReadReceiptStore) ClearCaches() {
	if err := s.rootStore.readReceiptCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge read receipt cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.readReceiptCache.Name())
	}
}

func (s LocalCacheReadReceiptStore) Delete(rctx request.CTX, postID, userID string) error {
	defer s.rootStore.doInvalidateCacheCluster(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", postID, userID), nil)
	return s.ReadReceiptStore.Delete(rctx, postID, userID)
}

func (s LocalCacheReadReceiptStore) DeleteByPost(rctx request.CTX, postID string) error {
	defer func(postID string) {
		// For redis, invalidate all keys with pattern "postID:*"
		if externalCache, ok := s.rootStore.readReceiptCache.(cache.ExternalCache); ok {
			s.rootStore.doInvalidateCacheCluster(externalCache, fmt.Sprintf("%s:*", postID), nil)
		} else {
			// Ideally we should be able to purge by post "%s:*", something to consider in future
			s.ClearCaches()
		}
	}(postID)

	return s.ReadReceiptStore.DeleteByPost(rctx, postID)
}

func (s LocalCacheReadReceiptStore) Get(rctx request.CTX, postID, userID string) (*model.ReadReceipt, error) {
	// no need to store the entire struct in cache, just the expireAt would be sufficient
	// as other two fields are part of the cache key
	var expireAt int64
	if err := s.rootStore.doStandardReadCache(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", postID, userID), &expireAt); err == nil {
		return &model.ReadReceipt{
			PostID:   postID,
			UserID:   userID,
			ExpireAt: expireAt,
		}, nil
	}

	rr, err := s.ReadReceiptStore.Get(rctx, postID, userID)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", postID, userID), rr.ExpireAt)
	return rr, nil
}
