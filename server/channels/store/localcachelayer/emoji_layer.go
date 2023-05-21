// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"context"
	"sync"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/channels/store/sqlstore"
)

type LocalCacheEmojiStore struct {
	store.EmojiStore
	rootStore                *LocalCacheStore
	emojiByIdMut             sync.Mutex
	emojiByIdInvalidations   map[string]bool
	emojiByNameMut           sync.Mutex
	emojiByNameInvalidations map[string]bool
}

func (es *LocalCacheEmojiStore) handleClusterInvalidateEmojiById(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		es.rootStore.emojiCacheById.Purge()
	} else {
		es.emojiByIdMut.Lock()
		es.emojiByIdInvalidations[string(msg.Data)] = true
		es.emojiByIdMut.Unlock()
		es.rootStore.emojiCacheById.Remove(string(msg.Data))
	}
}

func (es *LocalCacheEmojiStore) handleClusterInvalidateEmojiIdByName(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		es.rootStore.emojiIdCacheByName.Purge()
	} else {
		es.emojiByNameMut.Lock()
		es.emojiByNameInvalidations[string(msg.Data)] = true
		es.emojiByNameMut.Unlock()
		es.rootStore.emojiIdCacheByName.Remove(string(msg.Data))
	}
}

func (es *LocalCacheEmojiStore) Get(ctx context.Context, id string, allowFromCache bool) (*model.Emoji, error) {
	if allowFromCache {
		if emoji, ok := es.getFromCacheById(id); ok {
			return emoji, nil
		}
	}

	// If it was invalidated, then we need to query master.
	es.emojiByIdMut.Lock()
	if es.emojiByIdInvalidations[id] {
		// And then remove the key from the map.
		ctx = sqlstore.WithMaster(ctx)
		delete(es.emojiByIdInvalidations, id)
	}
	es.emojiByIdMut.Unlock()

	emoji, err := es.EmojiStore.Get(ctx, id, allowFromCache)

	if allowFromCache && err == nil {
		es.addToCache(emoji)
	}

	return emoji, err
}

func (es *LocalCacheEmojiStore) GetByName(ctx context.Context, name string, allowFromCache bool) (*model.Emoji, error) {
	if id, ok := model.GetSystemEmojiId(name); ok {
		return es.Get(ctx, id, allowFromCache)
	}

	if allowFromCache {
		if emoji, ok := es.getFromCacheByName(name); ok {
			return emoji, nil
		}
	}

	// If it was invalidated, then we need to query master.
	es.emojiByNameMut.Lock()
	if es.emojiByNameInvalidations[name] {
		ctx = sqlstore.WithMaster(ctx)
		// And then remove the key from the map.
		delete(es.emojiByNameInvalidations, name)
	}
	es.emojiByNameMut.Unlock()

	emoji, err := es.EmojiStore.GetByName(ctx, name, allowFromCache)

	if allowFromCache && err == nil {
		es.addToCache(emoji)
	}

	return emoji, err
}

func (es *LocalCacheEmojiStore) Delete(emoji *model.Emoji, time int64) error {
	err := es.EmojiStore.Delete(emoji, time)

	if err == nil {
		es.removeFromCache(emoji)
	}

	return err
}

func (es *LocalCacheEmojiStore) addToCache(emoji *model.Emoji) {
	es.rootStore.doStandardAddToCache(es.rootStore.emojiCacheById, emoji.Id, emoji)
	es.rootStore.doStandardAddToCache(es.rootStore.emojiIdCacheByName, emoji.Name, emoji.Id)
}

func (es *LocalCacheEmojiStore) getFromCacheById(id string) (*model.Emoji, bool) {
	var emoji *model.Emoji
	if err := es.rootStore.doStandardReadCache(es.rootStore.emojiCacheById, id, &emoji); err == nil {
		return emoji, true
	}
	return nil, false
}

func (es *LocalCacheEmojiStore) getFromCacheByName(name string) (*model.Emoji, bool) {
	var emojiId string
	if err := es.rootStore.doStandardReadCache(es.rootStore.emojiIdCacheByName, name, &emojiId); err == nil {
		return es.getFromCacheById(emojiId)
	}
	return nil, false
}

func (es *LocalCacheEmojiStore) removeFromCache(emoji *model.Emoji) {
	es.emojiByIdMut.Lock()
	es.emojiByIdInvalidations[emoji.Id] = true
	es.emojiByIdMut.Unlock()
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiCacheById, emoji.Id)

	es.emojiByNameMut.Lock()
	es.emojiByNameInvalidations[emoji.Name] = true
	es.emojiByNameMut.Unlock()
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiIdCacheByName, emoji.Name)
}
