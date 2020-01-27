// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgUserAccessTokenStore struct {
	sqlstore.SqlUserAccessTokenStore
}

func (s PgUserAccessTokenStore) deleteTokensById(transaction *gorp.Transaction, tokenId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteTokensById", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (s PgUserAccessTokenStore) UpdateTokenDisable(tokenId string) *model.AppError {
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

func (s PgUserAccessTokenStore) updateTokenDisable(transaction *gorp.Transaction, tokenId string) *model.AppError {
	if _, err := transaction.Exec("UPDATE UserAccessTokens SET IsActive = FALSE WHERE Id = :Id", map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.updateTokenDisable", "store.sql_user_access_token.update_token_disable.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (s PgUserAccessTokenStore) deleteSessionsAndDisableToken(transaction *gorp.Transaction, tokenId string) *model.AppError {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsAndDisableToken", "store.sql_user_access_token.update_token_disable.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.updateTokenDisable(transaction, tokenId)
}

func (s PgUserAccessTokenStore) DeleteAllForUser(userId string) *model.AppError {
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

func (s PgUserAccessTokenStore) deleteTokensByUser(transaction *gorp.Transaction, userId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM UserAccessTokens WHERE UserId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteTokensByUser", "store.sql_user_access_token.delete.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

func (s PgUserAccessTokenStore) deleteSessionsandTokensByUser(transaction *gorp.Transaction, userId string) *model.AppError {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.UserId = :UserId"

	if _, err := transaction.Exec(query, map[string]interface{}{"UserId": userId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsByUser", "store.sql_user_access_token.delete.app_error", nil, "user_id="+userId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.deleteTokensByUser(transaction, userId)
}

func (s PgUserAccessTokenStore) Delete(tokenId string) *model.AppError {
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

func (s PgUserAccessTokenStore) deleteSessionsAndTokensById(transaction *gorp.Transaction, tokenId string) *model.AppError {
	query := "DELETE FROM Sessions s USING UserAccessTokens o WHERE o.Token = s.Token AND o.Id = :Id"

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": tokenId}); err != nil {
		return model.NewAppError("SqlUserAccessTokenStore.deleteSessionsById", "store.sql_user_access_token.delete.app_error", nil, "id="+tokenId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return s.deleteTokensById(transaction, tokenId)
}
