// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/gorp"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlPreferenceStore struct {
	SqlStore
}

func NewSqlPreferenceStore(sqlStore SqlStore) store.PreferenceStore {
	s := &SqlPreferenceStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Preference{}, "Preferences").SetKeys(false, "UserId", "Category", "Name")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Category").SetMaxSize(32)
		table.ColMap("Name").SetMaxSize(32)
		table.ColMap("Value").SetMaxSize(2000)
	}

	return s
}

func (s SqlPreferenceStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_preferences_user_id", "Preferences", "UserId")
	s.CreateIndexIfNotExists("idx_preferences_category", "Preferences", "Category")
	s.CreateIndexIfNotExists("idx_preferences_name", "Preferences", "Name")
}

func (s SqlPreferenceStore) DeleteUnusedFeatures() {
	mlog.Debug("Deleting any unused pre-release features")

	sql := `DELETE
		FROM Preferences
	WHERE
	Category = :Category
	AND Value = :Value
	AND Name LIKE '` + store.FEATURE_TOGGLE_PREFIX + `%'`

	queryParams := map[string]string{
		"Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
		"Value":    "false",
	}
	s.GetMaster().Exec(sql, queryParams)
}

func (s SqlPreferenceStore) Save(preferences *model.Preferences) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		// wrap in a transaction so that if one fails, everything fails
		transaction, err := s.GetMaster().Begin()
		if err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Save", "store.sql_preference.save.open_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			for _, preference := range *preferences {
				if upsertResult := s.save(transaction, &preference); upsertResult.Err != nil {
					*result = upsertResult
					break
				}
			}

			if result.Err == nil {
				if err := transaction.Commit(); err != nil {
					// don't need to rollback here since the transaction is already closed
					result.Err = model.NewAppError("SqlPreferenceStore.Save", "store.sql_preference.save.commit_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				} else {
					result.Data = len(*preferences)
				}
			} else {
				if err := transaction.Rollback(); err != nil {
					result.Err = model.NewAppError("SqlPreferenceStore.Save", "store.sql_preference.save.rollback_transaction.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}
	})
}

func (s SqlPreferenceStore) save(transaction *gorp.Transaction, preference *model.Preference) store.StoreResult {
	result := store.StoreResult{}

	preference.PreUpdate()

	if result.Err = preference.IsValid(); result.Err != nil {
		return result
	}

	params := map[string]interface{}{
		"UserId":   preference.UserId,
		"Category": preference.Category,
		"Name":     preference.Name,
		"Value":    preference.Value,
	}

	if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if _, err := transaction.Exec(
			`INSERT INTO
				Preferences
				(UserId, Category, Name, Value)
			VALUES
				(:UserId, :Category, :Name, :Value)
			ON DUPLICATE KEY UPDATE
				Value = :Value`, params); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.save", "store.sql_preference.save.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
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
			result.Err = model.NewAppError("SqlPreferenceStore.save", "store.sql_preference.save.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
			return result
		}

		if count == 1 {
			s.update(transaction, preference)
		} else {
			s.insert(transaction, preference)
		}
	} else {
		result.Err = model.NewAppError("SqlPreferenceStore.save", "store.sql_preference.save.missing_driver.app_error", nil, "Failed to update preference because of missing driver", http.StatusNotImplemented)
	}

	return result
}

func (s SqlPreferenceStore) insert(transaction *gorp.Transaction, preference *model.Preference) store.StoreResult {
	result := store.StoreResult{}

	if err := transaction.Insert(preference); err != nil {
		if IsUniqueConstraintError(err, []string{"UserId", "preferences_pkey"}) {
			result.Err = model.NewAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.exists.app_error", nil,
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusBadRequest)
		} else {
			result.Err = model.NewAppError("SqlPreferenceStore.insert", "store.sql_preference.insert.save.app_error", nil,
				"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusInternalServerError)
		}
	}

	return result
}

