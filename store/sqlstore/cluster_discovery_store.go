// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) *model.AppError {
	ClusterDiscovery.PreSave()
	if err := ClusterDiscovery.IsValid(); err != nil {
		return err
	}

	if err := s.GetMaster().Insert(ClusterDiscovery); err != nil {
		return model.NewAppError("SqlClusterDiscoveryStore.Save", "store.sql_cluster_discovery.save.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Delete(ClusterDiscovery *model.ClusterDiscovery) (bool, *model.AppError) {
	count, err := s.GetMaster().SelectInt(
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
	)
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Delete", "store.sql_cluster_discovery.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) (bool, *model.AppError) {
	count, err := s.GetMaster().SelectInt(
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
	)
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Exists", "store.sql_cluster_discovery.exists.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) ([]*model.ClusterDiscovery, *model.AppError) {
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
		return nil, model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql_cluster_discovery.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return list, nil
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) *model.AppError {
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
		return model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql_cluster_discovery.set_last_ping.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Cleanup() *model.AppError {
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
		return model.NewAppError("SqlClusterDiscoveryStore.Save", "store.sql_cluster_discovery.cleanup.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
