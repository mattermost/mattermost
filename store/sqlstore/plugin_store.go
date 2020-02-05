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

const (
	DEFAULT_PLUGIN_KEY_FETCH_LIMIT = 10
)

type SqlPluginStore struct {
	SqlStore
}

func NewSqlPluginStore(sqlStore SqlStore) store.PluginStore {
	s := &SqlPluginStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.PluginKeyValue{}, "PluginKeyValueStore").SetKeys(false, "PluginId", "Key")
		table.ColMap("PluginId").SetMaxSize(190)
		table.ColMap("Key").SetMaxSize(50)
		table.ColMap("Value").SetMaxSize(8192)
	}

	return s
}

func (ps SqlPluginStore) CreateIndexesIfNotExists() {
}

func (ps SqlPluginStore) SaveOrUpdate(kv *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return nil, err
	}

	if kv.Value == nil {
		// Setting a key to nil is the same as removing it
		err := ps.Delete(kv.PluginId, kv.Key)
		if err != nil {
			return nil, err
		}

		return kv, nil
	}

	if ps.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		// Unfortunately PostgreSQL pre-9.5 does not have an atomic upsert, so we use
		// separate update and insert queries to accomplish our upsert
		if rowsAffected, err := ps.GetMaster().Update(kv); err != nil {
			return nil, model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsAffected == 0 {
			// No rows were affected by the update, so let's try an insert
			if err := ps.GetMaster().Insert(kv); err != nil {
				// If the error is from unique constraints violation, it's the result of a
				// valid race and we can report success. Otherwise we have a real error and
				// need to return it
				if !IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key", "PKey", "pkey"}) {
					return nil, model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
			}
		}
	} else if ps.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if _, err := ps.GetMaster().Exec("INSERT INTO PluginKeyValueStore (PluginId, PKey, PValue, ExpireAt) VALUES(:PluginId, :Key, :Value, :ExpireAt) ON DUPLICATE KEY UPDATE PValue = :Value, ExpireAt = :ExpireAt", map[string]interface{}{"PluginId": kv.PluginId, "Key": kv.Key, "Value": kv.Value, "ExpireAt": kv.ExpireAt}); err != nil {
			return nil, model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return kv, nil
}

