// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type LocalCacheWebhookStore struct {
	store.WebhookStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheWebhookStore) handleClusterInvalidateWebhook(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.webhookCache.Purge()
	} else {
		s.rootStore.webhookCache.Remove(string(msg.Data))
	}
}

func (s LocalCacheWebhookStore) ClearCaches() {
	s.rootStore.doClearCacheCluster(s.rootStore.webhookCache)

	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Webhook - Purge")
	}
}

func (s LocalCacheWebhookStore) InvalidateWebhookCache(webhookId string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.webhookCache, webhookId)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("Webhook - Remove by WebhookId")
	}
}

func (s LocalCacheWebhookStore) GetIncoming(id string, allowFromCache bool) (*model.IncomingWebhook, error) {
	if !allowFromCache {
		return s.WebhookStore.GetIncoming(id, allowFromCache)
	}

	var incomingWebhook *model.IncomingWebhook
	if err := s.rootStore.doStandardReadCache(s.rootStore.webhookCache, id, &incomingWebhook); err == nil {
		return incomingWebhook, nil
	}

	incomingWebhook, err := s.WebhookStore.GetIncoming(id, allowFromCache)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.webhookCache, id, incomingWebhook)

	return incomingWebhook, nil
}

func (s LocalCacheWebhookStore) DeleteIncoming(webhookId string, time int64) error {
	err := s.WebhookStore.DeleteIncoming(webhookId, time)
	if err != nil {
		return err
	}

	s.InvalidateWebhookCache(webhookId)
	return nil
}

func (s LocalCacheWebhookStore) PermanentDeleteIncomingByUser(userId string) error {
	err := s.WebhookStore.PermanentDeleteIncomingByUser(userId)
	if err != nil {
		return err
	}

	s.ClearCaches()
	return nil
}

func (s LocalCacheWebhookStore) PermanentDeleteIncomingByChannel(channelId string) error {
	err := s.WebhookStore.PermanentDeleteIncomingByChannel(channelId)
	if err != nil {
		return err
	}

	s.ClearCaches()
	return nil
}
