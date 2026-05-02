// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelGuardStore struct {
	*SqlStore
}

func newSqlChannelGuardStore(sqlStore *SqlStore) store.ChannelGuardStore {
	return &SqlChannelGuardStore{SqlStore: sqlStore}
}

func (s *SqlChannelGuardStore) Save(guard *store.ChannelGuard) error {
	builder := s.getQueryBuilder().
		Insert("ChannelGuards").
		Columns("ChannelId", "PluginId", "CreatedAt").
		Values(guard.ChannelId, guard.PluginId, guard.CreatedAt).
		SuffixExpr(sq.Expr("ON CONFLICT (ChannelId, PluginId) DO NOTHING"))

	query, args, err := builder.ToSql()
	if err != nil {
		return errors.Wrap(err, "save_channel_guard_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to save channel guard for channel=%s plugin=%s", guard.ChannelId, guard.PluginId)
	}

	return nil
}

func (s *SqlChannelGuardStore) Delete(channelID, pluginID string) error {
	builder := s.getQueryBuilder().
		Delete("ChannelGuards").
		Where(sq.Eq{
			"ChannelId": channelID,
			"PluginId":  pluginID,
		})

	query, args, err := builder.ToSql()
	if err != nil {
		return errors.Wrap(err, "delete_channel_guard_tosql")
	}

	if _, err := s.GetMaster().Exec(query, args...); err != nil {
		return errors.Wrapf(err, "failed to delete channel guard for channel=%s plugin=%s", channelID, pluginID)
	}

	return nil
}

func (s *SqlChannelGuardStore) GetForChannel(channelID string) ([]*store.ChannelGuard, error) {
	builder := s.getQueryBuilder().
		Select("ChannelId", "PluginId", "CreatedAt").
		From("ChannelGuards").
		Where(sq.Eq{"ChannelId": channelID})

	// Read from master is intentional, it's called after a write.
	guards := []*store.ChannelGuard{}
	if err := s.GetMaster().SelectBuilder(&guards, builder); err != nil {
		return nil, errors.Wrapf(err, "failed to get channel guards for channel=%s", channelID)
	}

	return guards, nil
}

func (s *SqlChannelGuardStore) GetAll() ([]*store.ChannelGuard, error) {
	builder := s.getQueryBuilder().
		Select("ChannelId", "PluginId", "CreatedAt").
		From("ChannelGuards")

	// Read from master is intentional, it's called after a write.
	guards := []*store.ChannelGuard{}
	if err := s.GetMaster().SelectBuilder(&guards, builder); err != nil {
		return nil, errors.Wrap(err, "failed to get all channel guards")
	}

	return guards, nil
}
