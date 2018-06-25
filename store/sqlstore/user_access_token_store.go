// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlUserAccessTokenStore struct {
	SqlStore
}

func NewSqlUserAccessTokenStore(sqlStore SqlStore) store.UserAccessTokenStore {
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

func (s SqlUserAccessTokenStore) Save(token *model.UserAccessToken) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		token.PreSave()

		if result.Err = token.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(token); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.Save", "store.sql_user_access_token.save.app_error", nil, "", http.StatusInternalServerError)
		} else {
			result.Data = token
		}
	})
}

func (s SqlUserAccessTokenStore) Delete(tokenId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := s.deleteSessionsAndTokensById(transaction, tokenId); extrasResult.Err != nil {
				*result = extrasResult
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
	})
}

func (s SqlUserAccessTokenStore) deleteSessionsAndTokensById(transaction *gorp.Transaction, tokenId string) store.StoreResult {
	result := store.StoreResult{}

	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteSessionsById", "store.sql_user_access_token.delete.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return s.deleteTokensById(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) deleteTokensById(transaction *gorp.Transaction, tokenId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteTokensById", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return result
}

func (s SqlUserAccessTokenStore) DeleteAllForUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := s.deleteSessionsandTokensByUser(transaction, userId); extrasResult.Err != nil {
				*result = extrasResult
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
	})
}

func (s SqlUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *gorp.Transaction, userId string) store.StoreResult {
	result := store.StoreResult{}

	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = :UserId"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.UserId = :UserId"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"UserId": userId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteSessionsByUser", "store.sql_user_access_token.delete.app_error", nil, "user_id="+userId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s SqlUserAccessTokenStore) deleteTokensByUser(transaction *gorp.Transaction, userId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteTokensByUser", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return result
}

func (s SqlUserAccessTokenStore) Get(tokenId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		token := model.UserAccessToken{}

		if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &token
	})
}

func (s SqlUserAccessTokenStore) GetAll(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		tokens := []*model.UserAccessToken{}

		if _, err := s.GetReplica().Select(&tokens, "SELECT * FROM UserAccessTokens LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.GetAll", "store.sql_user_access_token.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = tokens
	})
}

func (s SqlUserAccessTokenStore) GetByToken(tokenString string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		token := model.UserAccessToken{}

		if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Token = :Token", map[string]interface{}{"Token": tokenString}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		result.Data = &token
	})
}

func (s SqlUserAccessTokenStore) GetByUser(userId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		tokens := []*model.UserAccessToken{}

		if _, err := s.GetReplica().Select(&tokens, "SELECT * FROM UserAccessTokens WHERE UserId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.GetByUser", "store.sql_user_access_token.get_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = tokens
	})
}

func (s SqlUserAccessTokenStore) Search(term string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		tokens := []*model.UserAccessToken{}
		params := map[string]interface{}{"Term": term + "%"}
		query := `
			SELECT 
				uat.*
			FROM UserAccessTokens uat
			INNER JOIN Users u 
				ON uat.UserId = u.Id
			WHERE uat.Id LIKE :Term OR uat.UserId LIKE :Term OR u.Username LIKE :Term`

		if _, err := s.GetReplica().Select(&tokens, query, params); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.Search", "store.sql_user_access_token.search.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = tokens
	})
}

func (s SqlUserAccessTokenStore) UpdateTokenEnable(tokenId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec("UPDATE UserAccessTokens SET IsActive = TRUE WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.UpdateTokenEnable", "store.sql_user_access_token.update_token_enable.app_error", nil, "id="+tokenId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = tokenId
		}
	})
}

func (s SqlUserAccessTokenStore) UpdateTokenDisable(tokenId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlUserAccessTokenStore.UpdateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := s.deleteSessionsAndDisableToken(transaction, tokenId); extrasResult.Err != nil {
				*result = extrasResult
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlUserAccessTokenStore.UpdateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlUserAccessTokenStore.UpdateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}
	})
}

func (s SqlUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *gorp.Transaction, tokenId string) store.StoreResult {
	result := store.StoreResult{}

	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.deleteSessionsAndDisableToken", "store.sql_user_access_token.update_token_disable.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return s.updateTokenDisable(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) updateTokenDisable(transaction *gorp.Transaction, tokenId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("UPDATE UserAccessTokens SET IsActive = FALSE WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		result.Err = model.NewAppError("SqlUserAccessTokenStore.updateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, "", http.StatusInternalServerError)
	}

	return result
}
