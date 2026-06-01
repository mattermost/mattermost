// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCachePropertyFieldStore struct {
	store.PropertyFieldStore
	rootStore *LocalCacheStore
}

func (s *LocalCachePropertyFieldStore) handleClusterInvalidatePropertyField(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.propertyFieldCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge property field cache", mlog.Err(err))
		}
	} else if err := s.rootStore.propertyFieldCache.Remove(string(msg.Data)); err != nil {
		s.rootStore.logger.Warn("failed to remove property field cache entry", mlog.Err(err))
	}
}

func (s LocalCachePropertyFieldStore) InvalidateFieldsForGroup(groupID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.propertyFieldCache, groupID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.propertyFieldCache.Name())
	}
}

func (s *LocalCachePropertyFieldStore) getFieldsForGroupFromCache(groupID string) ([]*model.PropertyField, bool) {
	var fields []*model.PropertyField
	if err := s.rootStore.doStandardReadCache(s.rootStore.propertyFieldCache, groupID, &fields); err == nil {
		return fields, true
	}
	return nil, false
}

func (s LocalCachePropertyFieldStore) GetForGroup(ctx context.Context, groupID string) ([]*model.PropertyField, error) {
	if fields, ok := s.getFieldsForGroupFromCache(groupID); ok {
		return fields, nil
	}

	fields, err := s.PropertyFieldStore.GetForGroup(ctx, groupID)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.propertyFieldCache, groupID, fields)
	return fields, nil
}
