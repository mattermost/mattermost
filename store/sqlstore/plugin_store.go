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
		table.ColMap("PluginId").SetMaxSize(190)
		table.ColMap("Key").SetMaxSize(50)
		table.ColMap("Value").SetMaxSize(8192)

		table = db.AddTableWithName(model.PluginStatus{}, "PluginStatuses").SetKeys(false, "ClusterDiscoveryId", "PluginId")
		table.ColMap("PluginId").SetMaxSize(190)
		table.ColMap("ClusterDiscoveryId").SetMaxSize(26)
		table.ColMap("PluginPath").SetMaxSize(512)
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
			// Unfortunately PostgreSQL pre-9.5 does not have an atomic upsert, so we use
			// separate update and insert queries to accomplish our upsert
			if rowsAffected, err := ps.GetMaster().Update(kv); err != nil {
				result.Err = model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			} else if rowsAffected == 0 {
				// No rows were affected by the update, so let's try an insert
				if err := ps.GetMaster().Insert(kv); err != nil {
					// If the error is from unique constraints violation, it's the result of a
					// valid race and we can report success. Otherwise we have a real error and
					// need to return it
					if !IsUniqueConstraintError(err, []string{"PRIMARY", "PluginId", "Key", "PKey"}) {
						result.Err = model.NewAppError("SqlPluginStore.SaveOrUpdate", "store.sql_plugin_store.save.app_error", nil, err.Error(), http.StatusInternalServerError)
						return
					}
				}
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

func (ps SqlPluginStore) CreatePluginStatus(pluginStatus *model.PluginStatus) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if err := ps.GetMaster().Insert(pluginStatus); err != nil {
			if !IsUniqueConstraintError(err, []string{"PRIMARY"}) {
				result.Err = model.NewAppError("SqlPluginStore.CreatePluginStatus", "store.sql_plugin_store.save_plugin.app_error", nil, err.Error(), http.StatusInternalServerError)
				return
			}
		}

		result.Data = pluginStatus
	})
}

func (ps SqlPluginStore) GetPluginStatuses() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		statuses := []*model.PluginStatus{}

		if _, err := ps.GetReplica().Select(&statuses, `
			SELECT 
				*
			FROM 
				PluginStatuses
			ORDER BY 
				PluginId ASC, 
				ClusterDiscoveryId ASC
		`); err != nil {
			result.Err = model.NewAppError("SqlPluginStore.GetPluginStatuses", "store.sql_plugin_store.get_plugin_statuses.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = statuses
	})
}

func (ps SqlPluginStore) UpdatePluginStatusState(pluginStatus *model.PluginStatus) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := ps.GetMaster().Exec(`
			UPDATE
				PluginStatuses
			SET
				State = :State
			WHERE
				ClusterDiscoveryId = :ClusterDiscoveryId 
			    AND PluginId = :PluginId 
		`, map[string]interface{}{
			"ClusterDiscoveryId": pluginStatus.ClusterDiscoveryId,
			"PluginId":           pluginStatus.PluginId,
			"State":              pluginStatus.State,
		}); err != nil {
			result.Err = model.NewAppError("SqlPluginStore.UpdatePluginStatusState", "store.sql_plugin_store.update_plugin_status.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = true
		}
	})
}

// DeletePluginStatus removes a given plugin record from the Plugins table.
func (ps SqlPluginStore) DeletePluginStatus(pluginStatus *model.PluginStatus) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := ps.GetMaster().Exec(`
			DELETE FROM 
				PluginStatuses
			WHERE 
				ClusterDiscoveryId = :ClusterDiscoveryId 
			    AND PluginId = :PluginId 
		`, map[string]interface{}{
			"ClusterDiscoveryId": pluginStatus.ClusterDiscoveryId,
			"PluginId":           pluginStatus.PluginId,
		}); err != nil {
			result.Err = model.NewAppError("SqlPluginStore.DeletePluginStatus", "store.sql_plugin_store.delete_plugin_status.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = true
		}
	})
}

// PrunePluginStatuses removes stale plugin records from the PluginStatus table.
//
// The provided excludeClusterDiscoveryId is ignored to simplify handling the case of a non-ha
// server for which there is no ClusterDiscovery record.
func (ps SqlPluginStore) PrunePluginStatuses(excludeClusterDiscoveryId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var query string

		if ps.DriverName() == model.DATABASE_DRIVER_MYSQL {
			query = `
				DELETE FROM 
					ps
				USING
					PluginStatuses AS ps
				WHERE NOT EXISTS(
					SELECT
						1
					FROM
						ClusterDiscovery cd
					WHERE
						cd.Id = ps.ClusterDiscoveryId
				) AND ps.ClusterDiscoveryId != :ClusterDiscoveryId
			`
		} else if ps.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			query = `
				DELETE FROM
					PluginStatuses ps
				WHERE NOT EXISTS(
					SELECT
						1
					FROM
						ClusterDiscovery cd
					WHERE
						cd.Id = ps.ClusterDiscoveryId
				) AND ps.ClusterDiscoveryId != :ClusterDiscoveryId
			`
		}

		if _, err := ps.GetMaster().Exec(query, map[string]interface{}{
			"ClusterDiscoveryId": excludeClusterDiscoveryId,
		}); err != nil {
			result.Err = model.NewAppError("SqlPluginStore.PrunePluginStatuses", "store.sql_plugin_store.prune_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = true
		}
	})
}
