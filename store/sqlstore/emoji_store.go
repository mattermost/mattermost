// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	EMOJI_CACHE_SIZE = 5000
	EMOJI_CACHE_SEC  = 1800 // 30 mins
)

var emojiCache *utils.Cache = utils.NewLru(EMOJI_CACHE_SIZE)

type SqlEmojiStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

func NewSqlEmojiStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.EmojiStore {
	s := &SqlEmojiStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Emoji{}, "Emoji").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("CreatorId").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(64)

		table.SetUniqueTogether("Name", "DeleteAt")
	}

	return s
}

func (es SqlEmojiStore) CreateIndexesIfNotExists() {
	es.CreateIndexIfNotExists("idx_emoji_update_at", "Emoji", "UpdateAt")
	es.CreateIndexIfNotExists("idx_emoji_create_at", "Emoji", "CreateAt")
	es.CreateIndexIfNotExists("idx_emoji_delete_at", "Emoji", "DeleteAt")
}

func (es SqlEmojiStore) Save(emoji *model.Emoji) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		emoji.PreSave()
		if result.Err = emoji.IsValid(); result.Err != nil {
			return
		}

		if err := es.GetMaster().Insert(emoji); err != nil {
			result.Err = model.NewAppError("SqlEmojiStore.Save", "store.sql_emoji.save.app_error", nil, "id="+emoji.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = emoji
		}
	})
}

func (es SqlEmojiStore) Get(id string, allowFromCache bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if allowFromCache {
			if cacheItem, ok := emojiCache.Get(id); ok {
				if es.metrics != nil {
					es.metrics.IncrementMemCacheHitCounter("Emoji")
				}
				result.Data = cacheItem.(*model.Emoji)
				return
			} else {
				if es.metrics != nil {
					es.metrics.IncrementMemCacheMissCounter("Emoji")
				}
			}
		} else {
			if es.metrics != nil {
				es.metrics.IncrementMemCacheMissCounter("Emoji")
			}
		}

		var emoji *model.Emoji

		if err := es.GetReplica().SelectOne(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				Id = :Id
				AND DeleteAt = 0`, map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewAppError("SqlEmojiStore.Get", "store.sql_emoji.get.app_error", nil, "id="+id+", "+err.Error(), http.StatusNotFound)
		} else {
			result.Data = emoji

			if allowFromCache {
				emojiCache.AddWithExpiresInSecs(id, emoji, EMOJI_CACHE_SEC)
			}
		}
	})
}

func (es SqlEmojiStore) GetByName(name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var emoji *model.Emoji

		if err := es.GetReplica().SelectOne(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				Name = :Name
				AND DeleteAt = 0`, map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewAppError("SqlEmojiStore.GetByName", "store.sql_emoji.get_by_name.app_error", nil, "name="+name+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = emoji
		}
	})
}

func (es SqlEmojiStore) GetList(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var emoji []*model.Emoji

		if _, err := es.GetReplica().Select(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				DeleteAt = 0
			LIMIT :Limit OFFSET :Offset`, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlEmojiStore.GetList", "store.sql_emoji.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = emoji
		}
	})
}

func (es SqlEmojiStore) Delete(id string, time int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if sqlResult, err := es.GetMaster().Exec(
			`Update
				Emoji
			SET
				DeleteAt = :DeleteAt,
				UpdateAt = :UpdateAt
			WHERE
				Id = :Id
				AND DeleteAt = 0`, map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": id}); err != nil {
			result.Err = model.NewAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.app_error", nil, "id="+id+", err="+err.Error(), http.StatusInternalServerError)
		} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
			result.Err = model.NewAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.no_results", nil, "id="+id+", err="+err.Error(), http.StatusBadRequest)
		}

		emojiCache.Remove(id)
	})
}
