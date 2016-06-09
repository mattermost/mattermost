// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"strings"
)

type SqlOAuthStore struct {
	*SqlStore
}

func NewSqlOAuthStore(sqlStore *SqlStore) OAuthStore {
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

		tableAuth := db.AddTableWithName(model.AuthData{}, "OAuthAuthData").SetKeys(false, "Code")
		tableAuth.ColMap("UserId").SetMaxSize(26)
		tableAuth.ColMap("ClientId").SetMaxSize(26)
		tableAuth.ColMap("Code").SetMaxSize(128)
		tableAuth.ColMap("RedirectUri").SetMaxSize(256)
		tableAuth.ColMap("State").SetMaxSize(128)
		tableAuth.ColMap("Scope").SetMaxSize(128)

		tableAccess := db.AddTableWithName(model.AccessData{}, "OAuthAccessData").SetKeys(false, "Token")
		tableAccess.ColMap("AuthCode").SetMaxSize(128)
		tableAccess.ColMap("Token").SetMaxSize(26)
		tableAccess.ColMap("RefreshToken").SetMaxSize(26)
		tableAccess.ColMap("RedirectUri").SetMaxSize(256)
	}

	return as
}

func (as SqlOAuthStore) UpgradeSchemaIfNeeded() {
}

func (as SqlOAuthStore) CreateIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_oauthapps_creator_id", "OAuthApps", "CreatorId")
	as.CreateIndexIfNotExists("idx_oauthaccessdata_auth_code", "OAuthAccessData", "AuthCode")
	as.CreateIndexIfNotExists("idx_oauthauthdata_client_id", "OAuthAuthData", "Code")
}

func (as SqlOAuthStore) SaveApp(app *model.OAuthApp) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(app.Id) > 0 {
			result.Err = model.NewLocAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.existing.app_error", nil, "app_id="+app.Id)
			storeChannel <- result
			close(storeChannel)
			return
		}

		app.PreSave()
		if result.Err = app.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := as.GetMaster().Insert(app); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.SaveApp", "store.sql_oauth.save_app.save.app_error", nil, "app_id="+app.Id+", "+err.Error())
		} else {
			result.Data = app
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) UpdateApp(app *model.OAuthApp) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		app.PreUpdate()

		if result.Err = app.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldAppResult, err := as.GetMaster().Get(model.OAuthApp{}, app.Id); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.finding.app_error", nil, "app_id="+app.Id+", "+err.Error())
		} else if oldAppResult == nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.find.app_error", nil, "app_id="+app.Id)
		} else {
			oldApp := oldAppResult.(*model.OAuthApp)
			app.CreateAt = oldApp.CreateAt
			app.ClientSecret = oldApp.ClientSecret
			app.CreatorId = oldApp.CreatorId

			if count, err := as.GetMaster().Update(app); err != nil {
				result.Err = model.NewLocAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.updating.app_error", nil, "app_id="+app.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewLocAppError("SqlOAuthStore.UpdateApp", "store.sql_oauth.update_app.update.app_error", nil, "app_id="+app.Id)
			} else {
				result.Data = [2]*model.OAuthApp{app, oldApp}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) GetApp(id string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := as.GetReplica().Get(model.OAuthApp{}, id); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.finding.app_error", nil, "app_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetApp", "store.sql_oauth.get_app.find.app_error", nil, "app_id="+id)
		} else {
			result.Data = obj.(*model.OAuthApp)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlOAuthStore) GetAppByUser(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var apps []*model.OAuthApp

		if _, err := as.GetReplica().Select(&apps, "SELECT * FROM OAuthApps WHERE CreatorId = :UserId", map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetAppByUser", "store.sql_oauth.get_app_by_user.find.app_error", nil, "user_id="+userId+", "+err.Error())
		}

		result.Data = apps

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) DeleteApp(id string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := as.GetMaster().Exec("DELETE FROM OAuthApps WHERE Id = :Id", map[string]interface{}{"Id": id})
		if err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.DeleteApp", "store.sql_oauth.delete_app.app_error", nil, "id="+id+", err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) SaveAccessData(accessData *model.AccessData) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if result.Err = accessData.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := as.GetMaster().Insert(accessData); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.SaveAccessData", "store.sql_oauth.save_access_data.app_error", nil, err.Error())
		} else {
			result.Data = accessData
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) GetAccessData(token string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetAccessData", "store.sql_oauth.get_access_data.app_error", nil, err.Error())
		} else {
			result.Data = &accessData
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlOAuthStore) GetAccessDataByAuthCode(authCode string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		accessData := model.AccessData{}

		if err := as.GetReplica().SelectOne(&accessData, "SELECT * FROM OAuthAccessData WHERE AuthCode = :AuthCode", map[string]interface{}{"AuthCode": authCode}); err != nil {
			if strings.Contains(err.Error(), "no rows") {
				result.Data = nil
			} else {
				result.Err = model.NewLocAppError("SqlOAuthStore.GetAccessDataByAuthCode", "store.sql_oauth.get_access_data_by_code.app_error", nil, err.Error())
			}
		} else {
			result.Data = &accessData
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlOAuthStore) RemoveAccessData(token string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := as.GetMaster().Exec("DELETE FROM OAuthAccessData WHERE Token = :Token", map[string]interface{}{"Token": token}); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.RemoveAccessData", "store.sql_oauth.remove_access_data.app_error", nil, "err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) SaveAuthData(authData *model.AuthData) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		authData.PreSave()
		if result.Err = authData.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := as.GetMaster().Insert(authData); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.SaveAuthData", "store.sql_oauth.save_auth_data.app_error", nil, err.Error())
		} else {
			result.Data = authData
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) GetAuthData(code string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := as.GetReplica().Get(model.AuthData{}, code); err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.finding.app_error", nil, err.Error())
		} else if obj == nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.GetAuthData", "store.sql_oauth.get_auth_data.find.app_error", nil, "")
		} else {
			result.Data = obj.(*model.AuthData)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlOAuthStore) RemoveAuthData(code string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE Code = :Code", map[string]interface{}{"Code": code})
		if err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.RemoveAuthData", "store.sql_oauth.remove_auth_data.app_error", nil, "err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlOAuthStore) PermanentDeleteAuthDataByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		_, err := as.GetMaster().Exec("DELETE FROM OAuthAuthData WHERE UserId = :UserId", map[string]interface{}{"UserId": userId})
		if err != nil {
			result.Err = model.NewLocAppError("SqlOAuthStore.RemoveAuthDataByUserId", "store.sql_oauth.permanent_delete_auth_data_by_user.app_error", nil, "err="+err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
