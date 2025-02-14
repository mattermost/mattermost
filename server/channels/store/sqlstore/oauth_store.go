// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	sq "github.com/mattermost/squirrel"
)

type SqlOAuthStore struct {
	*SqlStore
	oAuthAppsSelectQuery sq.SelectBuilder
	oAuthAccessDataQuery sq.SelectBuilder
	oAuthAuthDataQuery   sq.SelectBuilder
}

func newSqlOAuthStore(sqlStore *SqlStore) store.OAuthStore {
	s := SqlOAuthStore{
		SqlStore: sqlStore,
	}

	s.oAuthAppsSelectQuery = s.getQueryBuilder().
		Select("o.Id", "o.CreatorId", "o.CreateAt", "o.UpdateAt", "o.ClientSecret", "o.Name", "o.Description", "o.IconURL", "o.CallbackUrls", "o.Homepage", "o.IsTrusted", "o.MattermostAppID").
		From("OAuthApps o")

	s.oAuthAccessDataQuery = s.getQueryBuilder().
		Select("ClientId", "UserId", "Token", "RefreshToken", "RedirectUri", "ExpiresAt", "Scope").
		From("OAuthAccessData")

	s.oAuthAuthDataQuery = s.getQueryBuilder().
		Select("ClientId", "UserId", "Code", "ExpiresIn", "CreateAt", "RedirectUri", "State", "Scope").
		From("OAuthAuthData")

	return &s
}

func (as SqlOAuthStore) SaveApp(app *model.OAuthApp) (*model.OAuthApp, error) {
	if app.Id != "" {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}

	app.PreSave()
	if err := app.IsValid(); err != nil {
		return nil, err
	}

	if _, err := as.GetMaster().NamedExec(`INSERT INTO OAuthApps
		(Id, CreatorId, CreateAt, UpdateAt, ClientSecret, Name, Description, IconURL, CallbackUrls, Homepage, IsTrusted, MattermostAppID)
		VALUES
		(:Id, :CreatorId, :CreateAt, :UpdateAt, :ClientSecret, :Name, :Description, :IconURL, :CallbackUrls, :Homepage, :IsTrusted, :MattermostAppID)`, app); err != nil {
		return nil, errors.Wrap(err, "failed to save OAuthApp")
	}
	return app, nil
}

func (as SqlOAuthStore) UpdateApp(app *model.OAuthApp) (*model.OAuthApp, error) {
	app.PreUpdate()

	if err := app.IsValid(); err != nil {
		return nil, err
	}

	var oldApp model.OAuthApp
	query := as.oAuthAppsSelectQuery.Where(sq.Eq{"o.Id": app.Id})

	err := as.GetReplica().GetBuilder(&oldApp, query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get OAuthApp with id=%s", app.Id)
	}
	if oldApp.Id == "" {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}

	app.CreateAt = oldApp.CreateAt
	app.CreatorId = oldApp.CreatorId

	res, err := as.GetMaster().NamedExec(`UPDATE OAuthApps
		SET UpdateAt=:UpdateAt, ClientSecret=:ClientSecret, Name=:Name,
			Description=:Description, IconURL=:IconURL, CallbackUrls=:CallbackUrls,
			Homepage=:Homepage, IsTrusted=:IsTrusted, MattermostAppID=:MattermostAppID
		WHERE Id=:Id`, app)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to update OAuthApp with id=%s", app.Id)
	}
	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if count > 1 {
		return nil, store.NewErrInvalidInput("OAuthApp", "Id", app.Id)
	}
	return app, nil
}

func (as SqlOAuthStore) GetApp(id string) (*model.OAuthApp, error) {
	var app model.OAuthApp
	query := as.oAuthAppsSelectQuery.Where(sq.Eq{"o.Id": id})

	if err := as.GetReplica().GetBuilder(&app, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("OAuthApp", id)
		}
		return nil, errors.Wrapf(err, "failed to get OAuthApp with id=%s", id)
	}
	if app.Id == "" {
		return nil, store.NewErrNotFound("OAuthApp", id)
	}
	return &app, nil
}

