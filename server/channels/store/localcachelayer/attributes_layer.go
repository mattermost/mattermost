// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheAttributesStore struct {
	store.AttributesStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheAttributesStore) handleClusterInvalidateUserPropertyValuesEpoch(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.userPropertyValuesEpochCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge user property values epoch cache", mlog.Err(err))
		}
	} else if err := s.rootStore.userPropertyValuesEpochCache.Remove(string(msg.Data)); err != nil {
		s.rootStore.logger.Warn("failed to remove user property values epoch cache entry", mlog.Err(err))
	}
}

// GetUserPropertyValuesEpoch caches the per-user property-values epoch (keyed by user ID) so the
// ABAC-aware post-list ETag does not hit PropertyValues on every post GET. Property-value writes
// invalidate the affected user's key from the App layer via InvalidateUserPropertyValuesEpoch.
func (s LocalCacheAttributesStore) GetUserPropertyValuesEpoch(rctx request.CTX, userID string) (int64, error) {
	var epoch int64
	if err := s.rootStore.doStandardReadCache(s.rootStore.userPropertyValuesEpochCache, userID, &epoch); err == nil {
		return epoch, nil
	}

	epoch, err := s.AttributesStore.GetUserPropertyValuesEpoch(rctx, userID)
	if err != nil {
		return 0, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.userPropertyValuesEpochCache, userID, epoch)
	return epoch, nil
}

func (s LocalCacheAttributesStore) InvalidateUserPropertyValuesEpoch(userID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userPropertyValuesEpochCache, userID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userPropertyValuesEpochCache.Name())
	}
}

func (s LocalCacheAttributesStore) ClearUserPropertyValuesEpochCache() {
	s.rootStore.doClearCacheCluster(s.rootStore.userPropertyValuesEpochCache)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userPropertyValuesEpochCache.Name())
	}
}
