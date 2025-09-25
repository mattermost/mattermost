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
	s.rootStore.contentFlaggingCache.Purge()
}

func (s LocalCacheContentFlaggingStore) ClearCaches() {
	if err := s.rootStore.contentFlaggingCache.Purge(); err != nil {
		s.rootStore.logger.Error("failed to purge content flagging cache", mlog.Err(err))
	}

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.contentFlaggingCache.Name())
	}
}

func (s LocalCacheContentFlaggingStore) GetReviewerSettings() (*model.ReviewSettingsRequest, error) {
	var reviewerSettings *model.ReviewSettingsRequest

	err := s.rootStore.doStandardReadCache(s.rootStore.contentFlaggingCache, CACHE_KEY_REVIEWER_SETTINGS, &reviewerSettings)
	if err == nil {
		return reviewerSettings, nil
	}

	reviewerSettings, err = s.ContentFlaggingStore.GetReviewerSettings()
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.contentFlaggingCache, CACHE_KEY_REVIEWER_SETTINGS, reviewerSettings)
	return reviewerSettings, nil
}
