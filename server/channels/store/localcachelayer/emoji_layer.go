// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// emojiNotFoundSentinel is stored in emojiIdCacheByName for names known to be
// absent from the DB; real emoji ids are always 26 characters, so no collision.
const emojiNotFoundSentinel = "-"

type LocalCacheEmojiStore struct {
	store.EmojiStore
	rootStore                *LocalCacheStore
	emojiByIdMut             sync.Mutex
	emojiByIdInvalidations   map[string]bool
	emojiByNameMut           sync.Mutex
	emojiByNameInvalidations map[string]bool
}

func (es *LocalCacheEmojiStore) Save(emoji *model.Emoji) (*model.Emoji, error) {
	savedEmoji, err := es.EmojiStore.Save(emoji)

	if err == nil {
		// A negative cache entry may exist for this name if it was looked up
		// before the emoji was created, so it needs to be invalidated.
		es.emojiByNameMut.Lock()
		es.emojiByNameInvalidations[savedEmoji.Name] = true
		es.emojiByNameMut.Unlock()
		es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiIdCacheByName, savedEmoji.Name, nil)
	}

	return savedEmoji, err
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

func (es *LocalCacheEmojiStore) Get(rctx request.CTX, id string, allowFromCache bool) (*model.Emoji, error) {
	if allowFromCache {
		if emoji, ok := es.getFromCacheById(id); ok {
			return emoji, nil
		}
	}

	// If it was invalidated, then we need to query master.
	es.emojiByIdMut.Lock()
	if es.emojiByIdInvalidations[id] {
		// And then remove the key from the map.
		rctx = sqlstore.RequestContextWithMaster(rctx)
		delete(es.emojiByIdInvalidations, id)
	}
	es.emojiByIdMut.Unlock()

	emoji, err := es.EmojiStore.Get(rctx, id, allowFromCache)

	if allowFromCache && err == nil {
		es.addToCache(emoji)
	}

	return emoji, err
}

func (es *LocalCacheEmojiStore) GetByName(rctx request.CTX, name string, allowFromCache bool) (*model.Emoji, error) {
	if id, ok := model.GetSystemEmojiId(name); ok {
		return es.Get(rctx, id, allowFromCache)
	}

	if allowFromCache {
		if emoji, ok := es.getFromCacheByName(name); ok {
			return emoji, nil
		}
	}

	// If it was invalidated, then we need to query master.
	es.emojiByNameMut.Lock()
	if es.emojiByNameInvalidations[name] {
		rctx = sqlstore.RequestContextWithMaster(rctx)
		// And then remove the key from the map.
		delete(es.emojiByNameInvalidations, name)
	}
	es.emojiByNameMut.Unlock()

	emoji, err := es.EmojiStore.GetByName(rctx, name, allowFromCache)
	if err != nil {
		return nil, err
	}

	if allowFromCache {
		es.addToCache(emoji)
	}

	return emoji, nil
}

func (es *LocalCacheEmojiStore) GetMultipleByName(rctx request.CTX, names []string) ([]*model.Emoji, error) {
	emojis := []*model.Emoji{}
	remainingEmojiNames := make([]string, 0)

	for _, name := range names {
		var emojiId string
		if err := es.rootStore.doStandardReadCache(es.rootStore.emojiIdCacheByName, name, &emojiId); err == nil {
			if emojiId == emojiNotFoundSentinel {
				continue
			}
			if emoji, ok := es.getFromCacheById(emojiId); ok {
				emojis = append(emojis, emoji)
				continue
			}
		}

		// If it was invalidated, then we need to query master.
		es.emojiByNameMut.Lock()
		if es.emojiByNameInvalidations[name] {
			rctx = sqlstore.RequestContextWithMaster(rctx)
			// And then remove the key from the map.
			delete(es.emojiByNameInvalidations, name)
		}
		es.emojiByNameMut.Unlock()

		remainingEmojiNames = append(remainingEmojiNames, name)
	}

	if len(remainingEmojiNames) > 0 {
		remainingEmojis, err := es.EmojiStore.GetMultipleByName(rctx, remainingEmojiNames)
		if err != nil {
			return nil, err
		}
		foundNames := make(map[string]bool, len(remainingEmojis))
		for _, emoji := range remainingEmojis {
			es.addToCache(emoji)
			emojis = append(emojis, emoji)
			foundNames[emoji.Name] = true
		}
		// Cache the names that don't exist in the database with a short TTL,
		// so they don't trigger a DB query on every subsequent lookup. Save
		// invalidates these entries when an emoji with such a name is
		// created. Names longer than the maximum can never exist and are
		// skipped to avoid flooding the cache.
		for _, name := range remainingEmojiNames {
			if !foundNames[name] && len(name) <= model.EmojiNameMaxLength {
				es.rootStore.doStandardAddToCacheWithExpiry(es.rootStore.emojiIdCacheByName, name, emojiNotFoundSentinel, EmojiNotFoundCacheSec*time.Second)
			}
		}
	}

	return emojis, nil
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
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiCacheById, emoji.Id, nil)

	es.emojiByNameMut.Lock()
	es.emojiByNameInvalidations[emoji.Name] = true
	es.emojiByNameMut.Unlock()
	es.rootStore.doInvalidateCacheCluster(es.rootStore.emojiIdCacheByName, emoji.Name, nil)
}