func (as SqlOAuthStore) GetAppByUser(userId string, offset, limit int) ([]*model.OAuthApp, error) {
	apps := []*model.OAuthApp{}

	query := as.oAuthAppsSelectQuery.Where(sq.Eq{"o.CreatorId": userId}).Limit(uint64(limit)).Offset(uint64(offset))

	if err := as.GetReplica().SelectBuilder(&apps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthApps with userId=%s", userId)
	}

	return apps, nil
}

func (as SqlOAuthStore) GetApps(offset, limit int) ([]*model.OAuthApp, error) {
	apps := []*model.OAuthApp{}

	query := as.oAuthAppsSelectQuery.Limit(uint64(limit)).Offset(uint64(offset))

	if err := as.GetReplica().SelectBuilder(&apps, query); err != nil {
		return nil, errors.Wrap(err, "failed to find OAuthApps")
	}

	return apps, nil
}

func (as SqlOAuthStore) GetAuthorizedApps(userId string, offset, limit int) ([]*model.OAuthApp, error) {
	apps := []*model.OAuthApp{}

	query := as.oAuthAppsSelectQuery.
		InnerJoin("Preferences AS p ON p.Name = o.Id AND p.UserId = ?", userId).
		Limit(uint64(limit)).
		Offset(uint64(offset))

	if err := as.GetReplica().SelectBuilder(&apps, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthApps with userId=%s", userId)
	}

	return apps, nil
}

func (as SqlOAuthStore) DeleteApp(id string) (err error) {
	// wrap in a transaction so that if one fails, everything fails
	transaction, err := as.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

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

	if _, err := as.GetMaster().NamedExec(`INSERT INTO OAuthAccessData
		(ClientId, UserId, Token, RefreshToken, RedirectUri, ExpiresAt, Scope)
		VALUES
		(:ClientId, :UserId, :Token, :RefreshToken, :RedirectUri, :ExpiresAt, :Scope)`, accessData); err != nil {
		return nil, errors.Wrap(err, "failed to save AccessData")
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessData(token string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	query := as.oAuthAccessDataQuery.Where(sq.Eq{"Token": token})

	if err := as.GetReplica().GetBuilder(&accessData, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get OAuthAccessData with token=%s", token)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByUserForApp(userID, clientID string) ([]*model.AccessData, error) {
	accessData := []*model.AccessData{}

	query := as.oAuthAccessDataQuery.Where(sq.Eq{"UserId": userID, "ClientId": clientID})

	if err := as.GetReplica().SelectBuilder(&accessData, query); err != nil {
		return nil, errors.Wrapf(err, "failed to delete OAuthAccessData with userId=%s and clientId=%s", userID, clientID)
	}
	return accessData, nil
}

func (as SqlOAuthStore) GetAccessDataByRefreshToken(token string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	query := as.oAuthAccessDataQuery.Where(sq.Eq{"RefreshToken": token})

	if err := as.GetReplica().GetBuilder(&accessData, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find OAuthAccessData with refreshToken=%s", token)
	}
	return &accessData, nil
}

func (as SqlOAuthStore) GetPreviousAccessData(userID, clientID string) (*model.AccessData, error) {
	accessData := model.AccessData{}

	query := as.oAuthAccessDataQuery.Where(sq.Eq{"UserId": userID, "ClientId": clientID}).
		OrderBy("ExpiresAt DESC").Limit(1)

	if err := as.GetReplica().GetBuilder(&accessData, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, errors.Wrapf(err, "failed to find OAuthAccessData with userId=%s and clientId=%s", userID, clientID)
	}

	return &accessData, nil
}

func (as SqlOAuthStore) UpdateAccessData(accessData *model.AccessData) (*model.AccessData, error) {
	if err := accessData.IsValid(); err != nil {
		return nil, err
	}

	if _, err := as.GetMaster().NamedExec("UPDATE OAuthAccessData SET Token = :Token, ExpiresAt = :ExpiresAt, RefreshToken = :RefreshToken WHERE ClientId = :ClientId AND UserID = :UserId", accessData); err != nil {
		return nil, errors.Wrapf(err, "failed to update OAuthAccessData with userId=%s and clientId=%s", accessData.UserId, accessData.ClientId)
	}
	return accessData, nil
}

func (as SqlOAuthStore) RemoveAccessData(token string) error {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE Token = ?", token); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with token=%s", token)
	}
	return nil
}

func (as SqlOAuthStore) RemoveAllAccessData() error {
	if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData"); err != nil {
		return errors.Wrap(err, "failed to delete OAuthAccessData")
	}
	return nil
}

