// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type sqlRemoteClusterStore struct {
	*SqlStore
}

func newSqlRemoteClusterStore(sqlStore *SqlStore) store.RemoteClusterStore {
	return &sqlRemoteClusterStore{sqlStore}
}

func remoteClusterFields(prefix string) []string {
	if prefix != "" && !strings.HasSuffix(prefix, ".") {
		prefix = prefix + "."
	}
	return []string{
		prefix + "RemoteId",
		prefix + "RemoteTeamId",
		prefix + "Name",
		prefix + "DisplayName",
		prefix + "SiteURL",
		prefix + "CreateAt",
		prefix + "LastPingAt",
		prefix + "Token",
		prefix + "RemoteToken",
		prefix + "Topics",
		prefix + "CreatorId",
		prefix + "PluginID",
		prefix + "Options",
	}
}

func (s sqlRemoteClusterStore) Save(remoteCluster *model.RemoteCluster) (*model.RemoteCluster, error) {
	remoteCluster.PreSave()
	if err := remoteCluster.IsValid(); err != nil {
		return nil, err
	}

	// check for pluginID collisions - on collision treat as idempotent
	if remoteCluster.PluginID != "" {
		rc, err := s.GetByPluginID(remoteCluster.PluginID)
		if err == nil {
			// if this plugin id already exists, just return it
			return rc, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			// anything other than NotFound is unexpected
			return nil, errors.Wrapf(err, "failed to lookup RemoteCluster by pluginID %s", remoteCluster.PluginID)
		}
	}

	query := `INSERT INTO RemoteClusters
				(RemoteId, RemoteTeamId, Name, DisplayName, SiteURL, CreateAt,
				LastPingAt, Token, RemoteToken, Topics, CreatorId, PluginID, Options)
				VALUES
				(:RemoteId, :RemoteTeamId, :Name, :DisplayName, :SiteURL, :CreateAt,
				:LastPingAt, :Token, :RemoteToken, :Topics, :CreatorId, :PluginID, :Options)`

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

	// not all fields can be updated.
	query := `UPDATE RemoteClusters
			SET Token = :Token,
			RemoteTeamId = :RemoteTeamId,
			CreateAt = :CreateAt,
			LastPingAt = :LastPingAt,
			RemoteToken = :RemoteToken,
			CreatorId = :CreatorId,
			DisplayName = :DisplayName,
			SiteURL = :SiteURL,
			Topics = :Topics,
			PluginID = :PluginID,
			Options = :Options
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
		Select(remoteClusterFields("")...).
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

func (s sqlRemoteClusterStore) GetByPluginID(pluginID string) (*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select(remoteClusterFields("")...).
		From("RemoteClusters").
		Where(sq.Eq{"PluginID": pluginID})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_get_by_pluginid_tosql")
	}

	var rc model.RemoteCluster
	if err := s.GetReplicaX().Get(&rc, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find RemoteCluster by plugin_id")
	}
	return &rc, nil
}

func (s sqlRemoteClusterStore) GetAll(filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select(remoteClusterFields("rc")...).
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

	if filter.PluginID != "" {
		query = query.Where(sq.Eq{"rc.PluginID": filter.PluginID})
	}

	if filter.RequireOptions != 0 {
		query = query.Where(sq.NotEq{fmt.Sprintf("(rc.Options & %d)", filter.RequireOptions): 0})
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
