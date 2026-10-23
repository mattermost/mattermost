// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"errors"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type LocalCacheBotEventSubscriptionStore struct {
	store.BotEventSubscriptionStore
	rootStore *LocalCacheStore
}

func (s LocalCacheBotEventSubscriptionStore) handleClusterInvalidateBotEventSubscription(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		_ = s.rootStore.botEventSubscriptionCache.Purge()
	} else {
		_ = s.rootStore.botEventSubscriptionCache.Remove(string(msg.Data))
	}
}

func (s LocalCacheBotEventSubscriptionStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.botEventSubscriptionCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.botEventSubscriptionCache.Name())
	}
}

func (s LocalCacheBotEventSubscriptionStore) invalidate(botUserID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.botEventSubscriptionCache, botUserID, nil)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.botEventSubscriptionCache.Name())
	}
}

// GetForBots caches lookups per bot, including bots without a subscription. The
// short negative TTL bounds the window in which a read racing a create can leave a
// stale "no subscription" entry behind.
func (s LocalCacheBotEventSubscriptionStore) GetForBots(rctx request.CTX, botUserIDs []string) ([]*model.BotEventSubscription, error) {
	ids := dedupeIDs(botUserIDs)
	subs := make([]*model.BotEventSubscription, 0, len(ids))
	if len(ids) == 0 {
		return subs, nil
	}

	toPass := allocateCacheTargets[model.BotEventSubscription](len(ids))
	errs := s.rootStore.doMultiReadCache(s.rootStore.botEventSubscriptionCache, ids, toPass)

	var missing []string
	for i, err := range errs {
		if err != nil {
			missing = append(missing, ids[i])
			continue
		}
		if sub := toPass[i].(*model.BotEventSubscription); sub.BotUserId != "" {
			subs = append(subs, sub)
		}
	}

	if len(missing) == 0 {
		return subs, nil
	}

	found, err := s.BotEventSubscriptionStore.GetForBots(rctx, missing)
	if err != nil {
		return nil, err
	}

	foundIDs := make(map[string]struct{}, len(found))
	for _, sub := range found {
		foundIDs[sub.BotUserId] = struct{}{}
		s.rootStore.doStandardAddToCache(s.rootStore.botEventSubscriptionCache, sub.BotUserId, sub)
		subs = append(subs, sub)
	}
	for _, id := range missing {
		if _, ok := foundIDs[id]; !ok {
			s.rootStore.doStandardAddToCacheWithExpiry(s.rootStore.botEventSubscriptionCache, id, &model.BotEventSubscription{}, BotEventSubscriptionNotFoundCacheSec*time.Second)
		}
	}

	return subs, nil
}

func (s LocalCacheBotEventSubscriptionStore) Save(rctx request.CTX, sub *model.BotEventSubscription) (*model.BotEventSubscription, error) {
	saved, err := s.BotEventSubscriptionStore.Save(rctx, sub)
	if err != nil {
		return nil, err
	}
	s.invalidate(saved.BotUserId)
	return saved, nil
}

func (s LocalCacheBotEventSubscriptionStore) Update(rctx request.CTX, sub *model.BotEventSubscription) (*model.BotEventSubscription, error) {
	updated, err := s.BotEventSubscriptionStore.Update(rctx, sub)
	if err != nil {
		return nil, err
	}
	s.invalidate(updated.BotUserId)
	return updated, nil
}

func (s LocalCacheBotEventSubscriptionStore) SetEnabled(rctx request.CTX, botUserID string, enabled bool, reason string, updateAt int64) error {
	if err := s.BotEventSubscriptionStore.SetEnabled(rctx, botUserID, enabled, reason, updateAt); err != nil {
		return err
	}
	s.invalidate(botUserID)
	return nil
}

func (s LocalCacheBotEventSubscriptionStore) Delete(rctx request.CTX, botUserID string) error {
	err := s.BotEventSubscriptionStore.Delete(rctx, botUserID)
	var nfErr *store.ErrNotFound
	if err == nil || errors.As(err, &nfErr) {
		s.invalidate(botUserID)
	}
	return err
}

func dedupeIDs(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, id := range in {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
