// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheEmojiStore struct {
	store.EmojiStore
	rootStore *LocalCacheStore
}

func (es *LocalCacheEmojiStore) handleClusterInvalidateEmojiById(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		es.rootStore.emojiCacheById.Purge()
	} else {
		es.rootStore.emojiCacheById.Remove(msg.Data)
	}
}

func (es *LocalCacheEmojiStore) handleClusterInvalidateEmojiIdByName(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		es.rootStore.emojiIdCacheByName.Purge()
	} else {
		es.rootStore.emojiIdCacheByName.Remove(msg.Data)
	}
}

func (es LocalCacheEmojiStore) Get(id string, allowFromCache bool) (*model.Emoji, error) {
	if allowFromCache {
		if emoji, ok := es.getFromCacheById(id); ok {
			return emoji, nil
		}
	}

	emoji, err := es.EmojiStore.Get(id, allowFromCache)

	if allowFromCache && err == nil {
		es.addToCache(emoji)
	}

	return emoji, err
}

func (es LocalCacheEmojiStore) GetByName(name string, allowFromCache bool) (*model.Emoji, error) {
	if id, ok := model.GetSystemEmojiId(name); ok {
		return es.Get(id, allowFromCache)
	}

	if allowFromCache {
		if emoji, ok := es.getFromCacheByName(name); ok {
			return emoji, nil
		}
	}

	emoji, err := es.EmojiStore.GetByName(name, allowFromCache)

	if allowFromCache && err == nil {
		es.addToCache(emoji)
	}

	return emoji, err
}

func (es LocalCacheEmojiStore) Delete(emoji *model.Emoji, time int64) error {
	err := es.EmojiStore.Delete(emoji, time)

	if err == nil {
		es.removeFromCache(emoji)
	}

	return err
}

func (es LocalCacheEmojiStore) addToCache(emoji *model.Emoji) {
	es.rootStore.doStandardAddToCache(es.rootStore.emojiCacheById, emoji.Id, emoji)
	es.rootStore.doStandardAddToCache(es.rootStore.emojiIdCacheByName, emoji.Name, emoji.Id)
}

func (es LocalCacheEmojiStore) getFromCacheById(id string) (*model.Emoji, bool) {
	var emoji *model.Emoji
	if err := es.rootStore.doStandardReadCache(es.rootStore.emojiCacheById, id, &emoji); err == nil {
		return emoji, true
	}
	return nil, false
}

func (es LocalCacheEmojiStore) getFromCacheByName(name string) (*model.Emoji, bool) {
	var emojiId string
	if err := es.rootStore.doStandardReadCache(es.rootStore.emojiIdCacheByName, name, &emojiId); err == nil {
		return es.getFromCacheById(emojiId)
	}
	return nil, false
}

func (es LocalCacheEmojiStore) removeFromCache(emoji *model.Emoji) {
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiCacheById, emoji.Id)
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiIdCacheByName, emoji.Name)
}
