// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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
		table.ColMap("Extra").SetMaxSize(2048)
	}

	return s
}

func (s SqlTokenStore) CreateIndexesIfNotExists() {
}

func (s SqlTokenStore) Save(token *model.Token) *model.AppError {
	if err := token.IsValid(); err != nil {
		return err
	}

	if err := s.GetMaster().Insert(token); err != nil {
		return model.NewAppError("SqlTokenStore.Save", "store.sql_recover.save.app_error", nil, "", http.StatusInternalServerError)
	}
	return nil
}

func (s SqlTokenStore) Delete(token string) *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
		return model.NewAppError("SqlTokenStore.Delete", "store.sql_recover.delete.app_error", nil, "", http.StatusInternalServerError)
	}
	return nil
}

func (s SqlTokenStore) GetByToken(tokenString string) (*model.Token, *model.AppError) {
	token := &model.Token{}

	if err := s.GetReplica().SelectOne(token, "SELECT * FROM Tokens WHERE Token = :Token", map[string]interface{}{"Token": tokenString}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlTokenStore.GetByToken", "store.sql_recover.get_by_code.app_error", nil, err.Error(), http.StatusBadRequest)
		}

		return nil, model.NewAppError("SqlTokenStore.GetByToken", "store.sql_recover.get_by_code.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return token, nil
}

func (s SqlTokenStore) Cleanup() {
	mlog.Debug("Cleaning up token store.")
	deltime := model.GetMillis() - model.MAX_TOKEN_EXIPRY_TIME
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE CreateAt < :DelTime", map[string]interface{}{"DelTime": deltime}); err != nil {
		mlog.Error("Unable to cleanup token store.")
	}
}

func (s SqlTokenStore) RemoveAllTokensByType(tokenType string) *model.AppError {
	if _, err := s.GetMaster().Exec("DELETE FROM Tokens WHERE Type = :TokenType", map[string]interface{}{"TokenType": tokenType}); err != nil {
		return model.NewAppError("SqlTokenStore.RemoveAllTokensByType", "store.sql_recover.remove_all_tokens_by_type.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
