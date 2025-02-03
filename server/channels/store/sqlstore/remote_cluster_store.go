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
		prefix + "DefaultTeamId",
		prefix + "CreateAt",
		prefix + "DeleteAt",
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
				(RemoteId, RemoteTeamId, Name, DisplayName, SiteURL, DefaultTeamId, CreateAt,
                DeleteAt, LastPingAt, Token, RemoteToken, Topics, CreatorId, PluginID, Options)
				VALUES
				(:RemoteId, :RemoteTeamId, :Name, :DisplayName, :SiteURL, :DefaultTeamId, :CreateAt,
				:DeleteAt, :LastPingAt, :Token, :RemoteToken, :Topics, :CreatorId, :PluginID, :Options)`

	if _, err := s.GetMaster().NamedExec(query, remoteCluster); err != nil {
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
            DeleteAt = :DeleteAt,
			LastPingAt = :LastPingAt,
			RemoteToken = :RemoteToken,
			CreatorId = :CreatorId,
			DisplayName = :DisplayName,
			SiteURL = :SiteURL,
			DefaultTeamId = :DefaultTeamId,
			Topics = :Topics,
			PluginID = :PluginID,
			Options = :Options
			WHERE RemoteId = :RemoteId AND Name = :Name`

	if _, err := s.GetMaster().NamedExec(query, remoteCluster); err != nil {
		return nil, errors.Wrap(err, "failed to update RemoteCluster")
	}
	return remoteCluster, nil
}

func (s sqlRemoteClusterStore) Delete(remoteId string) (bool, error) {
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return false, errors.Wrap(err, "DeleteRemoteCluster: begin_transaction")
	}
	defer finalizeTransactionX(transaction, &err)

	curTime := model.GetMillis()

	// we delete the remote cluster itself
	squery, args, err := s.getQueryBuilder().
		Update("RemoteClusters").
		Set("DeleteAt", curTime).
		Where(sq.Eq{"RemoteId": remoteId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_remote_cluster_tosql")
	}

	result, err := transaction.Exec(squery, args...)
	if err != nil {
		return false, errors.Wrap(err, "failed to delete RemoteCluster")
	}

	// also remove the shared channel remotes for the cluster (if any)
	squery, args, err = s.getQueryBuilder().
		Update("SharedChannelRemotes").
		Set("UpdateAt", curTime).
		Set("DeleteAt", curTime).
		Where(sq.Eq{"RemoteId": remoteId}).
		ToSql()
	if err != nil {
		return false, errors.Wrap(err, "delete_shared_channel_remotes_for_remote_cluster_tosql")
	}

	if _, err = transaction.Exec(squery, args...); err != nil {
		return false, errors.Wrap(err, "failed to delete SharedChannelRemotes for RemoteCluster")
	}

	count, err := result.RowsAffected()
	if err != nil {
		return false, errors.Wrap(err, "failed to determine rows affected")
	}

	if err = transaction.Commit(); err != nil {
		return false, errors.Wrap(err, "commit_transaction")
	}

	return count > 0, nil
}

func (s sqlRemoteClusterStore) Get(remoteId string, includeDeleted bool) (*model.RemoteCluster, error) {
	query := s.getQueryBuilder().
		Select(remoteClusterFields("")...).
		From("RemoteClusters").
		Where(sq.Eq{"RemoteId": remoteId})

	if !includeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_get_tosql")
	}

	var rc model.RemoteCluster
	if err := s.GetReplica().Get(&rc, queryString, args...); err != nil {
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
	if err := s.GetReplica().Get(&rc, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find RemoteCluster by plugin_id")
	}
	return &rc, nil
}

func (s sqlRemoteClusterStore) GetAll(offset, limit int, filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, error) {
	if offset < 0 {
		return nil, errors.New("offset must be a positive integer")
	}
	if limit < 0 {
		return nil, errors.New("limit must be a positive integer")
	}

	query := s.getQueryBuilder().
		Select(remoteClusterFields("rc")...).
		From("RemoteClusters rc").
		OrderBy("rc.DisplayName, rc.Name")

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

	if filter.OnlyPlugins {
		query = query.Where(sq.NotEq{"rc.PluginID": ""})
	}

	if filter.ExcludePlugins {
		query = query.Where(sq.Eq{"rc.PluginID": ""})
	}

	if filter.RequireOptions != 0 {
		query = query.Where(sq.NotEq{fmt.Sprintf("(rc.Options & %d)", filter.RequireOptions): 0})
	}

	if !filter.IncludeDeleted {
		query = query.Where(sq.Eq{"DeleteAt": 0})
	}

	if filter.Topic != "" {
		trimmed := strings.TrimSpace(filter.Topic)
		if trimmed == "" || trimmed == "*" {
			return nil, errors.New("invalid topic")
		}
		queryTopic := fmt.Sprintf("%% %s %%", trimmed)
		query = query.Where(sq.Or{sq.Like{"rc.Topics": queryTopic}, sq.Eq{"rc.Topics": "*"}})
	}

	query = query.Offset(uint64(offset)).Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "remote_cluster_getall_tosql")
	}

	list := []*model.RemoteCluster{}
	if err := s.GetReplica().Select(&list, queryString, args...); err != nil {
		return nil, errors.Wrapf(err, "failed to find RemoteClusters")
	}
	return list, nil
}

func (s sqlRemoteClusterStore) UpdateTopics(remoteClusterid string, topics string) (*model.RemoteCluster, error) {
	rc, err := s.Get(remoteClusterid, false)
	if err != nil {
		return nil, err
	}
	rc.Topics = topics

	rc.PreUpdate()

	query := `UPDATE RemoteClusters
			  SET Topics = :Topics
			  WHERE	RemoteId = :RemoteId`

	if _, err = s.GetMaster().NamedExec(query, rc); err != nil {
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

	if _, err := s.GetMaster().Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to update RemoteCluster")
	}
	return nil
}
