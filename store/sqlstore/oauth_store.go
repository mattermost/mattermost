// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"
	"strings"

	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
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
		tableAuth.ColMap("State").SetMaxSize(128)
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

func (as SqlOAuthStore) SaveApp(app *model.OAuthApp) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if len(app.Id) > 0 {
			result.Err = model.NewAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.existing.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
			return
		}

		app.PreSave()
		if result.Err = app.IsValid(); result.Err != nil {
			return
		}

		if err := as.GetMaster().Insert(app); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.save.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = app
		}
	})
}

func (as SqlOAuthStore) UpdateApp(app *model.OAuthApp) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		app.PreUpdate()

		if result.Err = app.IsValid(); result.Err != nil {
			return
		}

		if oldAppResult, err := as.GetMaster().Get(model.OAuthApp{}, app.Id); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.finding.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
		} else if oldAppResult == nil {
			result.Err = model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.find.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
		} else {
			oldApp := oldAppResult.(*model.OAuthApp)
			app.CreateAt = oldApp.CreateAt
			app.CreatorId = oldApp.CreatorId

			if count, err := as.GetMaster().Update(app); err != nil {
				result.Err = model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.updating.app_error", nil, "app_id="+app.Id+", "+err.Error(), http.StatusInternalServerError)
			} else if count != 1 {
				result.Err = model.NewAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.update.app_error", nil, "app_id="+app.Id, http.StatusBadRequest)
			} else {
				result.Data = [2]*model.OAuthApp{app, oldApp}
			}
		}
	})
}

func (as SqlOAuthStore) GetApp(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if obj, err := as.GetReplica().Get(model.OAuthApp{}, id); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.finding.app_error", nil, "app_id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.find.app_error", nil, "app_id="+id, http.StatusNotFound)
		} else {
			result.Data = obj.(*model.OAuthApp)
		}
	})
}

func (as SqlOAuthStore) GetAppByUser(userId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var apps []*model.OAuthApp

		if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps WHERE CreatorId = :UserId LIMIT :Limit OFFSET :Offset", map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAppByUser", "store.sql_oauth.get_app_by_user.find.app_error", nil, "user_id="+userId+", "+err.Error(), http.StatusInternalServerError)
		}

		result.Data = apps
	})
}

func (as SqlOAuthStore) GetApps(offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var apps []*model.OAuthApp

		if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps LIMIT :Limit OFFSET :Offset", map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAppByUser", "store.sql_oauth.get_apps.find.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = apps
	})
}

func (as SqlOAuthStore) GetAuthorizedApps(userId string, offset, limit int) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var apps []*model.OAuthApp

		if _, err := as.GetReplica().Select(&apps,
			`SELECT o.* FROM OAuthApps AS o INNER JOIN
			Preferences AS p ON p.Name=o.Id AND p.UserId=:UserId LIMIT :Limit OFFSET :Offset`, map[string]interface{}{"UserId": userId, "Offset": offset, "Limit": limit}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAuthorizedApps", "store.sql_oauth.get_apps.find.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		result.Data = apps
	})
}

func (as SqlOAuthStore) DeleteApp(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		// wrap in a transaction so that if one fails, everything fails
		transaction, err := as.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if extrasResult := as.deleteApp(transaction, id); extrasResult.Err != nil {
				*result = extrasResult
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete.rollback_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}
	})
}

func (as SqlOAuthStore) SaveAccessData(accessData *model.AccessData) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = accessData.IsValid(); result.Err != nil {
			return
		}

		if err := as.GetMaster().Insert(accessData); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.SaveAccessData", "store.sql_oauth.save_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = accessData
		}
	})
}

func (as SqlOAuthStore) GetAccessData(token string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAccessData", "store.sql_oauth.get_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = &accessData
		}
	})
}

func (as SqlOAuthStore) GetAccessDataByUserForApp(userId, clientId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var accessData []*model.AccessData

		if _, err := as.GetReplica().Select(&accessData,
			"SELECT * FROM OAuthAccessData WHERE UserId = :UserId AND ClientId = :ClientId",
			map[string]interface{}{"UserId": userId, "ClientId": clientId}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAccessDataByUserForApp", "store.sql_oauth.get_access_data_by_user_for_app.app_error", nil, "user_id="+userId+" client_id="+clientId, http.StatusInternalServerError)
		} else {
			result.Data = accessData
		}
	})
}

