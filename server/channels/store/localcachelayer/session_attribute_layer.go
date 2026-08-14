// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

type sessionAttributeEntry struct {
	Attrs      map[string]any
	Timestamps map[string]int64
}

type LocalCacheSessionAttributeStore struct {
	store.SessionAttributeStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheSessionAttributeStore) handleClusterInvalidateSessionAttributes(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		err := s.rootStore.sessionAttributeCache.Purge()
		if err != nil {
			s.rootStore.logger.Warn("Error while purging session attribute cache", mlog.Err(err))
		}
	} else {
		err := s.rootStore.sessionAttributeCache.Remove(string(msg.Data))
		if err != nil {
			s.rootStore.logger.Warn("Error while removing session attribute cache", mlog.Err(err))
		}
	}
}

func (s *LocalCacheSessionAttributeStore) Refresh(sessionID string, attrs map[string]any, updatedAt int64) error {
	if len(attrs) == 0 {
		return nil
	}

	entry := &sessionAttributeEntry{
		Attrs:      make(map[string]any, len(attrs)),
		Timestamps: make(map[string]int64, len(attrs)),
	}

	var existing *sessionAttributeEntry
	if err := s.rootStore.doStandardReadCache(s.rootStore.sessionAttributeCache, sessionID, &existing); err == nil && existing != nil {
		maps.Copy(entry.Attrs, existing.Attrs)
		maps.Copy(entry.Timestamps, existing.Timestamps)
	}

	for key, value := range attrs {
		if entry.Timestamps[key] > updatedAt {
			continue
		}
		entry.Attrs[key] = value
		entry.Timestamps[key] = updatedAt
	}

	s.rootStore.doStandardAddToCache(s.rootStore.sessionAttributeCache, sessionID, entry)

	return nil
}

func (s *LocalCacheSessionAttributeStore) Invalidate(sessionID string) error {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.sessionAttributeCache, sessionID, nil)
	return nil
}

func (s *LocalCacheSessionAttributeStore) Clear() error {
	s.rootStore.doClearCacheCluster(s.rootStore.sessionAttributeCache)
	return nil
}

func (s *LocalCacheSessionAttributeStore) Get(sessionID string) (map[string]any, map[string]int64, error) {
	var entry *sessionAttributeEntry
	if err := s.rootStore.doStandardReadCache(s.rootStore.sessionAttributeCache, sessionID, &entry); err != nil {
		return nil, nil, err
	}
	if entry == nil {
		return nil, nil, cache.ErrKeyNotFound
	}

	return entry.Attrs, entry.Timestamps, nil
}