func (s SqlPreferenceStore) update(transaction *gorp.Transaction, preference *model.Preference) store.StoreResult {
	result := store.StoreResult{}

	if _, err := transaction.Update(preference); err != nil {
		result.Err = model.NewAppError("SqlPreferenceStore.update", "store.sql_preference.update.app_error", nil,
			"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", "+err.Error(), http.StatusInternalServerError)
	}

	return result
}

func (s SqlPreferenceStore) Get(userId string, category string, name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
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
			result.Err = model.NewAppError("SqlPreferenceStore.Get", "store.sql_preference.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = preference
		}
	})
}

func (s SqlPreferenceStore) GetCategory(userId string, category string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var preferences model.Preferences

		if _, err := s.GetReplica().Select(&preferences,
			`SELECT
				*
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category`, map[string]interface{}{"UserId": userId, "Category": category}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.GetCategory", "store.sql_preference.get_category.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = preferences
		}
	})
}

func (s SqlPreferenceStore) GetAll(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var preferences model.Preferences

		if _, err := s.GetReplica().Select(&preferences,
			`SELECT
				*
			FROM
				Preferences
			WHERE
				UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.GetAll", "store.sql_preference.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = preferences
		}
	})
}

func (s SqlPreferenceStore) PermanentDeleteByUser(userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`DELETE FROM Preferences WHERE UserId = :UserId`, map[string]interface{}{"UserId": userId}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Delete", "store.sql_preference.permanent_delete_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlPreferenceStore) IsFeatureEnabled(feature, userId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if value, err := s.GetReplica().SelectStr(`SELECT
				value
			FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, map[string]interface{}{"UserId": userId, "Category": model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS, "Name": store.FEATURE_TOGGLE_PREFIX + feature}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.IsFeatureEnabled", "store.sql_preference.is_feature_enabled.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = value == "true"
		}
	})
}

func (s SqlPreferenceStore) Delete(userId, category, name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`DELETE FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category
				AND Name = :Name`, map[string]interface{}{"UserId": userId, "Category": category, "Name": name}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.Delete", "store.sql_preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlPreferenceStore) DeleteCategory(userId string, category string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`DELETE FROM
				Preferences
			WHERE
				UserId = :UserId
				AND Category = :Category`, map[string]interface{}{"UserId": userId, "Category": category}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.DeleteCategory", "store.sql_preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlPreferenceStore) DeleteCategoryAndName(category string, name string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`DELETE FROM
				Preferences
			WHERE
				Name = :Name
				AND Category = :Category`, map[string]interface{}{"Name": name, "Category": category}); err != nil {
			result.Err = model.NewAppError("SqlPreferenceStore.DeleteCategoryAndName", "store.sql_preference.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s SqlPreferenceStore) CleanupFlagsBatch(limit int64) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		query :=
			`DELETE FROM
				Preferences
			WHERE
				Category = :Category
				AND Name IN (
					SELECT
						*
					FROM (
						SELECT
							Preferences.Name
						FROM
							Preferences
						LEFT JOIN
							Posts
						ON
							Preferences.Name = Posts.Id
						WHERE
							Preferences.Category = :Category
							AND Posts.Id IS null
						LIMIT
							:Limit
					)
					AS t
				)`

		sqlResult, err := s.GetMaster().Exec(query, map[string]interface{}{"Category": model.PREFERENCE_CATEGORY_FLAGGED_POST, "Limit": limit})
		if err != nil {
			result.Err = model.NewAppError("SqlPostStore.CleanupFlagsBatch", "store.sql_preference.cleanup_flags_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
		} else {
			rowsAffected, err1 := sqlResult.RowsAffected()
			if err1 != nil {
				result.Err = model.NewAppError("SqlPostStore.CleanupFlagsBatch", "store.sql_preference.cleanup_flags_batch.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
				result.Data = int64(0)
			} else {
				result.Data = rowsAffected
			}
		}
	})
}
