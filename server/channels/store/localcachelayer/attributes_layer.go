// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"errors"
	"maps"
	"sync/atomic"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type userAttributesCacheState struct {
	invalidatedHook atomic.Pointer[func()]
	// Bumped before every drop of user attributes entries, so a read that started earlier knows
	// its result may predate the drop and must not be cached.
	generation atomic.Uint64
}

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
	if hook := s.rootStore.userAttributes.invalidatedHook.Load(); hook != nil {
		(*hook)()
	}

	s.rootStore.userAttributes.generation.Add(1)
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
// cached; a channel-type lookup passes straight through. A user with no attributes is cached as an
// empty subject rather than returning not-found.
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

	generation := s.rootStore.userAttributes.generation.Load()
	subject, err := s.AttributesStore.GetSubject(rctx, ID, groupID, objectType)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); !ok {
			return nil, err
		}
		subject = &model.Subject{ID: ID, Type: objectType, Attributes: map[string]any{}}
	}

	// A drop that lands during the read may have removed the entry this result would replace.
	// Checking again after the add covers a drop that lands between the check and the add.
	if s.rootStore.userAttributes.generation.Load() != generation {
		return subject, nil
	}
	s.rootStore.doStandardAddToCache(s.rootStore.userAttributesCache, ID, subject)
	if s.rootStore.userAttributes.generation.Load() != generation {
		if err := s.rootStore.userAttributesCache.Remove(ID); err != nil {
			s.rootStore.logger.Warn("failed to remove user attributes cache entry", mlog.Err(err))
		}
	}
	return subject, nil
}

func (s LocalCacheAttributesStore) InvalidateUserAttributes(userID string) {
	s.rootStore.userAttributes.generation.Add(1)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAttributesCache, userID, nil)
	s.notifyPeersOfSharedCacheInvalidation([]byte(userID))
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAttributesCache.Name())
	}
}

func (s LocalCacheAttributesStore) ClearUserAttributesCache() {
	s.rootStore.userAttributes.generation.Add(1)
	s.rootStore.doClearCacheCluster(s.rootStore.userAttributesCache)
	s.notifyPeersOfSharedCacheInvalidation(clearCacheMessageData)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAttributesCache.Name())
	}
}

// A shared cache sends no invalidation message of its own, but peers still need one: it marks
// their attribute view stale, and removing the shared entry again drops anything a peer re-filled
// from that view before the message reached it.
func (s LocalCacheAttributesStore) notifyPeersOfSharedCacheInvalidation(data []byte) {
	if s.rootStore.cluster == nil || s.rootStore.userAttributesCache.GetInvalidateClusterEvent() != model.ClusterEventNone {
		return
	}
	s.rootStore.cluster.SendClusterMessage(&model.ClusterMessage{
		Event:    model.ClusterEventInvalidateCacheForUserAttributes,
		SendType: model.ClusterSendBestEffort,
		Data:     data,
	})
}
