// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type sqlClusterDiscoveryStore struct {
	SqlStore
}

func NewSqlClusterDiscoveryStore(sqlStore SqlStore) store.ClusterDiscoveryStore {
	s := &sqlClusterDiscoveryStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.ClusterDiscovery{}, "ClusterDiscovery").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Type").SetMaxSize(64)
		table.ColMap("ClusterName").SetMaxSize(64)
		table.ColMap("Hostname").SetMaxSize(512)
	}

	return s
}

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		ClusterDiscovery.PreSave()
		if result.Err = ClusterDiscovery.IsValid(); result.Err != nil {
			return
		}

		if err := s.GetMaster().Insert(ClusterDiscovery); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.Save", "store.sql_cluster_discovery.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s sqlClusterDiscoveryStore) Delete(ClusterDiscovery *model.ClusterDiscovery) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		result.Data = false

		if count, err := s.GetMaster().SelectInt(
			`
			DELETE
			FROM
				ClusterDiscovery
			WHERE
				Type = :Type
					AND ClusterName = :ClusterName
					AND Hostname = :Hostname
			`,
			map[string]interface{}{
				"Type":        ClusterDiscovery.Type,
				"ClusterName": ClusterDiscovery.ClusterName,
				"Hostname":    ClusterDiscovery.Hostname,
			},
		); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.Delete", "store.sql_cluster_discovery.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if count > 0 {
				result.Data = true
			}
		}
	})
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		result.Data = false

		if count, err := s.GetMaster().SelectInt(
			`
			SELECT
				COUNT(*)
			FROM
				ClusterDiscovery
			WHERE
				Type = :Type
					AND ClusterName = :ClusterName
					AND Hostname = :Hostname
			`,
			map[string]interface{}{
				"Type":        ClusterDiscovery.Type,
				"ClusterName": ClusterDiscovery.ClusterName,
				"Hostname":    ClusterDiscovery.Hostname,
			},
		); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.Exists", "store.sql_cluster_discovery.exists.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			if count > 0 {
				result.Data = true
			}
		}
	})
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		lastPingAt := model.GetMillis() - model.CDS_OFFLINE_AFTER_MILLIS

		var list []*model.ClusterDiscovery
		if _, err := s.GetMaster().Select(
			&list,
			`
			SELECT
				*
			FROM
				ClusterDiscovery
			WHERE
				Type = :ClusterDiscoveryType
					AND ClusterName = :ClusterName
					AND LastPingAt > :LastPingAt
			`,
			map[string]interface{}{
				"ClusterDiscoveryType": ClusterDiscoveryType,
				"ClusterName":          clusterName,
				"LastPingAt":           lastPingAt,
			},
		); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql_cluster_discovery.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = list
		}
	})
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`
			UPDATE ClusterDiscovery
			SET
				LastPingAt = :LastPingAt
			WHERE
				Type = :Type
				AND ClusterName = :ClusterName
				AND Hostname = :Hostname
			`,
			map[string]interface{}{
				"LastPingAt":  model.GetMillis(),
				"Type":        ClusterDiscovery.Type,
				"ClusterName": ClusterDiscovery.ClusterName,
				"Hostname":    ClusterDiscovery.Hostname,
			},
		); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql_cluster_discovery.set_last_ping.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}

func (s sqlClusterDiscoveryStore) Cleanup() store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if _, err := s.GetMaster().Exec(
			`
			DELETE FROM ClusterDiscovery
				WHERE
					LastPingAt < :LastPingAt
			`,
			map[string]interface{}{
				"LastPingAt": model.GetMillis() - model.CDS_OFFLINE_AFTER_MILLIS,
			},
		); err != nil {
			result.Err = model.NewAppError("SqlClusterDiscoveryStore.Save", "store.sql_cluster_discovery.cleanup.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	})
}
