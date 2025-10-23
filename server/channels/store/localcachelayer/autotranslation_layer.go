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
func channelAutoTranslationKey(channelID string) string {
	return fmt.Sprintf("channel:%s", channelID)
}

func userAutoTranslationKey(userID, channelID string) string {
	return fmt.Sprintf("user:%s:%s", userID, channelID)
}

func userLanguageKey(userID, channelID string) string {
	return fmt.Sprintf("lang:%s:%s", userID, channelID)
}

func activeDestinationLanguagesKey(channelID string) string {
	return fmt.Sprintf("active:%s", channelID)
}

// Cluster invalidation handlers
func (s *LocalCacheAutoTranslationStore) handleClusterInvalidateChannelAutoTranslation(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.channelAutoTranslationCache.Purge()
	} else {
		s.rootStore.channelAutoTranslationCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheAutoTranslationStore) handleClusterInvalidateUserAutoTranslation(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.userAutoTranslationCache.Purge()
	} else {
		s.rootStore.userAutoTranslationCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheAutoTranslationStore) handleClusterInvalidateActiveDestLangs(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.activeDestinationLanguagesCache.Purge()
	} else {
		s.rootStore.activeDestinationLanguagesCache.Remove(string(msg.Data))
	}
}

// ClearCaches purges all auto-translation caches
func (s LocalCacheAutoTranslationStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.channelAutoTranslationCache)
	s.rootStore.doClearCacheCluster(s.rootStore.userAutoTranslationCache)
	s.rootStore.doClearCacheCluster(s.rootStore.activeDestinationLanguagesCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.channelAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.activeDestinationLanguagesCache.Name())
	}
}

// IsChannelEnabled checks if auto-translation is enabled for a channel (with caching)
func (s LocalCacheAutoTranslationStore) IsChannelEnabled(channelID string) (bool, *model.AppError) {
	key := channelAutoTranslationKey(channelID)

	var enabled bool
	if err := s.rootStore.doStandardReadCache(s.rootStore.channelAutoTranslationCache, key, &enabled); err == nil {
		return enabled, nil
	}

	enabled, appErr := s.AutoTranslationStore.IsChannelEnabled(channelID)
	if appErr != nil {
		return false, appErr
	}

	s.rootStore.doStandardAddToCache(s.rootStore.channelAutoTranslationCache, key, enabled)
	return enabled, nil
}

// SetChannelEnabled sets auto-translation status for a channel and invalidates cache
func (s LocalCacheAutoTranslationStore) SetChannelEnabled(channelID string, enabled bool) *model.AppError {
	appErr := s.AutoTranslationStore.SetChannelEnabled(channelID, enabled)
	if appErr != nil {
		return appErr
	}

	// Invalidate channel cache
	key := channelAutoTranslationKey(channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.channelAutoTranslationCache, key, nil)

	// Invalidate active destination languages cache for this channel
	activeLangsKey := activeDestinationLanguagesKey(channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.activeDestinationLanguagesCache, activeLangsKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.channelAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.activeDestinationLanguagesCache.Name())
	}

	return nil
}

// IsUserEnabled checks if auto-translation is enabled for a user in a channel (with caching)
func (s LocalCacheAutoTranslationStore) IsUserEnabled(userID, channelID string) (bool, *model.AppError) {
	key := userAutoTranslationKey(userID, channelID)

	var enabled bool
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAutoTranslationCache, key, &enabled); err == nil {
		return enabled, nil
	}

	enabled, appErr := s.AutoTranslationStore.IsUserEnabled(userID, channelID)
	if appErr != nil {
		return false, appErr
	}

	s.rootStore.doStandardAddToCache(s.rootStore.userAutoTranslationCache, key, enabled)
	return enabled, nil
}

// SetUserEnabled sets auto-translation status for a user in a channel and invalidates cache
func (s LocalCacheAutoTranslationStore) SetUserEnabled(userID, channelID string, enabled bool) *model.AppError {
	appErr := s.AutoTranslationStore.SetUserEnabled(userID, channelID, enabled)
	if appErr != nil {
		return appErr
	}

	// Invalidate user auto-translation cache
	userKey := userAutoTranslationKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, userKey, nil)

	// Invalidate user language cache
	langKey := userLanguageKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, langKey, nil)

	// Invalidate active destination languages cache for this channel
	activeLangsKey := activeDestinationLanguagesKey(channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.activeDestinationLanguagesCache, activeLangsKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.activeDestinationLanguagesCache.Name())
	}

	return nil
}

// GetUserLanguage gets the user's language preference for a channel (with caching)
func (s LocalCacheAutoTranslationStore) GetUserLanguage(userID, channelID string) (string, *model.AppError) {
	key := userLanguageKey(userID, channelID)

	var language string
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAutoTranslationCache, key, &language); err == nil {
		return language, nil
	}

	language, appErr := s.AutoTranslationStore.GetUserLanguage(userID, channelID)
	if appErr != nil {
		return "", appErr
	}

	// Only cache non-empty results
	if language != "" {
		s.rootStore.doStandardAddToCache(s.rootStore.userAutoTranslationCache, key, language)
	}

	return language, nil
}

// GetActiveDestinationLanguages gets distinct locales of users with auto-translation enabled (with caching)
// Only caches when filterUserIDs is nil (the most common case)
func (s LocalCacheAutoTranslationStore) GetActiveDestinationLanguages(channelID, excludeUserID string, filterUserIDs *[]string) ([]string, *model.AppError) {
	// Only cache when filterUserIDs is nil (most common case)
	if filterUserIDs == nil && excludeUserID == "" {
		key := activeDestinationLanguagesKey(channelID)

		var languages []string
		if err := s.rootStore.doStandardReadCache(s.rootStore.activeDestinationLanguagesCache, key, &languages); err == nil {
			return languages, nil
		}

		languages, appErr := s.AutoTranslationStore.GetActiveDestinationLanguages(channelID, excludeUserID, filterUserIDs)
		if appErr != nil {
			return nil, appErr
		}

		s.rootStore.doStandardAddToCache(s.rootStore.activeDestinationLanguagesCache, key, languages)
		return languages, nil
	}

	// For complex queries with filters, bypass cache
	return s.AutoTranslationStore.GetActiveDestinationLanguages(channelID, excludeUserID, filterUserIDs)
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

	// Invalidate active destination languages cache for this channel
	activeLangsKey := activeDestinationLanguagesKey(channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.activeDestinationLanguagesCache, activeLangsKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.activeDestinationLanguagesCache.Name())
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
