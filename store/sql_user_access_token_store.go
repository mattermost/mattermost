// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type SqlUserAccessTokenStore struct {
	SqlStore
}

func NewSqlUserAccessTokenStore(sqlStore SqlStore) UserAccessTokenStore {
	s := &SqlUserAccessTokenStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.UserAccessToken{}, "UserAccessTokens").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Token").SetMaxSize(26).SetUnique(true)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Description").SetMaxSize(512)
	}

	return s
}

func (s SqlUserAccessTokenStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_user_access_tokens_token", "UserAccessTokens", "Token")
	s.CreateIndexIfNotExists("idx_user_access_tokens_user_id", "UserAccessTokens", "UserId")
}

func (s SqlUserAccessTokenStore) Save(token *model.UserAccessToken) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		token.PreSave()

		if result.Err = token.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(token); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.Save", "store.sql_user_access_token.save.app_error", nil, "", http.StatusInternalServerError)
		} else {
			result.Data = token
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserAccessTokenStore) Delete(tokenId string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := s.deleteSessionsAndTokensById(transaction, tokenId); extrasResult.Err != nil {
				result = extrasResult
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserAccessTokenStore) deleteSessionsAndTokensById(transaction *gorp.Transaction, tokenId string) StoreResult {
	result := StoreResult{}

	query := ""
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteSessionsById", "store.sql_user_access_token.delete.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return s.deleteTokensById(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) deleteTokensById(transaction *gorp.Transaction, tokenId string) StoreResult {
	result := StoreResult{}

	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteTokensById", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return result
}

func (s SqlUserAccessTokenStore) DeleteAllForUser(userId string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := s.deleteSessionsandTokensByUser(transaction, userId); extrasResult.Err != nil {
				result = extrasResult
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *gorp.Transaction, userId string) StoreResult {
	result := StoreResult{}

	query := ""
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = :UserId"
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.UserId = :UserId"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"UserId": userId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteSessionsByUser", "store.sql_user_access_token.delete.app_error", nil, "user_id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s SqlUserAccessTokenStore) deleteTokensByUser(transaction *gorp.Transaction, userId string) StoreResult {
	result := StoreResult{}

	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteTokensByUser", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return result
}

func (s SqlUserAccessTokenStore) Get(tokenId string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		token := model.UserAccessToken{}

		if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &token

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserAccessTokenStore) GetByToken(tokenString string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		token := model.UserAccessToken{}

		if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Token = :Token", map[string]interface{}{"Token": tokenString}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &token

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlUserAccessTokenStore) GetByUser(userId string, offset, limit int) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		tokens := []*model.UserAccessToken{}

		if _, err := s.GetReplica().Select(&tokens, "SELECT * FROM UserAccessTokens WHERE UserId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByUser", "store.sql_user_access_token.get_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = tokens

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
