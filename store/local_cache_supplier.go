// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	REACTION_CACHE_SIZE = 20000
	REACTION_CACHE_SEC  = 1800 // 30 minutes

	CLEAR_CACHE_MESSAGE_DATA = ""
)

type LocalCacheSupplier struct {
	next          LayeredStoreSupplier
	reactionCache *utils.Cache
}

func NewLocalCacheSupplier() *LocalCacheSupplier {
	supplier := &LocalCacheSupplier{
		reactionCache: utils.NewLruWithParams(REACTION_CACHE_SIZE, "Reaction", REACTION_CACHE_SEC, model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS),
	}

	registerClusterHandlers(supplier)

	return supplier
}

func registerClusterHandlers(supplier *LocalCacheSupplier) {
	if cluster := einterfaces.GetClusterInterface(); cluster != nil {
		cluster.RegisterClusterMessageHandler(model.CLUSTER_EVENT_INVALIDATE_CACHE_FOR_REACTIONS, supplier.handleClusterInvalidateReaction)
	}
}

func (s *LocalCacheSupplier) SetChainNext(next LayeredStoreSupplier) {
	s.next = next
}

func (s *LocalCacheSupplier) Next() LayeredStoreSupplier {
	return s.next
}

func doStandardReadCache(ctx context.Context, cache utils.ObjectCache, key string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	metrics := einterfaces.GetMetricsInterface()

	if hintsContains(hints, LSH_NO_CACHE) {
		if metrics != nil {
			metrics.IncrementMemCacheMissCounter(cache.Name())
		}
		return nil
	}

	if cacheItem, ok := cache.Get(key); ok {
		if metrics != nil {
			metrics.IncrementMemCacheHitCounter(cache.Name())
		}
		result := NewSupplierResult()
		result.Data = cacheItem
		return result
	}

	if metrics != nil {
		metrics.IncrementMemCacheMissCounter(cache.Name())
	}

	return nil
}

func doStandardAddToCache(ctx context.Context, cache utils.ObjectCache, key string, result *LayeredStoreSupplierResult, hints ...LayeredStoreHint) {
	if result.Err == nil && result.Data != nil {
		cache.AddWithDefaultExpires(key, result.Data)
	}
}

func doInvalidateCacheCluster(cache utils.ObjectCache, key string) {
	cache.Remove(key)
	if einterfaces.GetClusterInterface() != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     key,
		}
		einterfaces.GetClusterInterface().SendClusterMessage(msg)
	}
}

func doClearCacheCluster(cache utils.ObjectCache) {
	cache.Purge()
	if einterfaces.GetClusterInterface() != nil {
		msg := &model.ClusterMessage{
			Event:    cache.GetInvalidateClusterEvent(),
			SendType: model.CLUSTER_SEND_BEST_EFFORT,
			Data:     CLEAR_CACHE_MESSAGE_DATA,
		}
		einterfaces.GetClusterInterface().SendClusterMessage(msg)
	}
}
