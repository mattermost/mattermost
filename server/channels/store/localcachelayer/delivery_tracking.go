// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"errors"

	lru "github.com/hashicorp/golang-lru/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const cacheKeyTrackedChannelIDs = "tracked_channel_ids"

// LocalCacheDeliveryTrackingStore memoizes the per-channel eligibility answers that post
// delivery audit logging consults once per recorded delivery.
//
// The two channel caches hold plain bools rather than going through cache.Cache, which
// marshals to msgpack on write and unmarshals on every read. On this path that would allocate
// per record. They are populated lazily as channel ids are seen, so there is no startup load
// and a failed read only affects the channel that triggered it.
type LocalCacheDeliveryTrackingStore struct {
	store.DeliveryTrackingStore
	rootStore *LocalCacheStore

	// trackedChannels memoizes explicit allow-list membership, which changes only when an
	// admin saves the list.
	trackedChannels *lru.Cache[string, bool]

	// trackableChannels memoizes whether a channel is neither a DM nor a GM. Channel types are
	// mutable (ConvertGroupMessageToChannel rewrites one in place), so entries are dropped
	// alongside channelByIdCache — see LocalCacheChannelStore.InvalidateChannel.
	trackableChannels *lru.Cache[string, bool]
}

func (s *LocalCacheDeliveryTrackingStore) handleClusterInvalidateDeliveryTracking(msg *model.ClusterMessage) {
	s.purge()
}

func (s *LocalCacheDeliveryTrackingStore) ClearCaches() {
	s.purge()
	s.purgeChannels()

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.deliveryTrackingCache.Name())
	}
}

func (s *LocalCacheDeliveryTrackingStore) purge() {
	if err := s.rootStore.deliveryTrackingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge delivery tracking cache", mlog.Err(err))
	}
	s.trackedChannels.Purge()
}

func (s *LocalCacheDeliveryTrackingStore) SaveTrackedChannelIDs(rctx request.CTX, channelIDs []string) error {
	if err := s.DeliveryTrackingStore.SaveTrackedChannelIDs(rctx, channelIDs); err != nil {
		return err
	}

	s.purge()
	s.rootStore.doClearCacheCluster(s.rootStore.deliveryTrackingCache)
	return nil
}

func (s *LocalCacheDeliveryTrackingStore) GetTrackedChannelIDs(rctx request.CTX) ([]string, error) {
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

func (s *LocalCacheDeliveryTrackingStore) IsChannelTracked(rctx request.CTX, channelID string) (bool, error) {
	if cached, ok := s.trackedChannels.Get(channelID); ok {
		return cached, nil
	}

	tracked, err := s.DeliveryTrackingStore.IsChannelTracked(rctx, channelID)
	if err != nil {
		return false, err
	}

	s.trackedChannels.Add(channelID, tracked)
	return tracked, nil
}

func (s *LocalCacheDeliveryTrackingStore) IsChannelTrackable(rctx request.CTX, channelID string) (bool, error) {
	if cached, ok := s.trackableChannels.Get(channelID); ok {
		return cached, nil
	}

	channel, err := s.rootStore.Channel().Get(channelID, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return false, err
		}

		// Not cached: a channel missing now — replica lag, or a type this store does not
		// return — may resolve on a later read, and caching would exclude it permanently.
		return false, nil
	}

	trackable := !channel.IsGroupOrDirect()
	s.trackableChannels.Add(channelID, trackable)
	return trackable, nil
}

// invalidateChannel and purgeChannels are called from the channel store, which is built before
// this one, so they tolerate a nil receiver.
func (s *LocalCacheDeliveryTrackingStore) invalidateChannel(channelID string) {
	if s == nil {
		return
	}
	s.trackableChannels.Remove(channelID)
}

func (s *LocalCacheDeliveryTrackingStore) purgeChannels() {
	if s == nil {
		return
	}
	s.trackableChannels.Purge()
}
