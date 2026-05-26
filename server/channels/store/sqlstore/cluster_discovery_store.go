// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type sqlClusterDiscoveryStore struct {
	*SqlStore

	clusterDiscoveryQuery sq.SelectBuilder
}

func newSqlClusterDiscoveryStore(sqlStore *SqlStore) store.ClusterDiscoveryStore {
	s := &sqlClusterDiscoveryStore{
		SqlStore: sqlStore,
	}

	s.clusterDiscoveryQuery = s.getQueryBuilder().
		Select(
			"Id",
			"Type",
			"ClusterName",
			"Hostname",
			"GossipPort",
			"Port",
			"CreateAt",
			"LastPingAt",
		).
		From("ClusterDiscovery")

	return s
}

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) error {
	ClusterDiscovery.PreSave()
	if err := ClusterDiscovery.IsValid(); err != nil {
		return err
	}

	if _, err := s.GetMaster().NamedExec(`
		INSERT INTO 
			ClusterDiscovery
			(Id, Type, ClusterName, Hostname, GossipPort, Port, CreateAt, LastPingAt)
		VALUES
			(:Id, :Type, :ClusterName, :Hostname, :GossipPort, :Port, :CreateAt, :LastPingAt)
	`, ClusterDiscovery); err != nil {
		return fmt.Errorf("failed to save ClusterDiscovery: %w", err)
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Delete(ClusterDiscovery *model.ClusterDiscovery) (bool, error) {
	query := s.getQueryBuilder().
		Delete("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, fmt.Errorf("cluster_discovery_tosql: %w", err)
	}

	res, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return false, fmt.Errorf("failed to delete ClusterDiscovery: %w", err)
	}

	count, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to count rows affected: %w", err)
	}

	return count != 0, nil
}

func (s sqlClusterDiscoveryStore) Exists(ClusterDiscovery *model.ClusterDiscovery) (bool, error) {
	query := s.getQueryBuilder().
		Select("COUNT(*)").
		From("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, fmt.Errorf("cluster_discovery_tosql: %w", err)
	}

	var count int
	if err := s.GetMaster().Get(&count, queryString, args...); err != nil {
		return false, fmt.Errorf("failed to count ClusterDiscovery: %w", err)
	}

	return count != 0, nil
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) ([]*model.ClusterDiscovery, error) {
	query := s.clusterDiscoveryQuery.
		Where(sq.Eq{"Type": ClusterDiscoveryType}).
		Where(sq.Eq{"ClusterName": clusterName}).
		Where(sq.Gt{"LastPingAt": model.GetMillis() - model.CDSOfflineAfterMillis})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("cluster_discovery_tosql: %w", err)
	}

	list := []*model.ClusterDiscovery{}
	if err := s.GetMaster().Select(&list, queryString, args...); err != nil {
		return nil, fmt.Errorf("failed to find ClusterDiscovery: %w", err)
	}
	return list, nil
}

func (s sqlClusterDiscoveryStore) SetLastPingAt(ClusterDiscovery *model.ClusterDiscovery) error {
	query := s.getQueryBuilder().
		Update("ClusterDiscovery").
		Set("LastPingAt", model.GetMillis()).
		Where(sq.Eq{"Type": ClusterDiscovery.Type}).
		Where(sq.Eq{"ClusterName": ClusterDiscovery.ClusterName}).
		Where(sq.Eq{"Hostname": ClusterDiscovery.Hostname})

	queryString, args, err := query.ToSql()
	if err != nil {
		return fmt.Errorf("cluster_discovery_tosql: %w", err)
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return fmt.Errorf("failed to update ClusterDiscovery: %w", err)
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Cleanup() error {
	query := s.getQueryBuilder().
		Delete("ClusterDiscovery").
		Where(sq.Lt{"LastPingAt": model.GetMillis() - model.CDSOfflineAfterMillis})

	queryString, args, err := query.ToSql()
	if err != nil {
		return fmt.Errorf("cluster_discovery_tosql: %w", err)
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return fmt.Errorf("failed to delete ClusterDiscoveries: %w", err)
	}
	return nil
}
