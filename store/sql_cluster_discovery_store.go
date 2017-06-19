// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
)

type sqlClusterDiscoveryStore struct {
	SqlStore
}

func NewSqlClusterDiscoveryStore(sqlStore SqlStore) ClusterDiscoveryStore {
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

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

		ClusterDiscovery.PreSave()
		if result.Err = ClusterDiscovery.IsValid(); result.Err != nil {
			storeChannel <- result
			close(storeChannel)
			return
		}

		if err := s.GetMaster().Insert(ClusterDiscovery); err != nil {
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.Save", "Failed to save ClusterDiscovery row", nil, err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s sqlClusterDiscoveryStore) Delete(ClusterDiscovery *model.ClusterDiscovery) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
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
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.Delete", "Failed to delete", nil, err.Error())
		} else {
			if count > 0 {
				result.Data = true
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}
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
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.Exists", "Failed to check if it exists", nil, err.Error())
		} else {
			if count > 0 {
				result.Data = true
			}
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.GetAllForType", "Failed to get all disoery rows", nil, err.Error())
		} else {
			result.Data = list
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) StoreChannel {
	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.GetAllForType", "Failed to update last ping at", nil, err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}

func (s sqlClusterDiscoveryStore) Cleanup() StoreChannel {

	storeChannel := make(StoreChannel, 1)

	go func() {
		result := StoreResult{}

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
			result.Err = model.NewLocAppError("SqlClusterDiscoveryStore.Save", "Failed to save ClusterDiscovery row", nil, err.Error())
		}

		storeChannel <- result
		close(storeChannel)
	}()

	return storeChannel
}