func (ps SqlPluginStore) CompareAndSet(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return false, err
	}

	if kv.Value == nil {
		// Setting a key to nil is the same as removing it
		return ps.CompareAndDelete(kv, oldValue)
	}

	if oldValue == nil {
		// Insert if oldValue is nil
		if err := ps.GetMaster().Insert(kv); err != nil {
			// If the error is from unique constraints violation, it's the result of a
			// race condition, return false and no error. Otherwise we have a real error and
			// need to return it.
			if IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key", "PKey", "pkey"}) {
				return false, nil
			} else {
				return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	} else {
		// Update if oldValue is not nil
		updateResult, err := ps.GetMaster().Exec(
			`UPDATE PluginKeyValueStore SET PValue = :New, ExpireAt = :ExpireAt WHERE PluginId = :PluginId AND PKey = :Key AND PValue = :Old`,
			map[string]interface{}{
				"PluginId": kv.PluginId,
				"Key":      kv.Key,
				"Old":      oldValue,
				"New":      kv.Value,
				"ExpireAt": kv.ExpireAt,
			},
		)
		if err != nil {
			return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if rowsAffected, err := updateResult.RowsAffected(); err != nil {
			// Failed to update
			return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else if rowsAffected == 0 {
			if ps.DriverName() == model.DATABASE_DRIVER_MYSQL && bytes.Equal(oldValue, kv.Value) {
				// ROW_COUNT on MySQL is zero even if the row existed but no changes to the row were required.
				// Check if the row exists with the required value to distinguish this case. Strictly speaking,
				// this isn't a good use of CompareAndSet anyway, since there's no corresponding guarantee of
				// atomicity. Nevertheless, let's return results consistent with Postgres and with what might
				// be expected in this case.
				count, err := ps.GetReplica().SelectInt(
					"SELECT COUNT(*) FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key AND PValue = :Value",
					map[string]interface{}{
						"PluginId": kv.PluginId,
						"Key":      kv.Key,
						"Value":    kv.Value,
					},
				)
				if err != nil {
					return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.compare_and_set.mysql_select.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", kv.PluginId, kv.Key, err.Error()), http.StatusInternalServerError)
				}

				if count == 0 {
					return false, nil
				} else if count == 1 {
					return true, nil
				} else {
					return false, model.NewAppError("SqlPluginStore.CompareAndSet", "store.sql_plugin_store.compare_and_set.too_many_rows.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, count=%d", kv.PluginId, kv.Key, count), http.StatusInternalServerError)
				}
			}

			// No rows were affected by the update, where condition was not satisfied,
			// return false, but no error.
			return false, nil
		}
	}

	return true, nil
}

func (ps SqlPluginStore) CompareAndDelete(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError) {
	if err := kv.IsValid(); err != nil {
		return false, err
	}

	if oldValue == nil {
		// nil can't be stored. Return showing that we didn't do anything
		return false, nil
	}

	deleteResult, err := ps.GetMaster().Exec(
		`DELETE FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key AND PValue = :Old`,
		map[string]interface{}{
			"PluginId": kv.PluginId,
			"Key":      kv.Key,
			"Old":      oldValue,
		},
	)
	if err != nil {
		return false, model.NewAppError("SqlPluginStore.CompareAndDelete", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if rowsAffected, err := deleteResult.RowsAffected(); err != nil {
		return false, model.NewAppError("SqlPluginStore.CompareAndDelete", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	} else if rowsAffected == 0 {
		return false, nil
	}

	return true, nil
}

func (ps SqlPluginStore) SetWithOptions(pluginId string, key string, value []byte, opt model.PluginKVSetOptions) (bool, *model.AppError) {
	if err := opt.IsValid(); err != nil {
		return false, err
	}

	kv, err := model.NewPluginKeyValueFromOptions(pluginId, key, value, opt)
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

func (ps SqlPluginStore) Get(pluginId, key string) (*model.PluginKeyValue, *model.AppError) {
	var kv *model.PluginKeyValue
	currentTime := model.GetMillis()
	if err := ps.GetReplica().SelectOne(&kv, "SELECT * FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key AND (ExpireAt = 0 OR ExpireAt > :CurrentTime)", map[string]interface{}{"PluginId": pluginId, "Key": key, "CurrentTime": currentTime}); err != nil {
		if err == sql.ErrNoRows {
			return nil, model.NewAppError("SqlPluginStore.Get", "store.sql_plugin_store.get.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusNotFound)
		}
		return nil, model.NewAppError("SqlPluginStore.Get", "store.sql_plugin_store.get.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusInternalServerError)
	}

	return kv, nil
}

func (ps SqlPluginStore) Delete(pluginId, key string) *model.AppError {
	if _, err := ps.GetMaster().Exec("DELETE FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key", map[string]interface{}{"PluginId": pluginId, "Key": key}); err != nil {
		return model.NewAppError("SqlPluginStore.Delete", "store.sql_plugin_store.delete.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusInternalServerError)
	}
	return nil
}

func (ps SqlPluginStore) DeleteAllForPlugin(pluginId string) *model.AppError {
	if _, err := ps.GetMaster().Exec("DELETE FROM PluginKeyValueStore WHERE PluginId = :PluginId", map[string]interface{}{"PluginId": pluginId}); err != nil {
		return model.NewAppError("SqlPluginStore.Delete", "store.sql_plugin_store.delete.app_error", nil, fmt.Sprintf("plugin_id=%v, err=%v", pluginId, err.Error()), http.StatusInternalServerError)
	}
	return nil
}

func (ps SqlPluginStore) DeleteAllExpired() *model.AppError {
	currentTime := model.GetMillis()
	if _, err := ps.GetMaster().Exec("DELETE FROM PluginKeyValueStore WHERE ExpireAt != 0 AND ExpireAt < :CurrentTime", map[string]interface{}{"CurrentTime": currentTime}); err != nil {
		return model.NewAppError("SqlPluginStore.Delete", "store.sql_plugin_store.delete.app_error", nil, fmt.Sprintf("current_time=%v, err=%v", currentTime, err.Error()), http.StatusInternalServerError)
	}
	return nil
}

func (ps SqlPluginStore) List(pluginId string, offset int, limit int) ([]string, *model.AppError) {
	if limit <= 0 {
		limit = DEFAULT_PLUGIN_KEY_FETCH_LIMIT
	}

	if offset <= 0 {
		offset = 0
	}

	var keys []string
	_, err := ps.GetReplica().Select(&keys, "SELECT PKey FROM PluginKeyValueStore WHERE PluginId = :PluginId order by PKey limit :Limit offset :Offset", map[string]interface{}{"PluginId": pluginId, "Limit": limit, "Offset": offset})
	if err != nil {
		return nil, model.NewAppError("SqlPluginStore.List", "store.sql_plugin_store.list.app_error", nil, fmt.Sprintf("plugin_id=%v, err=%v", pluginId, err.Error()), http.StatusInternalServerError)
	}

	return keys, nil
}
