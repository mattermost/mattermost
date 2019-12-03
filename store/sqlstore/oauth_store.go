// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlOAuthStore struct {
	SqlStore
}

func NewSqlOAuthStore(sqlStore SqlStore) store.OAuthStore {
	as := &SqlOAuthStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.OAuthApp{}, "OAuthApps").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("CreatorId").SetMaxSize(26)
		table.ColMap("ClientSecret").SetMaxSize(128)
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Description").SetMaxSize(512)
		table.ColMap("CallbackUrls").SetMaxSize(1024)
		table.ColMap("Homepage").SetMaxSize(256)
		table.ColMap("IconURL").SetMaxSize(512)

		tableAuth := db.AddTableWithName(model.AuthData{}, "OAuthAuthData").SetKeys(false, "Code")
		tableAuth.ColMap("UserId").SetMaxSize(26)
		tableAuth.ColMap("ClientId").SetMaxSize(26)
		tableAuth.ColMap("Code").SetMaxSize(128)
		tableAuth.ColMap("RedirectUri").SetMaxSize(256)
		tableAuth.ColMap("State").SetMaxSize(1024)
		tableAuth.ColMap("Scope").SetMaxSize(128)

		tableAccess := db.AddTableWithName(model.AccessData{}, "OAuthAccessData").SetKeys(false, "Token")
		tableAccess.ColMap("ClientId").SetMaxSize(26)
		tableAccess.ColMap("UserId").SetMaxSize(26)
		tableAccess.ColMap("Token").SetMaxSize(26)
		tableAccess.ColMap("RefreshToken").SetMaxSize(26)
		tableAccess.ColMap("RedirectUri").SetMaxSize(256)
		tableAccess.ColMap("Scope").SetMaxSize(128)
		tableAccess.SetUniqueTogether("ClientId", "UserId")
	}

	return as
}

func (as SqlOAuthStore) CreateIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_oauthapps_creator_id", "OAuthApps", "CreatorId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_client_id", "OAuthAccessData", "ClientId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_user_id", "OAuthAccessData", "UserId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_refresh_token", "OAuthAccessData", "RefreshToken")
	as.CreateIndexIfNotExists("idx_oauthauthdata_client_id", "OAuthAuthData", "Code")
}

func (as SqlOAuthStore) SaveApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	if len(app.Id) > 0 {
		return nil, model.NewAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.existing.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
	}

	app.PreSave()
	if err := app.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(app); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.save.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	return app, nil
}

func (as SqlOAuthStore) UpdateApp(app *model.OAuthApp) (*model.OAuthApp, *model.AppError) {
	app.PreUpdate()

	if err := app.IsValid(); err != nil {
		return nil, err
	}

	oldAppResult, err := as.GetMaster().Get(model.OAuthApp{}, app.Id)
	if err != nil {
		return nil, model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.finding.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	if oldAppResult == nil {
		return nil, model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.find.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
	}

	oldApp := oldAppResult.(*model.OAuthApp)
	app.CreateAt = oldApp.CreateAt
	app.CreatorId = oldApp.CreatorId

	count, err := as.GetMaster().Update(app)
	if err != nil {
		return nil, model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.updating.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
	}
	if count != 1 {
		return nil, model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.update.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
	}
	return app, nil
}

func (as SqlOAuthStore) GetApp(id string) (*model.OAuthApp, *model.AppError) {
	obj, err := as.GetReplica().Get(model.OAuthApp{}, id)
	if err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.finding.app_error", nil, "app_id="+id+", "+err.Error(), http.StatusInternalServerError)
	}
	if obj == nil {
		return nil, model.NewAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.find.app_error", nil, "app_id="+id, http.StatusNotFound)
	}
	return obj.(*model.OAuthApp), nil
}

func (as SqlOAuthStore) GetAppByUser(userId string, offset, limit int) ([]*model.OAuthApp, *model.AppError) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps WHERE CreatorId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAppByUser", "store.sql_oauth.get_app_by_user.find.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
	}

	return apps, nil
}

func (as SqlOAuthStore) GetApps(offset, limit int) ([]*model.OAuthApp, *model.AppError) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAppByUser", "store.sql_oauth.get_apps.find.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}

	return apps, nil
}

func (as SqlOAuthStore) GetAuthorizedApps(userId string, offset, limit int) ([]*model.OAuthApp, *model.AppError) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps,
		`SELECT o.* FROM OAuthApps AS o INNER JOIN
			Preferences AS p ON p.Name=o.Id AND p.UserId=:UserId LIMIT :Limit OFFSET :Offset`, map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAuthorizedApps", "store.sql_oauth.get_apps.find.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}

	return apps, nil
}

