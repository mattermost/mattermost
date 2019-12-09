// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

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
	es.CreateIndexIfNotExists("idx_emoji_name", "Emoji", "Name")
}

func (es SqlEmojiStore) Save(emoji *model.Emoji) (*model.Emoji, *model.AppError) {
	emoji.PreSave()
	if err := emoji.IsValid(); err != nil {
		return nil, err
	}

	if err := es.GetMaster().Insert(emoji); err != nil {
		return nil, model.NewAppError("SqlEmojiStore.Save", "store.sql_emoji.save.app_error", nil, "id="+emoji.Id+", "+err.Error(), http.StatusInternalServerError)
	}

	return emoji, nil
}

func (es SqlEmojiStore) Get(id string, allowFromCache bool) (*model.Emoji, *model.AppError) {
	return es.getBy("Id", id, allowFromCache)
}

func (es SqlEmojiStore) GetByName(name string, allowFromCache bool) (*model.Emoji, *model.AppError) {
	return es.getBy("Name", name, allowFromCache)
}

func (es SqlEmojiStore) GetMultipleByName(names []string) ([]*model.Emoji, *model.AppError) {
	keys, params := MapStringsToQueryParams(names, "Emoji")

	var emojis []*model.Emoji

	if _, err := es.GetReplica().Select(&emojis,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			Name IN `+keys+`
			AND DeleteAt = 0`, params); err != nil {
		return nil, model.NewAppError("SqlEmojiStore.GetByName", "store.sql_emoji.get_by_name.app_error", nil, fmt.Sprintf("names=%v, %v", names, err.Error()), http.StatusInternalServerError)
	}
	return emojis, nil
}

func (es SqlEmojiStore) GetList(offset, limit int, sort string) ([]*model.Emoji, *model.AppError) {
	var emoji []*model.Emoji

	query := "SELECT * FROM Emoji WHERE DeleteAt = 0"

	if sort == model.EMOJI_SORT_BY_NAME {
		query += " ORDER BY Name"
	}

	query += " LIMIT :Limit OFFSET :Offset"

	if _, err := es.GetReplica().Select(&emoji, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlEmojiStore.GetList", "store.sql_emoji.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return emoji, nil
}

func (es SqlEmojiStore) Delete(emoji *model.Emoji, time int64) *model.AppError {
	if sqlResult, err := es.GetMaster().Exec(
		`UPDATE
			Emoji
		SET
			DeleteAt = :DeleteAt,
			UpdateAt = :UpdateAt
		WHERE
			Id = :Id
			AND DeleteAt = 0`, map[string]interface{}{"DeleteAt": time, "UpdateAt": time, "Id": emoji.Id}); err != nil {
		return model.NewAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.app_error", nil, "id="+emoji.Id+", err="+err.Error(), http.StatusInternalServerError)
	} else if rows, _ := sqlResult.RowsAffected(); rows == 0 {
		return model.NewAppError("SqlEmojiStore.Delete", "store.sql_emoji.delete.no_results", nil, "id="+emoji.Id, http.StatusBadRequest)
	}

	return nil
}

func (es SqlEmojiStore) Search(name string, prefixOnly bool, limit int) ([]*model.Emoji, *model.AppError) {
	var emojis []*model.Emoji

	name = sanitizeSearchTerm(name, "\\")

	term := ""
	if !prefixOnly {
		term = "%"
	}

	term += name + "%"

	if _, err := es.GetReplica().Select(&emojis,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			Name LIKE :Name
			AND DeleteAt = 0
			ORDER BY Name
			LIMIT :Limit`, map[string]interface{}{"Name": term, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlEmojiStore.Search", "store.sql_emoji.get_by_name.app_error", nil, "name="+name+", "+err.Error(), http.StatusInternalServerError)
	}
	return emojis, nil
}

// getBy returns one active (not deleted) emoji, found by any one column (what/key).
func (es SqlEmojiStore) getBy(what string, key interface{}, addToCache bool) (*model.Emoji, *model.AppError) {
	var emoji *model.Emoji

	err := es.GetReplica().SelectOne(&emoji,
		`SELECT
			*
		FROM
			Emoji
		WHERE
			`+what+` = :Key
			AND DeleteAt = 0`, map[string]interface{}{"Key": key})
	if err != nil {
		var status int
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		} else {
			status = http.StatusInternalServerError
		}
		return nil, model.NewAppError("SqlEmojiStore.GetByName", "store.sql_emoji.get.app_error", nil, "key="+fmt.Sprintf("%v", key)+", "+err.Error(), status)
	}

	return emoji, nil
}
