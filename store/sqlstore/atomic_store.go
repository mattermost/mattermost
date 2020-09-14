// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"bytes"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlAtomicStore struct {
	SqlStore
}

func newSqlAtomicStore(sqlStore SqlStore) store.AtomicStore {
	s := &SqlAtomicStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.AtomicKeyValue{}, "AtomicKeyValueStore").SetKeys(false, "Key")
		table.ColMap("Key").SetMaxSize(190)
		table.ColMap("Value").SetMaxSize(8192)
	}

	return s
}

func (ps SqlAtomicStore) createIndexesIfNotExists() {
}

func (ps SqlAtomicStore) SaveOrUpdate(kv *model.AtomicKeyValue) (*model.AtomicKeyValue, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return nil, err
	}

	if ps.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		// Unfortunately PostgreSQL pre-9.5 does not have an atomic upsert, so we use
		// separate update and insert queries to accomplish our upsert
		if rowsAffected, err := ps.GetMaster().Update(kv); err != nil {
			return nil, model.NewAppError("SqlAtomicStore.SaveOrUpdate", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsAffected == 0 {
			// No rows were affected by the update, so let's try an insert
			if err := ps.GetMaster().Insert(kv); err != nil {
				// If the error is from unique constraints violation, it's the result of a
				// valid race and we can report success. Otherwise we have a real error and
				// need to return it
				if !IsUniqueConstraintError(err, []string{"PRIMARY", "Key", "AKey", "akey"}) {
					return nil, model.NewAppError("SqlAtomicStore.SaveOrUpdate", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}
	} else if ps.DriverName() == model.DATABASE_DRIVER_MYSQL {
		sql := `INSERT INTO AtomicKeyValueStore (AKey, AValue, ExpireAt, UpdateAt)
			VALUES(:Key, :Value, :ExpireAt, :UpdateAt)
			ON DUPLICATE KEY UPDATE AValue = :Value, ExpireAt = :ExpireAt, UpdateAt = :UpdateAt`
		if _, err := ps.GetMaster().Exec(sql, map[string]interface{}{"Key": kv.Key, "Value": kv.Value, "ExpireAt": kv.ExpireAt, "UpdateAt": kv.UpdateAt}); err != nil {
			return nil, model.NewAppError("SqlAtomicStore.SaveOrUpdate", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return kv, nil
}

func (ps SqlAtomicStore) CompareAndSet(kv *model.AtomicKeyValue, oldValue []byte) (bool, *model.AppError) {
	kv.PreSave()
	if err := kv.IsValid(); err != nil {
		return false, err
	}

	if kv.Value == nil {
		// Setting a key to nil is the same as removing it
		return ps.CompareAndDelete(kv.Key, oldValue)
	}

	if oldValue == nil {
		// Insert if oldValue is nil
		if err := ps.GetMaster().Insert(kv); err != nil {
			// If the error is from unique constraints violation, it's the result of a
			// race condition, return false and no error. Otherwise we have a real error and
			// need to return it.
			if IsUniqueConstraintError(err, []string{"PRIMARY", "Key", "AKey"}) {
				return false, nil
			} else {
				return false, model.NewAppError("SqlAtomicStore.CompareAndSet", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		// Update if oldValue is not nil
		updateResult, err := ps.GetMaster().Exec(
			`UPDATE AtomicKeyValueStore SET AValue = :New, ExpireAt = :ExpireAt, UpdateAt = :UpdateAt WHERE AKey = :Key AND AValue = :Old`,
			map[string]interface{}{
				"Key":      kv.Key,
				"Old":      oldValue,
				"New":      kv.Value,
				"ExpireAt": kv.ExpireAt,
				"UpdateAt": kv.UpdateAt,
			},
		)
		if err != nil {
			return false, model.NewAppError("SqlAtomicStore.CompareAndSet", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if rowsAffected, err := updateResult.RowsAffected(); err != nil {
			// Failed to update
			return false, model.NewAppError("SqlAtomicStore.CompareAndSet", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsAffected == 0 {
			if ps.DriverName() == model.DATABASE_DRIVER_MYSQL && bytes.Equal(oldValue, kv.Value) {
				// ROW_COUNT on MySQL is zero even if the row existed but no changes to the row were required.
				// Check if the row exists with the required value to distinguish this case. Strictly speaking,
				// this isn't a good use of CompareAndSet anyway, since there's no corresponding guarantee of
				// atomicity. Nevertheless, let's return results consistent with Postgres and with what might
				// be expected in this case.
				count, err := ps.GetMaster().SelectInt(
					"SELECT COUNT(*) FROM AtomicKeyValueStore WHERE AKey = :Key AND AValue = :Value",
					map[string]interface{}{
						"Key":   kv.Key,
						"Value": kv.Value,
					},
				)
				if err != nil {
					return false, model.NewAppError("SqlAtomicStore.CompareAndSet", "store.sql_atomic_store.compare_and_set.mysql_select.app_error", nil, fmt.Sprintf("key=%v, err=%v", kv.Key, err.Error()), http.StatusInternalServerError)
				}

				switch count {
				case 0:
					return false, nil
				case 1:
					return true, nil
				default:
					return false, model.NewAppError("SqlAtomicStore.CompareAndSet", "store.sql_atomic_store.compare_and_set.too_many_rows.app_error", nil, fmt.Sprintf("key=%v, count=%d", kv.Key, count), http.StatusInternalServerError)
				}
			}

			// No rows were affected by the update, where condition was not satisfied,
			// return false, but no error.
			return false, nil
		}
	}

	return true, nil
}

func (ps SqlAtomicStore) CompareAndDelete(key string, oldValue []byte) (bool, *model.AppError) {
	if oldValue == nil {
		// nil can't be stored. Return showing that we didn't do anything
		return false, nil
	}

	deleteResult, err := ps.GetMaster().Exec(
		`DELETE FROM AtomicKeyValueStore WHERE AKey = :Key AND AValue = :Old`,
		map[string]interface{}{
			"Key": key,
			"Old": oldValue,
		},
	)
	if err != nil {
		return false, model.NewAppError("SqlAtomicStore.CompareAndDelete", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if rowsAffected, err := deleteResult.RowsAffected(); err != nil {
		return false, model.NewAppError("SqlAtomicStore.CompareAndDelete", "store.sql_atomic_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsAffected == 0 {
		return false, nil
	}

	return true, nil
}

/*
func (ps SqlAtomicStore) Set(key string, value []byte, opt model.PluginKVSetOptions) (bool, *model.AppError) {
	if err := opt.IsValid(); err != nil {
		return false, err
	}

	kv, err := model.NewAtomicKeyValueFromOptions(pluginId, key, value, opt)
	if err != nil {
		return false, err
	}

	if opt.Atomic {
		return ps.CompareAndSet(kv, opt.OldValue)
	}

	savedKv, err := ps.SaveOrUpdate(kv)
	if err != nil {
		return false, err
	}

	return savedKv != nil, nil
}
*/
func (ps SqlAtomicStore) Get(key string) (*model.AtomicKeyValue, *model.AppError) {
	var kv *model.AtomicKeyValue
	currentTime := model.GetMillis()
	if err := ps.GetReplica().SelectOne(&kv, "SELECT * FROM AtomicKeyValueStore WHERE AKey = :Key AND (ExpireAt = 0 OR ExpireAt > :CurrentTime)", map[string]interface{}{"Key": key, "CurrentTime": currentTime}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlAtomicStore.Get", "store.sql_atomic_store.get.app_error", nil, fmt.Sprintf("key=%v, err=%v", key, err.Error()), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlAtomicStore.Get", "store.sql_atomic_store.get.app_error", nil, fmt.Sprintf("key=%v, err=%v", key, err.Error()), http.StatusInternalServerError)
	}

	return kv, nil
}

func (ps SqlAtomicStore) Delete(key string) *model.AppError {
	if _, err := ps.GetMaster().Exec("DELETE FROM AtomicKeyValueStore WHERE AKey = :Key", map[string]interface{}{"Key": key}); err != nil {
		return model.NewAppError("SqlAtomicStore.Delete", "store.sql_atomic_store.delete.app_error", nil, fmt.Sprintf("key=%v, err=%v", key, err.Error()), http.StatusInternalServerError)
	}
	return nil
}

func (ps SqlAtomicStore) DeleteAllExpired() *model.AppError {
	currentTime := model.GetMillis()
	if _, err := ps.GetMaster().Exec("DELETE FROM AtomicKeyValueStore WHERE ExpireAt != 0 AND ExpireAt < :CurrentTime", map[string]interface{}{"CurrentTime": currentTime}); err != nil {
		return model.NewAppError("SqlAtomicStore.Delete", "store.sql_atomic_store.delete.app_error", nil, fmt.Sprintf("current_time=%v, err=%v", currentTime, err.Error()), http.StatusInternalServerError)
	}
	return nil
}
