// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlPluginStore struct {
	SqlStore
}

func NewSqlPluginStore(sqlStore SqlStore) store.PluginStore {
	s := &SqlPluginStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.PluginKeyValue{}, "PluginKeyValueStore").SetKeys(false, "PluginId", "Key")
		table.ColMap("Value").SetMaxSize(8192)
	}

	return s
}

func (ps SqlPluginStore) CreateIndexesIfNotExists() {
}

func (ps SqlPluginStore) SaveOrUpdate(kv *model.PluginKeyValue) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if result.Err = kv.IsValid(); result.Err != nil {
			return
		}

		if ps.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			// Unfortunately PostgreSQL pre-9.5 does not support upsert by default
			// This wCTE will reduce the odds of a race but does not eliminate the chance
			// of getting unique key violations
			if _, err := ps.GetMaster().Exec(`
				WITH new_values (PluginId, PKey, PValue) AS (VALUES (:PluginId, :Key, :Value)),
				upsert AS (
					UPDATE PluginKeyValueStore pkv SET PValue = :Value
					FROM new_values nv
					WHERE pkv.PluginId = nv.PluginId AND pkv.PKey = nv.PKey
					RETURNING pkv.*
				)
				INSERT INTO PluginKeyValueStore (PluginId, PKey, PValue)
				SELECT PluginId, PKey, PValue FROM new_values
				WHERE NOT EXISTS (
					SELECT 1 FROM upsert up WHERE up.PluginId = new_values.PluginId AND up.PKey = new_values.PKey)
                `, map[string]interface{}{"PluginId": kv.PluginId, "Key": kv.Key, "Value": kv.Value}); err != nil {
				if IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key"}) {
					result.Err = model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save_unique.app_error", nil, err.Error(), http.StatusInternalServerError)
				} else {
					result.Err = model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				}
				return
			}
		} else if ps.DriverName() == model.DATABASE_DRIVER_MYSQL {
			if _, err := ps.GetMaster().Exec("INSERT INTO PluginKeyValueStore (PluginId, PKey, PValue) VALUES(:PluginId, :Key, :Value) ON DUPLICATE KEY UPDATE PValue = :Value", map[string]interface{}{"PluginId": kv.PluginId, "Key": kv.Key, "Value": kv.Value}); err != nil {
				result.Err = model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		result.Data = kv
	})
}

func (ps SqlPluginStore) Get(pluginId, key string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var kv *model.PluginKeyValue

		if err := ps.GetReplica().SelectOne(&kv, "SELECT * FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key", map[string]interface{}{"PluginId": pluginId, "Key": key}); err != nil {
			if err == sql.ErrNoRows {
				result.Err = model.NewAppError("SqlPluginStore.Get", "store.sql_plugin_store.get.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusNotFound)
			} else {
				result.Err = model.NewAppError("SqlPluginStore.Get", "store.sql_plugin_store.get.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusInternalServerError)
			}
		} else {
			result.Data = kv
		}
	})
}

func (ps SqlPluginStore) Delete(pluginId, key string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := ps.GetMaster().Exec("DELETE FROM PluginKeyValueStore WHERE PluginId = :PluginId AND PKey = :Key", map[string]interface{}{"PluginId": pluginId, "Key": key}); err != nil {
			result.Err = model.NewAppError("SqlPluginStore.Delete", "store.sql_plugin_store.delete.app_error", nil, fmt.Sprintf("plugin_id=%v, key=%v, err=%v", pluginId, key, err.Error()), http.StatusInternalServerError)
		} else {
			result.Data = true
		}
	})
}
