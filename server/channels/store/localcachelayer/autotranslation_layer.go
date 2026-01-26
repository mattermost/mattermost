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

// Cluster invalidation handler
func (s *LocalCacheAutoTranslationStore) handleClusterInvalidateUserAutoTranslation(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.userAutoTranslationCache.Purge()
	} else {
		s.rootStore.userAutoTranslationCache.Remove(string(msg.Data))
	}
}

// ClearCaches purges all auto-translation caches
func (s LocalCacheAutoTranslationStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.userAutoTranslationCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
	}
}

// IsChannelEnabled checks if auto-translation is enabled for a channel
// Uses the existing Channel cache instead of maintaining a separate cache
func (s LocalCacheAutoTranslationStore) IsChannelEnabled(channelID string) (bool, *model.AppError) {
	// Get channel from cache (with DB fallback)
	channel, err := s.rootStore.Channel().Get(channelID, true)
	if err != nil {
		return false, model.NewAppError("LocalCacheAutoTranslationStore.IsChannelEnabled",
			"store.sql_autotranslation.is_channel_enabled.app_error", nil, err.Error(), 500)
	}

	return channel.AutoTranslation, nil
}

// SetChannelEnabled sets auto-translation status for a channel and invalidates Channel cache
func (s LocalCacheAutoTranslationStore) SetChannelEnabled(channelID string, enabled bool) *model.AppError {
	appErr := s.AutoTranslationStore.SetChannelEnabled(channelID, enabled)
	if appErr != nil {
		return appErr
	}

	// Invalidate the Channel cache since we modified channel.autotranslation
	s.rootStore.Channel().InvalidateChannel(channelID)

	return nil
}

// IsUserDisabled checks if auto-translation is disabled for a user in a channel (with caching)
func (s LocalCacheAutoTranslationStore) IsUserDisabled(userID, channelID string) (bool, *model.AppError) {
	key := userAutoTranslationKey(userID, channelID)

	var disabled bool
	if err := s.rootStore.doStandardReadCache(s.rootStore.userAutoTranslationCache, key, &disabled); err == nil {
		return disabled, nil
	}

	disabled, appErr := s.AutoTranslationStore.IsUserDisabled(userID, channelID)
	if appErr != nil {
		return true, appErr
	}

	s.rootStore.doStandardAddToCache(s.rootStore.userAutoTranslationCache, key, disabled)
	return disabled, nil
}

// SetUserDisabled sets auto-translation disabled status for a user in a channel and invalidates cache
func (s LocalCacheAutoTranslationStore) SetUserDisabled(userID, channelID string, disabled bool) *model.AppError {
	appErr := s.AutoTranslationStore.SetUserDisabled(userID, channelID, disabled)
	if appErr != nil {
		return appErr
	}

	// Invalidate user auto-translation cache
	userKey := userAutoTranslationKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, userKey, nil)

	// Invalidate user language cache (for safety, in case locale changed while disabled)
	langKey := userLanguageKey(userID, channelID)
	s.rootStore.doInvalidateCacheCluster(s.rootStore.userAutoTranslationCache, langKey, nil)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.userAutoTranslationCache.Name())
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
