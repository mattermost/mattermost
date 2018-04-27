// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlTokenStore struct {
	SqlStore
}

func NewSqlTokenStore(sqlStore SqlStore) store.TokenStore {
	s := &SqlTokenStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Token{}, "Tokens").SetKeys(false, "Token")
		table.ColMap("Token").SetMaxSize(64)
		table.ColMap("Type").SetMaxSize(64)
		table.ColMap("Extra").SetMaxSize(128)
	}

	return s
}

func (s SqlTokenStore) CreateIndexesIfNotExists() {
}

func (s SqlTokenStore) Save(token *model.Token) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = token.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(token); err != nil {
			result.Err = model.NewAppError("SqlTokenStore.Save", "store.sql_recover.save.app_error", nil, "", http.StatusInternalServerError)
		}
	})
}

func (s SqlTokenStore) Delete(token string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewAppError("SqlTokenStore.Delete", "store.sql_recover.delete.app_error", nil, "", http.StatusInternalServerError)
		}
	})
}

func (s SqlTokenStore) GetByToken(tokenString string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		token := model.Token{}

		if err := s.GetReplica().SelectOne(&token, "SELECT * FROM Tokens WHERE Token = :Token", map[string]interface{}{"Token": tokenString}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlTokenStore.GetByToken", "store.sql_recover.get_by_code.app_error", nil, err.Error(), http.StatusBadRequest)
			} else {
				result.Err = model.NewAppError("SqlTokenStore.GetByToken", "store.sql_recover.get_by_code.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &token
	})
}

func (s SqlTokenStore) Cleanup() {
	mlog.Debug("Cleaning up token store.")
	deltime := model.GetMillis() - model.MAX_TOKEN_EXIPRY_TIME
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE CreateAt < :DelTime", map[string]interface{}{"DelTime": deltime}); err != nil {
		mlog.Error("Unable to cleanup token store.")
	}
}
