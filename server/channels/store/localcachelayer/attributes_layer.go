// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"maps"

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

// Keyed by user ID, so the ABAC-aware post-list ETag doesn't hit PropertyValues on every post GET.
// The App layer invalidates the key on property-value writes.
func (s LocalCacheAttributesStore) GetUserPropertyValuesEpoch(rctx request.CTX, userID string) (string, error) {
	var epoch string
	if err := s.rootStore.doStandardReadCache(s.rootStore.userPropertyValuesEpochCache, userID, &epoch); err == nil {
		return epoch, nil
	}

	epoch, err := s.AttributesStore.GetUserPropertyValuesEpoch(rctx, userID)
	if err != nil {
		return "", err
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

func (s *LocalCacheAttributesStore) handleClusterInvalidateUserAttributes(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.userAttributesCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge user attributes cache", mlog.Err(err))
		}
	} else if err := s.rootStore.userAttributesCache.Remove(string(msg.Data)); err != nil {
		s.rootStore.logger.Warn("failed to remove user attributes cache entry", mlog.Err(err))
	}
}

// GetSubject caches the user's custom-profile-attributes Subject, keyed by user ID. Every
// user-subject read uses the single AccessControl property group (see BuildAccessControlSubject
// in app), so the group ID does not need to be part of the key. Only the user object type is
// cached; a channel-type lookup passes straight through. A not-found result is not cached, so a
// user with no attributes yet is re-queried on each call until a value exists.
func (s LocalCacheAttributesStore) GetSubject(rctx request.CTX, ID, groupID, objectType string) (*model.Subject, error) {
	if objectType != model.PropertyFieldObjectTypeUser {
		return s.AttributesStore.GetSubject(rctx, ID, groupID, objectType)
	}

	var cached model.Subject
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAttributesCache, ID, &cached); err == nil {
		// Clone so the caller cannot mutate the shared cached copy.
		cached.Attributes = maps.Clone(cached.Attributes)
		return &cached, nil
	}

	subject, err := s.AttributesStore.GetSubject(rctx, ID, groupID, objectType)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.userAttributesCache, ID, subject)
	return subject, nil
}

func (s LocalCacheAttributesStore) InvalidateUserAttributes(userID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAttributesCache, userID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAttributesCache.Name())
	}
}

func (s LocalCacheAttributesStore) ClearUserAttributesCache() {
	s.rootStore.doClearCacheCluster(s.rootStore.userAttributesCache)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAttributesCache.Name())
	}
}
