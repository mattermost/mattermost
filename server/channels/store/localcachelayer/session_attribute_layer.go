// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type sessionAttributeEntry struct {
	Attrs map[string]any
}

type LocalCacheSessionAttributeStore struct {
	store.SessionAttributeStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheSessionAttributeStore) handleClusterInvalidateSessionAttributes(_ *model.ClusterMessage) {
	if err := s.rootStore.sessionAttributeCache.Purge(); err != nil {
		s.rootStore.logger.Warn("failed to purge session attribute cache", mlog.Err(err))
	}
}

func (s *LocalCacheSessionAttributeStore) Refresh(sessionID string, attrs map[string]any) error {
	if err := s.rootStore.sessionAttributeCache.SetWithDefaultExpiry(sessionID, &sessionAttributeEntry{Attrs: attrs}); err != nil {
		s.rootStore.logger.Warn("failed to set session attribute cache", mlog.Err(err))
		return err
	}
	return nil
}

func (s *LocalCacheSessionAttributeStore) Get(sessionID string) (map[string]any, error) {
	var entry *sessionAttributeEntry
	if err := s.rootStore.sessionAttributeCache.Get(sessionID, &entry); err != nil {
		return nil, err
	}
	return entry.Attrs, nil
}
