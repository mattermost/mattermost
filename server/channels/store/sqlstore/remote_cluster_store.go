// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"strings"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
)

type sqlRemoteClusterStore struct {
	*SqlStore
}

func newSqlRemoteClusterStore(sqlStore *SqlStore) store.RemoteClusterStore {
	return &sqlRemoteClusterStore{sqlStore}
}

func (s sqlRemoteClusterStore) Save(remoteCluster *model.RemoteCluster) (*model.RemoteCluster, error) {
	remoteCluster.PreSave()
	if err := remoteCluster.IsValid(); err != nil {
		return nil, err
	}

	query := `INSERT INTO RemoteClusters
				(RemoteId, RemoteTeamId, Name, DisplayName, SiteURL, CreateAt,
				LastPingAt, Token, RemoteToken, Topics, CreatorId)
				VALUES
				(:RemoteId, :RemoteTeamId, :Name, :DisplayName, :SiteURL, :CreateAt,
				:LastPingAt, :Token, :RemoteToken, :Topics, :CreatorId)`

	if _, err := s.GetMasterX().NamedExec(query, remoteCluster); err != nil {
		return nil, errors.Wrap(err, "failed to save RemoteCluster")
	}
	return remoteCluster, nil
}

func (s sqlRemoteClusterStore) Update(remoteCluster *model.RemoteCluster) (*model.RemoteCluster, error) {
	remoteCluster.PreUpdate()
	if err := remoteCluster.IsValid(); err != nil {
		return nil, err
	}

	query := `UPDATE RemoteClusters
			SET Token = :Token,
			RemoteTeamId = :RemoteTeamId,
			CreateAt = :CreateAt,
			LastPingAt = :LastPingAt,
			RemoteToken = :RemoteToken,
			CreatorId = :CreatorId,
			DisplayName = :DisplayName,
			SiteURL = :SiteURL,
			Topics = :Topics
			WHERE RemoteId = :RemoteId AND Name = :Name`

	if _, err := s.GetMasterX().NamedExec(query, remoteCluster); err != nil {
		return nil, errors.Wrap(err, "failed to update RemoteCluster")
	}
	return remoteCluster, nil
}

func (s sqlRemoteClusterStore) Delete(remoteId string) (bool, error) {
	squery, args, err := s.getQueryBuilder().
		Delete("RemoteClusters").
		Where(sq.Eq{"RemoteId": remoteId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_remote_cluster_tosql")
	}

	result, err := s.GetMasterX().Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete RemoteCluster")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	return count > 0, nil
}

func (s sqlRemoteClusterStore) Get(remoteId string) (*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select("*").
		From("RemoteClusters").
		Where(sq.Eq{"RemoteId": remoteId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_get_tosql")
	}

	var rc model.RemoteCluster
	if err := s.GetReplicaX().Get(&rc, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find RemoteCluster")
	}
	return &rc, nil
}

func (s sqlRemoteClusterStore) GetAll(filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select("rc.*").
		From("RemoteClusters rc")

	if filter.InChannel != "" {
		query = query.Where("rc.RemoteId IN (SELECT scr.RemoteId FROM SharedChannelRemotes scr WHERE scr.ChannelId = ?)", filter.InChannel)
	}

	if filter.NotInChannel != "" {
		query = query.Where("rc.RemoteId NOT IN (SELECT scr.RemoteId FROM SharedChannelRemotes scr WHERE scr.ChannelId = ?)", filter.NotInChannel)
	}

	if filter.ExcludeOffline {
		query = query.Where(sq.Gt{"rc.LastPingAt": model.GetMillis() - model.RemoteOfflineAfterMillis})
	}

	if filter.CreatorId != "" {
		query = query.Where(sq.Eq{"rc.CreatorId": filter.CreatorId})
	}

	if filter.OnlyConfirmed {
		query = query.Where(sq.NotEq{"rc.SiteURL": ""})
	}

	if filter.Topic != "" {
		trimmed := strings.TrimSpace(filter.Topic)
		if trimmed == "" || trimmed == "*" {
			return nil, errors.New("invalid topic")
		}
		queryTopic := fmt.Sprintf("%% %s %%", trimmed)
		query = query.Where(sq.Or{sq.Like{"rc.Topics": queryTopic}, sq.Eq{"rc.Topics": "*"}})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_getall_tosql")
	}

	list := []*model.RemoteCluster{}
	if err := s.GetReplicaX().Select(&list, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find RemoteClusters")
	}
	return list, nil
}

func (s sqlRemoteClusterStore) UpdateTopics(remoteClusterid string, topics string) (*model.RemoteCluster, error) {
	rc, err := s.Get(remoteClusterid)
	if err != nil {
		return nil, err
	}
	rc.Topics = topics

	rc.PreUpdate()

	query := `UPDATE RemoteClusters
			  SET Topics = :Topics
			  WHERE	RemoteId = :RemoteId`

	if _, err = s.GetMasterX().NamedExec(query, rc); err != nil {
		return nil, err
	}
	return rc, nil
}

func (s sqlRemoteClusterStore) SetLastPingAt(remoteClusterId string) error {
	query := s.getQueryBuilder().
		Update("RemoteClusters").
		Set("LastPingAt", model.GetMillis()).
		Where(sq.Eq{"RemoteId": remoteClusterId})

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "remote_cluster_tosql")
	}

	if _, err := s.GetMasterX().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to update RemoteCluster")
	}
	return nil
}
