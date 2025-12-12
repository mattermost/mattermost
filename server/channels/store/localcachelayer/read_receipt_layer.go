// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"fmt"
	"slices"

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
	if err := s.rootStore.readReceiptPostReadersCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge read receipt post readers cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.readReceiptCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.readReceiptPostReadersCache.Name())
	}
}

func (s LocalCacheReadReceiptStore) InvalidateReadReceiptForPostsCache(postID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.readReceiptPostReadersCache, postID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.readReceiptPostReadersCache.Name())
	}
	if externalCache, ok := s.rootStore.readReceiptCache.(cache.ExternalCache); ok {
		// For redis, invalidate all keys with pattern "postID:*"
		s.rootStore.doInvalidateCacheCluster(externalCache, fmt.Sprintf("%s:*", postID), nil)
	} else {
		if err := s.rootStore.readReceiptCache.Purge(); err != nil {
			s.rootStore.logger.Error("failed to purge read receipt cache", mlog.Err(err))
			return
		}
	}
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.readReceiptCache.Name())
	}
}

func (s LocalCacheReadReceiptStore) Delete(rctx request.CTX, postID, userID string) error {
	defer func() {
		s.InvalidateReadReceiptForPostsCache(postID)
	}()
	return s.ReadReceiptStore.Delete(rctx, postID, userID)
}

func (s LocalCacheReadReceiptStore) DeleteByPost(rctx request.CTX, postID string) error {
	defer func(postID string) {
		s.InvalidateReadReceiptForPostsCache(postID)
	}(postID)

	return s.ReadReceiptStore.DeleteByPost(rctx, postID)
}

func (s LocalCacheReadReceiptStore) Save(rctx request.CTX, receipt *model.ReadReceipt) (*model.ReadReceipt, error) {
	defer func() {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", receipt.PostID, receipt.UserID), nil)
		s.rootStore.doInvalidateCacheCluster(s.rootStore.readReceiptPostReadersCache, receipt.PostID, nil)
	}()
	return s.ReadReceiptStore.Save(rctx, receipt)
}

func (s LocalCacheReadReceiptStore) Update(rctx request.CTX, receipt *model.ReadReceipt) (*model.ReadReceipt, error) {
	defer func() {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", receipt.PostID, receipt.UserID), nil)
	}()
	return s.ReadReceiptStore.Update(rctx, receipt)
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

	// Update post readers cache: add this userID to the list if not already present
	var existingUserIDs []string
	if err := s.rootStore.doStandardReadCache(s.rootStore.readReceiptPostReadersCache, postID, &existingUserIDs); err == nil {
		// Cache exists: check if userID is already in the list
		if !slices.Contains(existingUserIDs, userID) {
			// Add userID to the existing list
			existingUserIDs = append(existingUserIDs, userID)
			s.rootStore.doStandardAddToCache(s.rootStore.readReceiptPostReadersCache, postID, existingUserIDs)
		}
	} else {
		// Cache doesn't exist: create new entry with just this userID
		s.rootStore.doStandardAddToCache(s.rootStore.readReceiptPostReadersCache, postID, []string{userID})
	}

	return rr, nil
}

func (s LocalCacheReadReceiptStore) GetByPost(rctx request.CTX, postID string) ([]*model.ReadReceipt, error) {
	// Try to get cached user IDs for this post
	var cachedUserIDs []string
	if err := s.rootStore.doStandardReadCache(s.rootStore.readReceiptPostReadersCache, postID, &cachedUserIDs); err == nil {
		// Cache hit: reconstruct receipts from cached user IDs and individual receipt caches
		receipts := make([]*model.ReadReceipt, 0, len(cachedUserIDs))
		for _, userID := range cachedUserIDs {
			var expireAt int64
			if err := s.rootStore.doStandardReadCache(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", postID, userID), &expireAt); err == nil {
				receipts = append(receipts, &model.ReadReceipt{
					PostID:   postID,
					UserID:   userID,
					ExpireAt: expireAt,
				})
			}
		}
		// If we got all receipts from cache, return them
		if len(receipts) == len(cachedUserIDs) {
			return receipts, nil
		}
	}

	// Cache miss or partial cache: fetch from underlying store
	receipts, err := s.ReadReceiptStore.GetByPost(rctx, postID)
	if err != nil {
		return nil, err
	}

	// Cache the user IDs for this post
	userIDs := make([]string, len(receipts))
	for i, receipt := range receipts {
		userIDs[i] = receipt.UserID
		// Also ensure individual receipts are cached
		s.rootStore.doStandardAddToCache(s.rootStore.readReceiptCache, fmt.Sprintf("%s:%s", postID, receipt.UserID), receipt.ExpireAt)
	}
	s.rootStore.doStandardAddToCache(s.rootStore.readReceiptPostReadersCache, postID, userIDs)

	return receipts, nil
}
