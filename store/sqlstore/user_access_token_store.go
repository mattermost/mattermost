// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func (s SqlUserAccessTokenStore) Save(token *model.UserAccessToken) (*model.UserAccessToken, *model.AppError) {
	token.PreSave()

	if err := token.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(token); err != nil {
		return nil, model.NewAppError("SqlUserAccessTokenStore.Save", "store.sql_user_access_token.save.app_error", nil, "", http.StatusInternalServerError)
	}
	return token, nil
}

func (s SqlUserAccessTokenStore) Delete(tokenId string) *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	defer finalizeTransaction(transaction)

	if err := s.deleteSessionsAndTokensById(transaction, tokenId); err == nil {
		if err := transaction.Commit(); err != nil {
			// don't need to rollback here since the transaction is already closed
			return model.NewAppError("SqlUserAccessTokenStore.Delete", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return nil

}

func (s SqlUserAccessTokenStore) deleteSessionsAndTokensById(transaction *gorp.Transaction, tokenId string) *model.AppError {

	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsById", "store.sql_user_access_token.delete.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.deleteTokensById(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) deleteTokensById(transaction *gorp.Transaction, tokenId string) *model.AppError {

	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteTokensById", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (s SqlUserAccessTokenStore) DeleteAllForUser(userId string) *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)
	if err := s.deleteSessionsandTokensByUser(transaction, userId); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return model.NewAppError("SqlUserAccessTokenStore.DeleteAllForUser", "store.sql_user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *gorp.Transaction, userId string) *model.AppError {
	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = :UserId"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.UserId = :UserId"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsByUser", "store.sql_user_access_token.delete.app_error", nil, "user_id="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s SqlUserAccessTokenStore) deleteTokensByUser(transaction *gorp.Transaction, userId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteTokensByUser", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (s SqlUserAccessTokenStore) Get(tokenId string) (*model.UserAccessToken, *model.AppError) {
	token := model.UserAccessToken{}

	if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlUserAccessTokenStore.Get", "store.sql_user_access_token.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &token, nil
}

func (s SqlUserAccessTokenStore) GetAll(offset, limit int) ([]*model.UserAccessToken, *model.AppError) {
	tokens := []*model.UserAccessToken{}

	if _, err := s.GetReplica().Select(&tokens, "SELECT * FROM UserAccessTokens LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlUserAccessTokenStore.GetAll", "store.sql_user_access_token.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) GetByToken(tokenString string) (*model.UserAccessToken, *model.AppError) {
	token := model.UserAccessToken{}

	if err := s.GetReplica().SelectOne(&token, "SELECT * FROM UserAccessTokens WHERE Token = :Token", map[string]interface{}{"Token": tokenString}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlUserAccessTokenStore.GetByToken", "store.sql_user_access_token.get_by_token.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return &token, nil
}

func (s SqlUserAccessTokenStore) GetByUser(userId string, offset, limit int) ([]*model.UserAccessToken, *model.AppError) {
	tokens := []*model.UserAccessToken{}

	if _, err := s.GetReplica().Select(&tokens, "SELECT * FROM UserAccessTokens WHERE UserId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlUserAccessTokenStore.GetByUser", "store.sql_user_access_token.get_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) Search(term string) ([]*model.UserAccessToken, *model.AppError) {
	term = sanitizeSearchTerm(term, "\\")
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
		return nil, model.NewAppError("SqlUserAccessTokenStore.Search", "store.sql_user_access_token.search.app_error", nil, "term="+term+", "+err.Error(), http.StatusInternalServerError)
	}

	return tokens, nil
}

func (s SqlUserAccessTokenStore) UpdateTokenEnable(tokenId string) *model.AppError {
	if _, err := s.GetMaster().Exec("UPDATE UserAccessTokens SET IsActive = TRUE WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.UpdateTokenEnable", "store.sql_user_access_token.update_token_enable.app_error", nil, "id="+tokenId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlUserAccessTokenStore) UpdateTokenDisable(tokenId string) *model.AppError {
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.UpdateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	if err := s.deleteSessionsAndDisableToken(transaction, tokenId); err != nil {
		return err
	}
	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return model.NewAppError("SqlUserAccessTokenStore.UpdateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s SqlUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *gorp.Transaction, tokenId string) *model.AppError {
	query := ""
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN UserAccessTokens o ON o.Token = s.Token WHERE o.Id = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsAndDisableToken", "store.sql_user_access_token.update_token_disable.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.updateTokenDisable(transaction, tokenId)
}

func (s SqlUserAccessTokenStore) updateTokenDisable(transaction *gorp.Transaction, tokenId string) *model.AppError {
	if _, err := transaction.Exec("UPDATE UserAccessTokens SET IsActive = FALSE WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.updateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}