func (as SqlOAuthStore) SaveAuthData(authData *model.AuthData) (*model.AuthData, error) {
	authData.PreSave()
	if err := authData.IsValid(); err != nil {
		return nil, err
	}

	if _, err := as.GetMaster().NamedExec(`INSERT INTO OAuthAuthData
		(ClientId, UserId, Code, ExpiresIn, CreateAt, RedirectUri, State, Scope)
		VALUES
		(:ClientId, :UserId, :Code, :ExpiresIn, :CreateAt, :RedirectUri, :State, :Scope)`, authData); err != nil {
		return nil, errors.Wrap(err, "failed to save AuthData")
	}
	return authData, nil
}

func (as SqlOAuthStore) GetAuthData(code string) (*model.AuthData, error) {
	var authData model.AuthData

	query := as.oAuthAuthDataQuery.Where(sq.Eq{"Code": code})

	if err := as.GetReplica().GetBuilder(&authData, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("AuthData", fmt.Sprintf("code=%s", code))
		}
		return nil, errors.Wrapf(err, "failed to get AuthData with code=%s", code)
	}

	if authData.Code == "" {
		return nil, store.NewErrNotFound("AuthData", fmt.Sprintf("code=%s", code))
	}

	return &authData, nil
}

func (as SqlOAuthStore) RemoveAuthData(code string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE Code = ?", code)
	if err != nil {
		return errors.Wrapf(err, "failed to delete AuthData with code=%s", code)
	}
	return nil
}

func (as SqlOAuthStore) RemoveAuthDataByClientId(clientId string, userId string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE ClientId = ? and UserId = ?", clientId, userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete AuthData with clientId=%s and userId=%s", clientId, userId)
	}
	return nil
}

func (as SqlOAuthStore) RemoveAuthDataByUserId(userId string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete AuthData with userId=%s", userId)
	}
	return nil
}

func (as SqlOAuthStore) PermanentDeleteAuthDataByUser(userId string) error {
	_, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE UserId = ?", userId)
	if err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with userId=%s", userId)
	}
	return nil
}

func (as SqlOAuthStore) deleteApp(transaction *sqlxTxWrapper, clientId string) error {
	if _, err := transaction.Exec("DELETE FROM OAuthApps WHERE Id = ?", clientId); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthApp with id=%s", clientId)
	}

	return as.deleteOAuthAppSessions(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthAppSessions(transaction *sqlxTxWrapper, clientId string) error {
	query := ""
	if as.DriverName() == model.DatabaseDriverPostgres {
		query = "DELETE FROM Sessions s USING OAuthAccessData o WHERE o.Token = s.Token AND o.ClientId = ?"
	} else if as.DriverName() == model.DatabaseDriverMysql {
		query = "DELETE s.* FROM Sessions s INNER JOIN OAuthAccessData o ON o.Token = s.Token WHERE o.ClientId = ?"
	}

	if _, err := transaction.Exec(query, clientId); err != nil {
		return errors.Wrapf(err, "failed to delete Session with OAuthAccessData.Id=%s", clientId)
	}

	return as.deleteOAuthTokens(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthTokens(transaction *sqlxTxWrapper, clientId string) error {
	if _, err := transaction.Exec("DELETE FROM OAuthAccessData WHERE ClientId = ?", clientId); err != nil {
		return errors.Wrapf(err, "failed to delete OAuthAccessData with id=%s", clientId)
	}

	return as.deleteAppExtras(transaction, clientId)
}

func (as SqlOAuthStore) deleteAppExtras(transaction *sqlxTxWrapper, clientId string) error {
	if _, err := transaction.Exec(
		`DELETE FROM
			Preferences
		WHERE
			Category = ?
			AND Name = ?`, model.PreferenceCategoryAuthorizedOAuthApp, clientId); err != nil {
		return errors.Wrapf(err, "failed to delete Preferences with name=%s", clientId)
	}

	return nil
}
