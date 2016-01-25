// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/go-gorp/gorp"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type SqlPreferenceStore struct {
	*SqlStore
}

const (
	FEATURE_TOGGLE_PREFIX = "feature_enabled_"
)

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

func (s SqlPreferenceStore) DeleteUnusedFeatures() {
	l4g.Debug(utils.T("store.sql_preference.delete_unused_features.debug"))

	sql := `DELETE
		FROM Preferences
	WHERE
	Category = :Category
	AND Value = :Value
	AND Name LIKE '` + FEATURE_TOGGLE_PREFIX + `%'`

	queryParams := map[string]string{
		"Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
		"Value":    "false",
	}
	s.GetMaster().Exec(sql, queryParams)
}

func (s SqlPreferenceStore) Save(preferences *model.Preferences) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		// wrap in a transaction so that if one fails, everything fails
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewLocAppError("SqlPreferenceStore.Save", "store.sql_preference.save.open_transaction.app_error", nil, err.Error())
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
					result.Err = model.NewLocAppError("SqlPreferenceStore.Save", "store.sql_preference.save.commit_transaction.app_error", nil, err.Error())
				} else {
					result.Data = len(*preferences)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewLocAppError("SqlPreferenceStore.Save", "store.sql_preference.save.rollback_transaction.app_error", nil, err.Error())
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
			result.Err = model.NewLocAppError("SqlPreferenceStore.save", "store.sql_preference.save.updating.app_error", nil, err.Error())
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
			result.Err = model.NewLocAppError("SqlPreferenceStore.save", "store.sql_preference.save.updating.app_error", nil, err.Error())
			return result
		}

		if count == 1 {
			s.update(transaction, preference)
		} else {
			s.insert(transaction, preference)
		}
	} else {
		result.Err = model.NewLocAppError("SqlPreferenceStore.save", "store.sql_preference.save.missing_driver.app_error", nil,
			"Failed to update preference because of missing driver")
	}

	return result
}

func (s SqlPreferenceStore) insert(transaction *gorp.Transaction, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if err := transaction.Insert(preference); err != nil {
		if IsUniqueConstraintError(err.Error(), "UserId", "preferences_pkey") {
			result.Err = model.NewLocAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.exists.app_error", nil,
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error())
		} else {
			result.Err = model.NewLocAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.save.app_error", nil,
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error())
		}
	}

	return result
}

func (s SqlPreferenceStore) update(transaction *gorp.Transaction, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if _, err := transaction.Update(preference); err != nil {
		result.Err = model.NewLocAppError("SqlPreferenceStore.update", "store.sql_preference.update.app_error", nil,
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
			result.Err = model.NewLocAppError("SqlPreferenceStore.Get", "store.sql_preference.get.app_error", nil, err.Error())
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
			result.Err = model.NewLocAppError("SqlPreferenceStore.GetCategory", "store.sql_preference.get_category.app_error", nil, err.Error())
		} else {
			result.Data = preferences
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) GetAll(userId string) StoreChannel {
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
				UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlPreferenceStore.GetAll", "store.sql_preference.get_all.app_error", nil, err.Error())
		} else {
			result.Data = preferences
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) PermanentDeleteByUser(userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		if _, err := s.GetMaster().Exec(
			`DELETE FROM Preferences WHERE UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewLocAppError("SqlPreferenceStore.Delete", "store.sql_preference.permanent_delete_by_user.app_error", nil, err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) IsFeatureEnabled(feature, userId string) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}
		if value, err := s.GetReplica().SelectStr(`SELECT
				value
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "Name": FEATURE_TOGGLE_PREFIX + feature}); err != nil {
			result.Err = model.NewLocAppError("SqlPreferenceStore.IsFeatureEnabled", "store.sql_preference.is_feature_enabled.app_error", nil, err.Error())
		} else {
			result.Data = value == "true"
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
