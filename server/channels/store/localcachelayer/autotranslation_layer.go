// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheAutoTranslationStore struct {
	store.AutoTranslationStore
	rootStore *LocalCacheStore
}

// Cache key generators
func userAutoTranslationKey(userID, channelID string) string {
	return fmt.Sprintf("user:%s:%s", userID, channelID)
}

func userLanguageKey(userID, channelID string) string {
	return fmt.Sprintf("lang:%s:%s", userID, channelID)
}

func postTranslationEtagKey(channelID string) string {
	return fmt.Sprintf("etag:%s", channelID)
}

// Cluster invalidation handler for user auto-translation cache
func (s *LocalCacheAutoTranslationStore) handleClusterInvalidateUserAutoTranslation(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.userAutoTranslationCache.Purge()
	} else {
		s.rootStore.userAutoTranslationCache.Remove(string(msg.Data))
	}
}

// Cluster invalidation handler for post translation etag cache
func (s *LocalCacheAutoTranslationStore) handleClusterInvalidatePostTranslationEtag(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.postTranslationEtagCache.Purge()
	} else {
		s.rootStore.postTranslationEtagCache.Remove(string(msg.Data))
	}
}

// ClearCaches purges all auto-translation caches
func (s LocalCacheAutoTranslationStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.userAutoTranslationCache)
	s.rootStore.doClearCacheCluster(s.rootStore.postTranslationEtagCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.postTranslationEtagCache.Name())
	}
}

// IsUserEnabled checks if auto-translation is enabled for a user in a channel (with caching)
func (s LocalCacheAutoTranslationStore) IsUserEnabled(userID, channelID string) (bool, error) {
	key := userAutoTranslationKey(userID, channelID)

	var enabled bool
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAutoTranslationCache, key, &enabled); err == nil {
		return enabled, nil
	}

	enabled, err := s.AutoTranslationStore.IsUserEnabled(userID, channelID)
	if err != nil {
		return false, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.userAutoTranslationCache, key, enabled)
	return enabled, nil
}

// GetUserLanguage gets the user's language preference for a channel (with caching)
func (s LocalCacheAutoTranslationStore) GetUserLanguage(userID, channelID string) (string, error) {
	key := userLanguageKey(userID, channelID)

	var language string
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAutoTranslationCache, key, &language); err == nil {
		return language, nil
	}

	language, err := s.AutoTranslationStore.GetUserLanguage(userID, channelID)
	if err != nil {
		return "", err
	}

	// Only cache non-empty results
	if language != "" {
		s.rootStore.doStandardAddToCache(s.rootStore.userAutoTranslationCache, key, language)
	}

	return language, nil
}

// InvalidateUserAutoTranslation invalidates all user auto-translation caches for a specific user+channel
// This should be called when a user is removed from a channel
func (s LocalCacheAutoTranslationStore) InvalidateUserAutoTranslation(userID, channelID string) {
	// Invalidate user auto-translation enabled cache
	userKey := userAutoTranslationKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, userKey, nil)

	// Invalidate user language cache
	langKey := userLanguageKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, langKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
	}
}

// InvalidateUserLocaleCache invalidates all language caches for a user across all channels
// This should be called when a user changes their locale
func (s LocalCacheAutoTranslationStore) InvalidateUserLocaleCache(userID string) {
	// Scan the cache and find all keys that match "lang:{userID}:*"
	prefix := fmt.Sprintf("lang:%s:", userID)
	var toDelete []string

	err := s.rootStore.userAutoTranslationCache.Scan(func(keys []string) error {
		for _, key := range keys {
			if len(key) > len(prefix) && key[:len(prefix)] == prefix {
				toDelete = append(toDelete, key)
			}
		}
		return nil
	})

	if err != nil {
		// If scan fails, just purge the entire cache as fallback
		s.rootStore.doClearCacheCluster(s.rootStore.userAutoTranslationCache)
		if s.rootStore.metrics != nil {
			s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
		}
		return
	}

	// Invalidate all matching keys
	for _, key := range toDelete {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, key, nil)
	}

	if s.rootStore.metrics != nil && len(toDelete) > 0 {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
	}
}

// GetLatestPostUpdateAtForChannel returns the most recent updateAt timestamp for post translations
// in the given channel (across all locales, with caching)
func (s LocalCacheAutoTranslationStore) GetLatestPostUpdateAtForChannel(channelID string) (int64, error) {
	key := postTranslationEtagKey(channelID)

	var updateAt int64
	if err := s.rootStore.doStandardReadCache(s.rootStore.postTranslationEtagCache, key, &updateAt); err == nil {
		return updateAt, nil
	}

	updateAt, err := s.AutoTranslationStore.GetLatestPostUpdateAtForChannel(channelID)
	if err != nil {
		return 0, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.postTranslationEtagCache, key, updateAt)
	return updateAt, nil
}

// InvalidatePostTranslationEtag invalidates the cached post translation etag for a channel
// This should be called after saving a new post translation
func (s LocalCacheAutoTranslationStore) InvalidatePostTranslationEtag(channelID string) {
	key := postTranslationEtagKey(channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.postTranslationEtagCache, key, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.postTranslationEtagCache.Name())
	}
}

// Save wraps the underlying Save and invalidates the post translation etag cache for post translations
func (s LocalCacheAutoTranslationStore) Save(translation *model.Translation) error {
	err := s.AutoTranslationStore.Save(translation)
	if err != nil {
		return err
	}

	// Invalidate post translation etag cache only for post translations
	if translation.ChannelID != "" && translation.ObjectType == model.TranslationObjectTypePost {
		s.InvalidatePostTranslationEtag(translation.ChannelID)
	}

	return nil
}
