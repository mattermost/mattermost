// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/go-gorp/gorp"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type SqlPreferenceStore struct {
	*SqlStore
}

func NewSqlPreferenceStore(sqlStore *SqlStore) PreferenceStore {
	s := &SqlPreferenceStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Preference{}, "Preferences").SetKeys(false, "UserId", "Category", "Name")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Category").SetMaxSize(32)
		table.ColMap("Name").SetMaxSize(32)
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

func (s SqlPreferenceStore) Save(preferences *model.Preferences) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		// wrap in a transaction so that if one fails, everything fails
		transaction, err := s.GetReplica().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Save", "Unable to open transaction to save preferences", err.Error())
		} else {
			for _, preference := range *preferences {
				if upsertResult := s.save(transaction, &preference); upsertResult.Err != nil {
					result = upsertResult
					break
				}
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlPreferenceStore.Save", "Unable to commit transaction to save preferences", err.Error())
				} else {
					result.Data = len(*preferences)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlPreferenceStore.Save", "Unable to rollback transaction to save preferences", err.Error())
				}
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) save(transaction *gorp.Transaction, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if result.Err = preference.IsValid(); result.Err != nil {
		return result
	}

	params := map[string]interface{}{
		"UserId":   preference.UserId,
		"Category": preference.Category,
		"Name":     preference.Name,
		"Value":    preference.Value,
	}

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		if _, err := transaction.Exec(
			`INSERT INTO
				Preferences
				(UserId, Category, Name, Value)
			VALUES
				(:UserId, :Category, :Name, :Value)
			ON DUPLICATE KEY UPDATE
				Value = :Value`, params); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.save", "We encountered an error while updating preferences", err.Error())
		}
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		// postgres has no way to upsert values until version 9.5 and trying inserting and then updating causes transactions to abort
		count, err := transaction.SelectInt(
			`SELECT
				count(0)
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, params)
		if err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.save", "We encountered an error while updating preferences", err.Error())
			return result
		}

		if count == 1 {
			s.update(transaction, preference)
		} else {
			s.insert(transaction, preference)
		}
	} else {
		result.Err = model.NewAppError("SqlPreferenceStore.save", "We encountered an error while updating preferences",
			"Failed to update preference because of missing driver")
	}

	return result
}

func (s SqlPreferenceStore) insert(transaction *gorp.Transaction, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if err := transaction.Insert(preference); err != nil {
		if IsUniqueConstraintError(err.Error(), "UserId", "preferences_pkey") {
			result.Err = model.NewAppError("SqlPreferenceStore.insert", "A preference with that user id, category, and name already exists",
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error())
		} else {
			result.Err = model.NewAppError("SqlPreferenceStore.insert", "We couldn't save the preference",
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error())
		}
	}

	return result
}

func (s SqlPreferenceStore) update(transaction *gorp.Transaction, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if _, err := transaction.Update(preference); err != nil {
		result.Err = model.NewAppError("SqlPreferenceStore.update", "We couldn't update the preference",
			"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error())
	}

	return result
}

func (s SqlPreferenceStore) Get(userId string, category string, name string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var preference model.Preference

		if err := s.GetReplica().SelectOne(&preference,
			`SELECT
				*
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, map[string]interface{}{"UserId": userId, "Category": category, "Name": name}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Get", "We encounted an error while finding preferences", err.Error())
		} else {
			result.Data = preference
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) GetCategory(userId string, category string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		var preferences model.Preferences

		if _, err := s.GetReplica().Select(&preferences,
			`SELECT
				*
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category`, map[string]interface{}{"UserId": userId, "Category": category}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.GetCategory", "We encounted an error while finding preferences", err.Error())
		} else {
			result.Data = preferences
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
