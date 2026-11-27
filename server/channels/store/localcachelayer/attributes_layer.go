// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"errors"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
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

func (s *LocalCacheAttributesStore) handleClusterInvalidateChannelAttributes(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.channelAttributesCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge channel attributes cache", mlog.Err(err))
		}
	} else if err := s.rootStore.channelAttributesCache.Remove(string(msg.Data)); err != nil {
		s.rootStore.logger.Warn("failed to remove channel attributes cache entry", mlog.Err(err))
	}
}

// subjectCache returns the cache for an object type's subjects, or nil for a type that isn't
// cached.
func (s LocalCacheAttributesStore) subjectCache(objectType string) cache.Cache {
	switch objectType {
	case model.PropertyFieldObjectTypeUser:
		return s.rootStore.userAttributesCache
	case model.PropertyFieldObjectTypeChannel:
		return s.rootStore.channelAttributesCache
	default:
		return nil
	}
}

// GetSubject caches a user's or a channel's custom-profile-attributes Subject, keyed by its ID,
// one cache per object type. Every subject read uses the single AccessControl property group
// (see BuildAccessControlSubject in app, and the enterprise resource-attribute lookup), so the
// group ID does not need to be part of the key. Any other object type passes straight through.
// A subject with no attributes is cached as an empty subject rather than returning not-found.
func (s LocalCacheAttributesStore) GetSubject(rctx request.CTX, ID, groupID, objectType string) (*model.Subject, error) {
	subjects := s.subjectCache(objectType)
	if subjects == nil {
		return s.AttributesStore.GetSubject(rctx, ID, groupID, objectType)
	}

	var cached model.Subject
	if err := s.rootStore.doStandardReadCache(subjects, ID, &cached); err == nil {
		// Clone so the caller cannot mutate the shared cached copy.
		cached.Attributes = maps.Clone(cached.Attributes)
		return &cached, nil
	}

	subject, err := s.AttributesStore.GetSubject(rctx, ID, groupID, objectType)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); !ok {
			return nil, err
		}
		subject = &model.Subject{ID: ID, Type: objectType, Attributes: map[string]any{}}
	}

	s.rootStore.doStandardAddToCache(subjects, ID, subject)
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

// RemoveUserAttributesLocal drops the given users' cached subjects on this node only, for a peer's
// attribute write whose own best-effort eviction may arrive after its decision invalidation.
func (s LocalCacheStore) RemoveUserAttributesLocal(userIDs []string) {
	if len(userIDs) == 0 {
		return
	}
	if err := s.userAttributesCache.RemoveMulti(userIDs); err != nil {
		s.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", s.userAttributesCache.Name()))
	}
}

// PurgeUserAttributesLocal is RemoveUserAttributesLocal for every user.
func (s LocalCacheStore) PurgeUserAttributesLocal() {
	if err := s.userAttributesCache.Purge(); err != nil {
		s.logger.Warn("Error while purging cache", mlog.Err(err), mlog.String("cache_name", s.userAttributesCache.Name()))
	}
}

func (s LocalCacheAttributesStore) InvalidateChannelAttributes(channelID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelAttributesCache, channelID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.channelAttributesCache.Name())
	}
}

func (s LocalCacheAttributesStore) ClearChannelAttributesCache() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelAttributesCache)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.channelAttributesCache.Name())
	}
}

// RemoveChannelAttributesLocal drops the given channels' cached subjects on this node only, for a
// peer's attribute write whose own best-effort eviction may arrive after its decision
// invalidation.
func (s LocalCacheStore) RemoveChannelAttributesLocal(channelIDs []string) {
	if len(channelIDs) == 0 {
		return
	}
	if err := s.channelAttributesCache.RemoveMulti(channelIDs); err != nil {
		s.logger.Warn("Error while removing cache entry", mlog.Err(err), mlog.String("cache_name", s.channelAttributesCache.Name()))
	}
}

// PurgeChannelAttributesLocal is RemoveChannelAttributesLocal for every channel.
func (s LocalCacheStore) PurgeChannelAttributesLocal() {
	if err := s.channelAttributesCache.Purge(); err != nil {
		s.logger.Warn("Error while purging cache", mlog.Err(err), mlog.String("cache_name", s.channelAttributesCache.Name()))
	}
}
