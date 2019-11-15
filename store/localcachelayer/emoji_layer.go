// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type LocalCacheEmojiStore struct {
	store.EmojiStore
	rootStore *LocalCacheStore
}

func (es *LocalCacheEmojiStore) handleClusterInvalidateEmoji(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		es.rootStore.emojiCacheById.Purge()
		es.rootStore.emojiIdCacheByName.Purge()
	} else {
		es.rootStore.emojiCacheById.Remove(msg.Data)
		es.rootStore.emojiIdCacheByName.Remove(msg.Data)
	}
}

func (es LocalCacheEmojiStore) Get(id string, allowFromCache bool) (*model.Emoji, *model.AppError) {
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

func (es LocalCacheEmojiStore) GetByName(name string, allowFromCache bool) (*model.Emoji, *model.AppError) {
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

func (es LocalCacheEmojiStore) Delete(emoji *model.Emoji, time int64) *model.AppError {
	err := es.EmojiStore.Delete(emoji, time)

	if err == nil {
		es.removeFromCache(emoji)
	}

	return err
}

func (es LocalCacheEmojiStore) addToCache(emoji *model.Emoji) {
	es.rootStore.emojiCacheById.AddWithExpiresInSecs(emoji.Id, emoji, EMOJI_CACHE_SEC)
	es.rootStore.emojiIdCacheByName.AddWithExpiresInSecs(emoji.Name, emoji.Id, EMOJI_CACHE_SEC)
}

func (es LocalCacheEmojiStore) getFromCacheById(id string) (*model.Emoji, bool) {
	if emoji := es.rootStore.doStandardReadCache(es.rootStore.emojiCacheById, id); emoji != nil {
		return emoji.(*model.Emoji), true
	}
	return nil, false
}

func (es LocalCacheEmojiStore) getFromCacheByName(name string) (*model.Emoji, bool) {
	if emoji := es.rootStore.doStandardReadCache(es.rootStore.emojiIdCacheByName, name); emoji != nil {
		return es.getFromCacheById(emoji.(string))
	}
	return nil, false
}

func (es LocalCacheEmojiStore) removeFromCache(emoji *model.Emoji) {
	es.rootStore.emojiCacheById.Remove(emoji.Id)
	es.rootStore.emojiIdCacheByName.Remove(emoji.Name)
}
