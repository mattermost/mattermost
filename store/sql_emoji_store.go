// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlEmojiStore struct {
	*SqlStore
}

func NewSqlEmojiStore(sqlStore *SqlStore) EmojiStore {
	s := &SqlEmojiStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Emoji{}, "Emoji").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("CreatorId").SetMaxSize(26)
		table.ColMap("Name").SetMaxSize(64)

		table.SetUniqueTogether("Name", "DeleteAt")
	}

	return s
}

func (es SqlEmojiStore) UpgradeSchemaIfNeeded() {
}

func (es SqlEmojiStore) CreateIndexesIfNotExists() {
}

func (es SqlEmojiStore) Save(emoji *model.Emoji) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		emoji.PreSave()
		if result.Err = emoji.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := es.GetMaster().Insert(emoji); err != nil {
			result.Err = model.NewLocAppError("SqlEmojiStore.Save", "store.sql_emoji.save.app_error", nil, "id="+emoji.Id+", "+err.Error())
		} else {
			result.Data = emoji
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (es SqlEmojiStore) Get(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var emoji *model.Emoji

		if err := es.GetReplica().SelectOne(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				Id = :Id
				AND DeleteAt = 0`, map[string]interface{}{"Id": id}); err != nil {
			result.Err = model.NewLocAppError("SqlEmojiStore.Get", "store.sql_emoji.get.app_error", nil, "id="+id+", "+err.Error())
		} else {
			result.Data = emoji
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (es SqlEmojiStore) GetByName(name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var emoji *model.Emoji

		if err := es.GetReplica().SelectOne(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				Name = :Name
				AND DeleteAt = 0`, map[string]interface{}{"Name": name}); err != nil {
			result.Err = model.NewLocAppError("SqlEmojiStore.GetByName", "store.sql_emoji.get_by_name.app_error", nil, "name="+name+", "+err.Error())
		} else {
			result.Data = emoji
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (es SqlEmojiStore) GetAll() StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var emoji []*model.Emoji

		if _, err := es.GetReplica().Select(&emoji,
			`SELECT
				*
			FROM
				Emoji
			WHERE
				DeleteAt = 0`); err != nil {
			result.Err = model.NewLocAppError("SqlEmojiStore.Get", "store.sql_emoji.get_all.app_error", nil, err.Error())
		} else {
			result.Data = emoji
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (es SqlEmojiStore) Delete(id string, time int64) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if sqlResult, err := es.GetMaster().Exec(
			`Update
				Emoji
			SET
				DeleteAt = :DeleteAt,
				UpdateAt = :UpdateAt
			WHERE
				Id = :Id
				AND DeleteAt = 0`, map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": id}); err != nil {
			result.Err = model.NewLocAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.app_error", nil, "id="+id+", err="+err.Error())
		} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
			result.Err = model.NewLocAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.no_results", nil, "id="+id+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
