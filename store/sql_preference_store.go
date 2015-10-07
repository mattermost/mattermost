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
		storeChannel <- s.save(s.GetMaster(), preference)
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) save(queryable Queryable, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if result.Err = preference.IsValid(); result.Err != nil {
		return result
	}

	if err := queryable.Insert(preference); err != nil {
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

	return result
}

func (s SqlPreferenceStore) Update(preference *model.Preference) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		storeChannel <- s.update(s.GetMaster(), preference)
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) update(queryable Queryable, preference *model.Preference) StoreResult {
	result := StoreResult{}

	if result.Err = preference.IsValid(); result.Err != nil {
		return result
	}

	if count, err := queryable.Update(preference); err != nil {
		result.Err = model.NewAppError("SqlPreferenceStore.Update", "We couldn't update the preference",
			"user_id="+preference.UserId+", category="+preference.Category+", name="+preference.Name+", alt_id="+preference.AltId+", "+err.Error())
	} else {
		result.Data = count
	}

	return result
}

func (s SqlPreferenceStore) SaveOrUpdate(preferences ...*model.Preference) StoreChannel {
	storeChannel := make(StoreChannel)

	go func() {
		result := StoreResult{}

		db := s.GetReplica()

		if len(preferences) > 1 {
			// wrap in a transaction so that if one fails, everything fails
			transaction, err := db.Begin()
			if err != nil {
				result.Err = model.NewAppError("SqlPreferenceStore.SaveOrUpdateMultiple", "Unable to open transaction to update preferences", err.Error())
			} else {
				for _, preference := range preferences {
					if err := s.saveOrUpdate(transaction, preference); err != nil {
						result.Err = err
						break
					}
				}

				if result.Err == nil {
					if err := transaction.Commit(); err != nil {
						// don't need to rollback here since the transaction is already closed
						result.Err = model.NewAppError("SqlPreferenceStore.SaveOrUpdateMultiple", "Unable to commit transaction to update preferences", err.Error())
					}
				} else {
					if err := transaction.Rollback(); err != nil {
						result.Err = model.NewAppError("SqlPreferenceStore.SaveOrUpdateMultiple", "Unable to rollback transaction to update preferences", err.Error())
					}
				}
			}
		} else {
			result.Err = s.saveOrUpdate(db, preferences[0])
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s SqlPreferenceStore) saveOrUpdate(queryable Queryable, preference *model.Preference) *model.AppError {
	if result := s.save(queryable, preference); result.Err != nil {
		if result := s.update(queryable, preference); result.Err != nil {
			return result.Err
		}
	}

	return nil
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
