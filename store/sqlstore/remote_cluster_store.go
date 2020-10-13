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
	}
	return s
}

func (s sqlRemoteClusterStore) Save(remoteCluster *model.RemoteCluster) error {
	remoteCluster.PreSave()
	if err := remoteCluster.IsValid(); err != nil {
		return err
	}

	if err := s.GetMaster().Insert(remoteCluster); err != nil {
		return errors.Wrap(err, "failed to save RemoteCluster")
	}
	return nil
}

func (s sqlRemoteClusterStore) Delete(remoteCluster *model.RemoteCluster) (bool, error) {
	query := s.getQueryBuilder().
		Delete("RemoteClusters").
		Where(sq.Eq{"Id": remoteCluster.Id})

	queryString, args, err := query.ToSql()
	if err != nil {
		return false, errors.Wrap(err, "remote_clusters_tosql")
	}

	count, err := s.GetMaster().SelectInt(queryString, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete RemoteCluster")
	}
	if count == 0 {
		return false, nil
	}
	return true, nil
}

func (s sqlRemoteClusterStore) GetAll(inclOffline bool) ([]*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("RemoteClusters")

	if !inclOffline {
		query = query.Where(sq.Gt{"LastPingAt": model.GetMillis() - model.REMOTE_OFFLINE_AFTER_MILLIS})
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
