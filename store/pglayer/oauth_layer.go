// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgOAuthStore struct {
	sqlstore.SqlOAuthStore
}

func (as PgOAuthStore) DeleteApp(id string) *model.AppError {
	// wrap in a transaction so that if one fails, everything fails
	transaction, err := as.GetMaster().Begin()
	if err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer finalizeTransaction(transaction)

	if err := as.deleteApp(transaction, id); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (as PgOAuthStore) deleteApp(transaction *gorp.Transaction, clientId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM OAuthApps WHERE Id = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteOAuthAppSessions(transaction, clientId)
}

func (as PgOAuthStore) deleteOAuthAppSessions(transaction *gorp.Transaction, clientId string) *model.AppError {

	query := ""
	query = "DELETE FROM Sessions s USING OAuthAccessData o WHERE o.Token = s.Token AND o.ClientId = :Id"

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteOAuthTokens(transaction, clientId)
}

func (as PgOAuthStore) deleteOAuthTokens(transaction *gorp.Transaction, clientId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM OAuthAccessData WHERE ClientId = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteAppExtras(transaction, clientId)
}

func (as PgOAuthStore) deleteAppExtras(transaction *gorp.Transaction, clientId string) *model.AppError {
	if _, err := transaction.Exec(
		`DELETE FROM
			Preferences
		WHERE
			Category = :Category
			AND Name = :Name`, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, "Name": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}
