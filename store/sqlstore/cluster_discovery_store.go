// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type sqlClusterDiscoveryStore struct {
	SqlStore
}

func newSqlClusterDiscoveryStore(sqlStore SqlStore) store.ClusterDiscoveryStore {
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
	query := s.getQueryBuilder().
		Delete("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Delete", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetMaster().SelectInt(queryString, args...)
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Delete", "store.sql_cluster_discovery.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) (bool, *model.AppError) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Exists", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, err := s.GetMaster().SelectInt(queryString, args...)
	if err != nil {
		return false, model.NewAppError("SqlClusterDiscoveryStore.Exists", "store.sql_cluster_discovery.exists.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) ([]*model.ClusterDiscovery, *model.AppError) {
	query := s.getQueryBuilder().
		Select("*").
		From("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscoveryType}).
		Where(sq.Eq{"ClusterName": clusterName}).
		Where(sq.Gt{"LastPingAt": model.GetMillis() - model.CDS_OFFLINE_AFTER_MILLIS})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var list []*model.ClusterDiscovery
	if _, err := s.GetMaster().Select(&list, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlClusterDiscoveryStore.GetAllForType", "store.sql_cluster_discovery.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return list, nil
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) *model.AppError {
	query := s.getQueryBuilder().
		Update("ClusterDiscovery").
		Set("LastPingAt", model.GetMillis()).
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlClusterDiscoveryStore.SetLastPingAt", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlClusterDiscoveryStore.SetLastPingAt", "store.sql_cluster_discovery.set_last_ping.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Cleanup() *model.AppError {
	query := s.getQueryBuilder().
		Delete("ClusterDiscovery").
		Where(sq.Lt{"LastPingAt": model.GetMillis() - model.CDS_OFFLINE_AFTER_MILLIS})

	queryString, args, err := query.ToSql()
	if err != nil {
		return model.NewAppError("SqlClusterDiscoveryStore.Cleanup", "store.sql.build_query.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return model.NewAppError("SqlClusterDiscoveryStore.Cleanup", "store.sql_cluster_discovery.cleanup.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}
