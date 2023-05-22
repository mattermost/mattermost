// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
)

type sqlClusterDiscoveryStore struct {
	*SqlStore
}

func newSqlClusterDiscoveryStore(sqlStore *SqlStore) store.ClusterDiscoveryStore {
	return &sqlClusterDiscoveryStore{sqlStore}
}

func (s sqlClusterDiscoveryStore) Save(ClusterDiscovery *model.ClusterDiscovery) error {
	ClusterDiscovery.PreSave()
	if err := ClusterDiscovery.IsValid(); err != nil {
		return err
	}

	if _, err := s.GetMasterX().NamedExec(`
		INSERT INTO 
			ClusterDiscovery
			(Id, Type, ClusterName, Hostname, GossipPort, Port, CreateAt, LastPingAt)
		VALUES
			(:Id, :Type, :ClusterName, :Hostname, :GossipPort, :Port, :CreateAt, :LastPingAt)
	`, ClusterDiscovery); err != nil {
		return errors.Wrap(err, "failed to save ClusterDiscovery")
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
		return false, errors.Wrap(err, "cluster_discovery_tosql")
	}

	res, err := s.GetMasterX().Exec(queryString, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete ClusterDiscovery")
	}

	count, err := res.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to count rows affected")
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
		return false, errors.Wrap(err, "cluster_discovery_tosql")
	}

	var count int
	if err := s.GetMasterX().Get(&count, queryString, args...); err != nil {
		return false, errors.Wrap(err, "failed to count ClusterDiscovery")
	}

	return count != 0, nil
}

func (s sqlClusterDiscoveryStore) GetAll(ClusterDiscoveryType, clusterName string) ([]*model.ClusterDiscovery, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("ClusterDiscovery").
		Where(sq.Eq{"Type": ClusterDiscoveryType}).
		Where(sq.Eq{"ClusterName": clusterName}).
		Where(sq.Gt{"LastPingAt": model.GetMillis() - model.CDSOfflineAfterMillis})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "cluster_discovery_tosql")
	}

	list := []*model.ClusterDiscovery{}
	if err := s.GetMasterX().Select(&list, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find ClusterDiscovery")
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
		return errors.Wrap(err, "cluster_discovery_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to update ClusterDiscovery")
	}
	return nil
}

func (s sqlClusterDiscoveryStore) Cleanup() error {
	query := s.getQueryBuilder().
		Delete("ClusterDiscovery").
		Where(sq.Lt{"LastPingAt": model.GetMillis() - model.CDSOfflineAfterMillis})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "cluster_discovery_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to delete ClusterDiscoveries")
	}
	return nil
}