func (as SqlOAuthStore) DeleteApp(id string) *model.AppError {
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

func (as SqlOAuthStore) SaveAccessData(accessData *model.AccessData) (*model.AccessData, *model.AppError) {
	if err := accessData.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(accessData); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.SaveAccessData", "store.sql_oauth.save_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessData(token string) (*model.AccessData, *model.AppError) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAccessData", "store.sql_oauth.get_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByUserForApp(userId, clientId string) ([]*model.AccessData, *model.AppError) {
	var accessData []*model.AccessData

	if _, err := as.GetReplica().Select(&accessData,
		"SELECT * FROM OAuthAccessData WHERE UserId = :UserId AND ClientId = :ClientId",
		map[string]interface{}{"UserId": userId, "ClientId": clientId}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAccessDataByUserForApp", "store.sql_oauth.get_access_data_by_user_for_app.app_error", nil, "user_id="+userId+" client_id="+clientId, http.StatusInternalServerError)
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByRefreshToken(token string) (*model.AccessData, *model.AppError) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE RefreshToken = :Token", map[string]interface{}{"Token": token}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAccessData", "store.sql_oauth.get_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetPreviousAccessData(userId, clientId string) (*model.AccessData, *model.AppError) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE ClientId = :ClientId AND UserId = :UserId",
		map[string]interface{}{"ClientId": clientId, "UserId": userId}); err != nil {
		if strings.Contains(err.Error(), "no rows") {
			return nil, nil
		}
		return nil, model.NewAppError("SqlOAuthStore.GetPreviousAccessData", "store.sql_oauth.get_previous_access_data.app_error", nil, err.Error(), http.StatusNotFound)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) UpdateAccessData(accessData *model.AccessData) (*model.AccessData, *model.AppError) {
	if err := accessData.IsValid(); err != nil {
		return nil, err
	}

	if _, err := as.GetMaster().Exec("UPDATE OAuthAccessData SET Token = :Token, ExpiresAt = :ExpiresAt, RefreshToken = :RefreshToken WHERE ClientId = :ClientId AND UserID = :UserId",
		map[string]interface{}{"Token": accessData.Token, "ExpiresAt": accessData.ExpiresAt, "RefreshToken": accessData.RefreshToken, "ClientId": accessData.ClientId, "UserId": accessData.UserId}); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.Update", "store.sql_oauth.update_access_data.app_error", nil,
			"clientId="+accessData.ClientId+",userId="+accessData.UserId+", "+err.Error(), http.StatusInternalServerError)
	}
	return accessData, nil
}

func (as SqlOAuthStore) RemoveAccessData(token string) *model.AppError {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
		return model.NewAppError("SqlOAuthStore.RemoveAccessData", "store.sql_oauth.remove_access_data.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (as SqlOAuthStore) RemoveAllAccessData() *model.AppError {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData", map[string]interface{}{}); err != nil {
		return model.NewAppError("SqlOAuthStore.RemoveAccessData", "store.sql_oauth.remove_access_data.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (as SqlOAuthStore) SaveAuthData(authData *model.AuthData) (*model.AuthData, *model.AppError) {
	authData.PreSave()
	if err := authData.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(authData); err != nil {
		return nil, model.NewAppError("SqlOAuthStore.SaveAuthData", "store.sql_oauth.save_auth_data.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return authData, nil
}

func (as SqlOAuthStore) GetAuthData(code string) (*model.AuthData, *model.AppError) {
	obj, err := as.GetReplica().Get(model.AuthData{}, code)
	if err != nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if obj == nil {
		return nil, model.NewAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.find.app_error", nil, "", http.StatusNotFound)
	}
	return obj.(*model.AuthData), nil
}

func (as SqlOAuthStore) RemoveAuthData(code string) *model.AppError {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE Code = :Code", map[string]interface{}{"Code": code})
	if err != nil {
		return model.NewAppError("SqlOAuthStore.RemoveAuthData", "store.sql_oauth.remove_auth_data.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (as SqlOAuthStore) PermanentDeleteAuthDataByUser(userId string) *model.AppError {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return model.NewAppError("SqlOAuthStore.RemoveAuthDataByUserId", "store.sql_oauth.permanent_delete_auth_data_by_user.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (as SqlOAuthStore) deleteApp(transaction *gorp.Transaction, clientId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM OAuthApps WHERE Id = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteOAuthAppSessions(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthAppSessions(transaction *gorp.Transaction, clientId string) *model.AppError {

	query := ""
	if as.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING OAuthAccessData o WHERE o.Token = s.Token AND o.ClientId = :Id"
	} else if as.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN OAuthAccessData o ON o.Token = s.Token WHERE o.ClientId = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteOAuthTokens(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthTokens(transaction *gorp.Transaction, clientId string) *model.AppError {
	if _, err := transaction.Exec("DELETE FROM OAuthAccessData WHERE ClientId = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
	}

	return as.deleteAppExtras(transaction, clientId)
}

func (as SqlOAuthStore) deleteAppExtras(transaction *gorp.Transaction, clientId string) *model.AppError {
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
