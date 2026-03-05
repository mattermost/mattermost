// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	CACHE_KEY_REVIEWER_SETTINGS = "reviewer_settings"
)

type LocalCacheContentFlaggingStore struct {
	store.ContentFlaggingStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheContentFlaggingStore) handleClusterInvalidateContentFlagging(msg *model.ClusterMessage) {
	if err := s.rootStore.contentFlaggingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge content flagging cache", mlog.Err(err))
	}
}

func (s LocalCacheContentFlaggingStore) ClearCaches() {
	if err := s.rootStore.contentFlaggingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge content flagging cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.contentFlaggingCache.Name())
	}
}

func (s LocalCacheContentFlaggingStore) GetReviewerSettings() (*model.ReviewerIDsSettings, error) {
	var reviewerSettings *model.ReviewerIDsSettings

	err := s.rootStore.doStandardReadCache(s.rootStore.contentFlaggingCache, CACHE_KEY_REVIEWER_SETTINGS, &reviewerSettings)
	if err == nil {
		return reviewerSettings, nil
	}

	reviewerSettings, err = s.ContentFlaggingStore.GetReviewerSettings()
	if err != nil {
		return nil, err
	}

	if reviewerSettings != nil {
		s.rootStore.doStandardAddToCache(s.rootStore.contentFlaggingCache, CACHE_KEY_REVIEWER_SETTINGS, reviewerSettings)
	}
	return reviewerSettings, nil
}
