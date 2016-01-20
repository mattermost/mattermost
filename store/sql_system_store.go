// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type SqlSystemStore struct {
	*SqlStore
}

func NewSqlSystemStore(sqlStore *SqlStore) SystemStore {
	s := &SqlSystemStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.System{}, "Systems").SetKeys(false, "Name")
		table.ColMap("Name").SetMaxSize(64)
		table.ColMap("Value").SetMaxSize(1024)
	}

	return s
}

func (s SqlSystemStore) UpgradeSchemaIfNeeded() {
}

func (s SqlSystemStore) CreateIndexesIfNotExists() {
}

func (s SqlSystemStore) Save(T goi18n.TranslateFunc, system *model.System) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if err := s.GetMaster().Insert(system); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Save", "We encountered an error saving the system property", "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) Update(T goi18n.TranslateFunc, system *model.System) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Update(system); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Save", "We encountered an error updating the system property", "")
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlSystemStore) Get(T goi18n.TranslateFunc) StoreChannel {

	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var systems []model.System
		props := make(model.StringMap)
		if _, err := s.GetReplica().Select(&systems, "SELECT * FROM Systems"); err != nil {
			result.Err = model.NewAppError("SqlSystemStore.Get", "We encountered an error finding the system properties", "")
		} else {
			for _, prop := range systems {
				props[prop.Name] = prop.Value
			}

			result.Data = props
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
