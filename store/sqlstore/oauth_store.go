// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/mattermost/gorp"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlOAuthStore struct {
	*SqlStore
}

func newSqlOAuthStore(sqlStore *SqlStore) store.OAuthStore {
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

func (as SqlOAuthStore) createIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_oauthapps_creator_id", "OAuthApps", "CreatorId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_client_id", "OAuthAccessData", "ClientId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_user_id", "OAuthAccessData", "UserId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_refresh_token", "OAuthAccessData", "RefreshToken")
	as.CreateIndexIfNotExists("idx_oauthauthdata_client_id", "OAuthAuthData", "Code")
}

func (as SqlOAuthStore) SaveApp(app *model.OAuthApp) (*model.OAuthApp, error) {
	if app.Id != "" {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}

	app.PreSave()
	if err := app.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(app); err != nil {
		return nil, errors.Wrap(err, "failed to save OAuthApp")
	}
	return app, nil
}

func (as SqlOAuthStore) UpdateApp(app *model.OAuthApp) (*model.OAuthApp, error) {
	app.PreUpdate()

	if err := app.IsValid(); err != nil {
		return nil, err
	}

	oldAppResult, err := as.GetMaster().Get(model.OAuthApp{}, app.Id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get OAuthApp with id=%s", app.Id)
	}
	if oldAppResult == nil {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}

	oldApp := oldAppResult.(*model.OAuthApp)
	app.CreateAt = oldApp.CreateAt
	app.CreatorId = oldApp.CreatorId

	count, err := as.GetMaster().Update(app)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update OAuthApp with id=%s", app.Id)
	}
	if count > 1 {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}
	return app, nil
}

func (as SqlOAuthStore) GetApp(id string) (*model.OAuthApp, error) {
	obj, err := as.GetReplica().Get(model.OAuthApp{}, id)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get OAuthApp with id=%s", id)
	}
	if obj == nil {
		return nil, store.NewErrNotFound("OAuthApp", id)
	}
	return obj.(*model.OAuthApp), nil
}

func (as SqlOAuthStore) GetAppByUser(userId string, offset, limit int) ([]*model.OAuthApp, error) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps WHERE CreatorId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthApps with userId=%s", userId)
	}

	return apps, nil
}

func (as SqlOAuthStore) GetApps(offset, limit int) ([]*model.OAuthApp, error) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, errors.Wrap(err, "failed to find OAuthApps")
	}

	return apps, nil
}

func (as SqlOAuthStore) GetAuthorizedApps(userId string, offset, limit int) ([]*model.OAuthApp, error) {
	var apps []*model.OAuthApp

	if _, err := as.GetReplica().Select(&apps,
		`SELECT o.* FROM OAuthApps AS o INNER JOIN
			Preferences AS p ON p.Name=o.Id AND p.UserId=:UserId LIMIT :Limit OFFSET :Offset`, map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthApps with userId=%s", userId)
	}

	return apps, nil
}

