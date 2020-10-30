// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type sqlRemoteClusterStore struct {
	SqlStore
}

func newSqlRemoteClustersStore(sqlStore SqlStore) store.RemoteClusterStore {
	s := &sqlRemoteClusterStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.RemoteCluster{}, "RemoteClusters").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("ClusterName").SetMaxSize(64)
		table.ColMap("Hostname").SetMaxSize(512)
		table.ColMap("Token").SetMaxSize(26)
	}
	return s
}

func (s sqlRemoteClusterStore) Save(remoteCluster *model.RemoteCluster) (*model.RemoteCluster, error) {
	remoteCluster.PreSave()
	if err := remoteCluster.IsValid(); err != nil {
		return nil, err
	}

	if err := s.GetMaster().Insert(remoteCluster); err != nil {
		return nil, errors.Wrap(err, "failed to save RemoteCluster")
	}
	return remoteCluster, nil
}

func (s sqlRemoteClusterStore) Delete(remoteClusterId string) (bool, error) {
	squery, args, err := s.getQueryBuilder().
		Delete("RemoteClusters").
		Where(sq.Eq{"Id": remoteClusterId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_remote_cluster_tosql")
	}

	result, err := s.GetMaster().Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete RemoteCluster")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	return count > 0, nil
}

func (s sqlRemoteClusterStore) GetAll(inclOffline bool) ([]*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("RemoteClusters")

	if !inclOffline {
		query = query.Where(sq.Gt{"LastPingAt": model.GetMillis() - model.RemoteOfflineAfterMillis})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_tosql")
	}

	var list []*model.RemoteCluster
	if _, err := s.GetMaster().Select(&list, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find RemoteCluster")
	}
	return list, nil
}

func (s sqlRemoteClusterStore) SetLastPingAt(remoteCluster *model.RemoteCluster) error {
	query := s.getQueryBuilder().
		Update("RemoteClusters").
		Set("LastPingAt", model.GetMillis()).
		Where(sq.Eq{"Id": remoteCluster.Id})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "remote_cluster_tosql")
	}

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to update RemoteCluster")
	}
	return nil
}
