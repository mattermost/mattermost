// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type SqlPreferenceStore struct {
	*SqlStore
}

func NewSqlPreferenceStore(sqlStore *SqlStore) PreferenceStore {
	s := &SqlPreferenceStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Preference{}, "Preferences").SetKeys(false, "UserId", "Category", "Name", "AltId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Category").SetMaxSize(32)
		table.ColMap("Name").SetMaxSize(32)
		table.ColMap("AltId").SetMaxSize(26)
		table.ColMap("Value").SetMaxSize(128)
	}

	return s
}

func (s SqlPreferenceStore) UpgradeSchemaIfNeeded() {
}

func (s SqlPreferenceStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_preferences_user_id", "Preferences", "UserId")
	s.CreateIndexIfNotExists("idx_preferences_category", "Preferences", "Category")
	s.CreateIndexIfNotExists("idx_preferences_name", "Preferences", "Name")
}

func (s SqlPreferenceStore) Save(preference *model.Preference) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if result.Err = preference.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(preference); err != nil {
			if IsUniqueConstraintError(err.Error(), "UserId", "preferences_pkey") {
				result.Err = model.NewAppError("SqlPreferenceStore.Save", "A preference with that user id, category, name, and alt id already exists",
					"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", alt_id="+preference.AltId+", "+err.Error())
			} else {
				result.Err = model.NewAppError("SqlPreferenceStore.Save", "We couldn't save the preference",
					"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", alt_id="+preference.AltId+", "+err.Error())
			}
		} else {
			result.Data = preference
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) Update(preference *model.Preference) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if result.Err = preference.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if count, err := s.GetMaster().Update(preference); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Update", "We couldn't update the preference",
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", alt_id="+preference.AltId+", "+err.Error())
		} else if count != 1 {
			result.Err = model.NewAppError("SqlPreferenceStore.Update", "We couldn't update the preference",
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", alt_id="+preference.AltId)
		} else {
			result.Data = preference
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) GetByName(userId string, category string, name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var preferences []*model.Preference

		if _, err := s.GetReplica().Select(&preferences,
			`SELECT
				*
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, map[string]interface{}{"UserId": userId, "Category": category, "Name": name}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.GetByName", "We encounted an error while finding preferences", err.Error())
		} else {
			result.Data = preferences
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