func (as SqlOAuthStore) DeleteApp(id string) error {
	// wrap in a transaction so that if one fails, everything fails
	transaction, err := as.GetMaster().Begin()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransaction(transaction)

	if err := as.deleteApp(transaction, id); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (as SqlOAuthStore) SaveAccessData(accessData *model.AccessData) (*model.AccessData, error) {
	if err := accessData.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(accessData); err != nil {
		return nil, errors.Wrap(err, "failed to save AccessData")
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessData(token string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
		return nil, errors.Wrapf(err, "failed to get OAuthAccessData with token=%s", token)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByUserForApp(userId, clientId string) ([]*model.AccessData, error) {
	var accessData []*model.AccessData

	if _, err := as.GetReplica().Select(&accessData,
		"SELECT * FROM OAuthAccessData WHERE UserId = :UserId AND ClientId = :ClientId",
		map[string]interface{}{"UserId": userId, "ClientId": clientId}); err != nil {
		return nil, errors.Wrapf(err, "failed to delete OAuthAccessData with userId=%s and clientId=%s", userId, clientId)
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByRefreshToken(token string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE RefreshToken = :Token", map[string]interface{}{"Token": token}); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthAccessData with refreshToken=%s", token)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetPreviousAccessData(userId, clientId string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE ClientId = :ClientId AND UserId = :UserId",
		map[string]interface{}{"ClientId": clientId, "UserId": userId}); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}

		return nil, errors.Wrapf(err, "failed to get AccessData with clientId=%s and userId=%s", clientId, userId)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) UpdateAccessData(accessData *model.AccessData) (*model.AccessData, error) {
	if err := accessData.IsValid(); err != nil {
		return nil, err
	}

	if _, err := as.GetMaster().Exec("UPDATE OAuthAccessData SET Token = :Token, ExpiresAt = :ExpiresAt, RefreshToken = :RefreshToken WHERE ClientId = :ClientId AND UserID = :UserId",
		map[string]interface{}{"Token": accessData.Token, "ExpiresAt": accessData.ExpiresAt, "RefreshToken": accessData.RefreshToken, "ClientId": accessData.ClientId, "UserId": accessData.UserId}); err != nil {
		return nil, errors.Wrapf(err, "failed to update OAuthAccessData with userId=%s and clientId=%s", accessData.UserId, accessData.ClientId)
	}
	return accessData, nil
}

func (as SqlOAuthStore) RemoveAccessData(token string) error {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with token=%s", token)
	}
	return nil
}

func (as SqlOAuthStore) RemoveAllAccessData() error {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData", map[string]interface{}{}); err != nil {
		return errors.Wrap(err, "failed to delete OAuthAccessData")
	}
	return nil
}

func (as SqlOAuthStore) SaveAuthData(authData *model.AuthData) (*model.AuthData, error) {
	authData.PreSave()
	if err := authData.IsValid(); err != nil {
		return nil, err
	}

	if err := as.GetMaster().Insert(authData); err != nil {
		return nil, errors.Wrap(err, "failed to save AuthData")
	}
	return authData, nil
}

func (as SqlOAuthStore) GetAuthData(code string) (*model.AuthData, error) {
	obj, err := as.GetReplica().Get(model.AuthData{}, code)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get AuthData with code=%s", code)
	}
	if obj == nil {
		return nil, store.NewErrNotFound("AuthData", fmt.Sprintf("code=%s", code))
	}
	return obj.(*model.AuthData), nil
}

func (as SqlOAuthStore) RemoveAuthData(code string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE Code = :Code", map[string]interface{}{"Code": code})
	if err != nil {
		return errors.Wrapf(err, "failed to delete AuthData with code=%s", code)
	}
	return nil
}

func (as SqlOAuthStore) PermanentDeleteAuthDataByUser(userId string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
	if err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with userId=%s", userId)
	}
	return nil
}

func (as SqlOAuthStore) deleteApp(transaction *gorp.Transaction, clientId string) error {
	if _, err := transaction.Exec("DELETE FROM OAuthApps WHERE Id = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthApp with id=%s", clientId)
	}

	return as.deleteOAuthAppSessions(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthAppSessions(transaction *gorp.Transaction, clientId string) error {

	query := ""
	if as.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING OAuthAccessData o WHERE o.Token = s.Token AND o.ClientId = :Id"
	} else if as.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN OAuthAccessData o ON o.Token = s.Token WHERE o.ClientId = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": clientId}); err != nil {
		return errors.Wrapf(err, "failed to delete Session with OAuthAccessData.Id=%s", clientId)
	}

	return as.deleteOAuthTokens(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthTokens(transaction *gorp.Transaction, clientId string) error {
	if _, err := transaction.Exec("DELETE FROM OAuthAccessData WHERE ClientId = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with id=%s", clientId)
	}

	return as.deleteAppExtras(transaction, clientId)
}

func (as SqlOAuthStore) deleteAppExtras(transaction *gorp.Transaction, clientId string) error {
	if _, err := transaction.Exec(
		`DELETE FROM
			Preferences
		WHERE
			Category = :Category
			AND Name = :Name`, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, "Name": clientId}); err != nil {
		return errors.Wrapf(err, "failed to delete Preferences with name=%s", clientId)
	}

	return nil
}
