// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const cacheKeyTrackedChannelIDs = "tracked_channel_ids"

// LocalCacheDeliveryTrackingStore caches the tracked-channel allow-list. Post delivery
// audit logging consults it once per unique channel per delivery, so it must never reach
// the database on that path.
type LocalCacheDeliveryTrackingStore struct {
	store.DeliveryTrackingStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheDeliveryTrackingStore) handleClusterInvalidateDeliveryTracking(msg *model.ClusterMessage) {
	if err := s.rootStore.deliveryTrackingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge delivery tracking cache", mlog.Err(err))
	}
}

func (s LocalCacheDeliveryTrackingStore) ClearCaches() {
	if err := s.rootStore.deliveryTrackingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge delivery tracking cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.deliveryTrackingCache.Name())
	}
}

func (s LocalCacheDeliveryTrackingStore) SaveTrackedChannelIDs(rctx request.CTX, channelIDs []string) error {
	if err := s.DeliveryTrackingStore.SaveTrackedChannelIDs(rctx, channelIDs); err != nil {
		return err
	}

	s.rootStore.doClearCacheCluster(s.rootStore.deliveryTrackingCache)
	return nil
}

func (s LocalCacheDeliveryTrackingStore) GetTrackedChannelIDs(rctx request.CTX) ([]string, error) {
	var channelIDs []string

	if err := s.rootStore.doStandardReadCache(s.rootStore.deliveryTrackingCache, cacheKeyTrackedChannelIDs, &channelIDs); err == nil {
		return channelIDs, nil
	}

	channelIDs, err := s.DeliveryTrackingStore.GetTrackedChannelIDs(rctx)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.deliveryTrackingCache, cacheKeyTrackedChannelIDs, channelIDs)
	return channelIDs, nil
}
