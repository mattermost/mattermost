// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlAppStore struct {
	*SqlStore
}

func NewSqlAppStore(sqlStore *SqlStore) AppStore {
	us := &SqlAppStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.App{}, "Apps").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("CreatorId").SetMaxSize(26)
		table.ColMap("ClientSecret").SetMaxSize(128)
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Description").SetMaxSize(512)
		table.ColMap("CallbackUrl").SetMaxSize(256)
		table.ColMap("Homepage").SetMaxSize(256)
	}

	return us
}

func (s SqlAppStore) UpgradeSchemaIfNeeded() {
}

func (as SqlAppStore) CreateIndexesIfNotExists() {
	as.CreateIndexIfNotExists("idx_creator_id", "Apps", "CreatorId")
}

func (as SqlAppStore) Save(app *model.App) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if len(app.Id) > 0 {
			result.Err = model.NewAppError("SqlAppStore.Save", "Must call update for exisiting app", "app_id="+app.Id)
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
			result.Err = model.NewAppError("SqlAppStore.Save", "We couldn't save the app.", "app_id="+app.Id+", "+err.Error())
		} else {
			result.Data = app
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlAppStore) Update(app *model.App) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		app.PreUpdate()

		if result.Err = app.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if oldAppResult, err := as.GetMaster().Get(model.App{}, app.Id); err != nil {
			result.Err = model.NewAppError("SqlAppStore.Update", "We encounted an error finding the app", "app_id="+app.Id+", "+err.Error())
		} else if oldAppResult == nil {
			result.Err = model.NewAppError("SqlAppStore.Update", "We couldn't find the existing app to update", "app_id="+app.Id)
		} else {
			oldApp := oldAppResult.(*model.App)
			app.CreateAt = oldApp.CreateAt
			app.ClientSecret = oldApp.ClientSecret
			app.CreatorId = oldApp.CreatorId

			if count, err := as.GetMaster().Update(app); err != nil {
				result.Err = model.NewAppError("SqlAppStore.Update", "We encounted an error updating the app", "app_id="+app.Id+", "+err.Error())
			} else if count != 1 {
				result.Err = model.NewAppError("SqlAppStore.Update", "We couldn't update the app", "app_id="+app.Id)
			} else {
				result.Data = [2]*model.App{app, oldApp}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (as SqlAppStore) Get(id string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if obj, err := as.GetReplica().Get(model.App{}, id); err != nil {
			result.Err = model.NewAppError("SqlAppStore.Get", "We encounted an error finding the app", "app_id="+id+", "+err.Error())
		} else if obj == nil {
			result.Err = model.NewAppError("SqlAppStore.Get", "We couldn't find the existing app", "app_id="+id)
		} else {
			result.Data = obj.(*model.App)
		}

		storeChannel <- result
		close(storeChannel)

	}()

	return storeChannel
}

func (as SqlAppStore) GetByUser(userId string) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var apps []*model.App

		if _, err := as.GetReplica().Select(&apps, "SELECT * FROM Apps WHERE CreatorId=?", userId); err != nil {
			result.Err = model.NewAppError("SqlAppStore.GetByUser", "We couldn't find any existing apps", "user_id="+userId+", "+err.Error())
		}

		result.Data = apps

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
