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

type LocalCacheAccessControlPolicyStore struct {
	store.AccessControlPolicyStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheAccessControlPolicyStore) handleClusterInvalidateAccessControlPolicyEtag(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.accessControlPolicyEtagCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge access control policy etag cache", mlog.Err(err))
		}
	} else if err := s.rootStore.accessControlPolicyEtagCache.Remove(string(msg.Data)); err != nil {
		s.rootStore.logger.Warn("failed to remove access control policy etag cache entry", mlog.Err(err))
	}
}

// GetEtagEpoch caches the per-channel render-ETag epoch. The cache key is the channel ID
// (empty string is the system-scoped-only bucket). Because every channel's epoch also folds in
// the system-scoped permission policies, a permission-policy change must clear the whole cache
// via ClearEtagCache, while a single channel's change only invalidates that channel's key.
func (s LocalCacheAccessControlPolicyStore) GetEtagEpoch(rctx request.CTX, channelID string) (string, error) {
	var epoch string
	if err := s.rootStore.doStandardReadCache(s.rootStore.accessControlPolicyEtagCache, channelID, &epoch); err == nil {
		return epoch, nil
	}

	epoch, err := s.AccessControlPolicyStore.GetEtagEpoch(rctx, channelID)
	if err != nil {
		return "", err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.accessControlPolicyEtagCache, channelID, epoch)
	return epoch, nil
}

func (s LocalCacheAccessControlPolicyStore) InvalidateEtagForChannel(channelID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.accessControlPolicyEtagCache, channelID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.accessControlPolicyEtagCache.Name())
	}
}

func (s LocalCacheAccessControlPolicyStore) ClearEtagCache() {
	s.rootStore.doClearCacheCluster(s.rootStore.accessControlPolicyEtagCache)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.accessControlPolicyEtagCache.Name())
	}
}