func (as SqlOAuthStore) GetAccessDataByRefreshToken(token string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE RefreshToken = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAccessData", "store.sql_oauth.get_access_data.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = &accessData
		}
	})
}

func (as SqlOAuthStore) GetPreviousAccessData(userId, clientId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE ClientId = :ClientId AND UserId = :UserId",
			map[string]interface{}{"ClientId": clientId, "UserId": userId}); err != nil {
			if strings.Contains(err.Error(), "no rows") {
				result.Data = nil
			} else {
				result.Err = model.NewAppError("SqlOAuthStore.GetPreviousAccessData", "store.sql_oauth.get_previous_access_data.app_error", nil, err.Error(), http.StatusNotFound)
			}
		} else {
			result.Data = &accessData
		}
	})
}

func (as SqlOAuthStore) UpdateAccessData(accessData *model.AccessData) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = accessData.IsValid(); result.Err != nil {
			return
		}

		if _, err := as.GetMaster().Exec("UPDATE OAuthAccessData SET Token = :Token, ExpiresAt = :ExpiresAt, RefreshToken = :RefreshToken WHERE ClientId = :ClientId AND UserID = :UserId",
			map[string]interface{}{"Token": accessData.Token, "ExpiresAt": accessData.ExpiresAt, "RefreshToken": accessData.RefreshToken, "ClientId": accessData.ClientId, "UserId": accessData.UserId}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.Update", "store.sql_oauth.update_access_data.app_error", nil,
				"clientId="+accessData.ClientId+",userId="+accessData.UserId+", "+err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = accessData
		}
	})
}

func (as SqlOAuthStore) RemoveAccessData(token string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.RemoveAccessData", "store.sql_oauth.remove_access_data.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (as SqlOAuthStore) SaveAuthData(authData *model.AuthData) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		authData.PreSave()
		if result.Err = authData.IsValid(); result.Err != nil {
			return
		}

		if err := as.GetMaster().Insert(authData); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.SaveAuthData", "store.sql_oauth.save_auth_data.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = authData
		}
	})
}

func (as SqlOAuthStore) GetAuthData(code string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if obj, err := as.GetReplica().Get(model.AuthData{}, code); err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.find.app_error", nil, "", http.StatusNotFound)
		} else {
			result.Data = obj.(*model.AuthData)
		}
	})
}

func (as SqlOAuthStore) RemoveAuthData(code string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE Code = :Code", map[string]interface{}{"Code": code})
		if err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.RemoveAuthData", "store.sql_oauth.remove_auth_data.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (as SqlOAuthStore) PermanentDeleteAuthDataByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		_, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewAppError("SqlOAuthStore.RemoveAuthDataByUserId", "store.sql_oauth.permanent_delete_auth_data_by_user.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	})
}

func (as SqlOAuthStore) deleteApp(transaction *gorp.Transaction, clientId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM OAuthApps WHERE Id = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return as.deleteOAuthAppSessions(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthAppSessions(transaction *gorp.Transaction, clientId string) store.StoreResult {
	result := store.StoreResult{}

	query := ""
	if as.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		query = "DELETE FROM Sessions s USING OAuthAccessData o WHERE o.Token = s.Token AND o.ClientId = :Id"
	} else if as.DriverName() == model.DATABASE_DRIVER_MYSQL {
		query = "DELETE s.* FROM Sessions s INNER JOIN OAuthAccessData o ON o.Token = s.Token WHERE o.ClientId = :Id"
	}

	if _, err := transaction.Exec(query, map[string]interface{}{"Id": clientId}); err != nil {
		result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return as.deleteOAuthTokens(transaction, clientId)
}

func (as SqlOAuthStore) deleteOAuthTokens(transaction *gorp.Transaction, clientId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec("DELETE FROM OAuthAccessData WHERE ClientId = :Id", map[string]interface{}{"Id": clientId}); err != nil {
		result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+clientId+", err="+err.Error(), http.StatusInternalServerError)
		return result
	}

	return as.deleteAppExtras(transaction, clientId)
}

func (as SqlOAuthStore) deleteAppExtras(transaction *gorp.Transaction, clientId string) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Exec(
		`DELETE FROM
			Preferences
		WHERE
			Category = :Category
			AND Name = :Name`, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_AUTHORIZED_OAUTH_APP, "Name": clientId}); err != nil {
		result.Err = model.NewAppError("SqlOAuthStore.DeleteApp", "store.sql_preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		return result
	}

	return result
}
