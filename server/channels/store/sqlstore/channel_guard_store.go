// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlChannelGuardStore struct {
	*SqlStore

	channelGuardSelectQuery sq.SelectBuilder
}

func newSqlChannelGuardStore(sqlStore *SqlStore) store.ChannelGuardStore {
	s := &SqlChannelGuardStore{SqlStore: sqlStore}

	s.channelGuardSelectQuery = s.getQueryBuilder().
		Select("ChannelId", "PluginId", "CreatedAt").
		From("ChannelGuards")

	return s
}

func (s *SqlChannelGuardStore) Save(rctx request.CTX, guard *store.ChannelGuard) error {
	builder := s.getQueryBuilder().
		Insert("ChannelGuards").
		Columns("ChannelId", "PluginId", "CreatedAt").
		Values(guard.ChannelId, guard.PluginId, guard.CreatedAt).
		SuffixExpr(sq.Expr("ON CONFLICT (ChannelId, PluginId) DO NOTHING"))

	if _, err := s.GetMaster().ExecBuilder(builder); err != nil {
		return errors.Wrapf(err, "failed to save channel guard for channel=%s plugin=%s", guard.ChannelId, guard.PluginId)
	}

	return nil
}

func (s *SqlChannelGuardStore) Delete(rctx request.CTX, channelID, pluginID string) (int64, error) {
	builder := s.getQueryBuilder().
		Delete("ChannelGuards").
		Where(sq.Eq{
			"ChannelId": channelID,
			"PluginId":  pluginID,
		})

	result, err := s.GetMaster().ExecBuilder(builder)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to delete channel guard for channel=%s plugin=%s", channelID, pluginID)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrapf(err, "failed to get rows affected for channel guard delete channel=%s plugin=%s", channelID, pluginID)
	}

	return rowsAffected, nil
}

func (s *SqlChannelGuardStore) GetForChannel(rctx request.CTX, channelID string) ([]*store.ChannelGuard, error) {
	query := s.channelGuardSelectQuery.Where(sq.Eq{"ChannelId": channelID})

	guards := []*store.ChannelGuard{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&guards, query); err != nil {
		return nil, errors.Wrapf(err, "failed to get channel guards for channel=%s", channelID)
	}

	return guards, nil
}

func (s *SqlChannelGuardStore) GetAll(rctx request.CTX) ([]*store.ChannelGuard, error) {
	guards := []*store.ChannelGuard{}
	if err := s.DBXFromContext(rctx.Context()).SelectBuilder(&guards, s.channelGuardSelectQuery); err != nil {
		return nil, errors.Wrap(err, "failed to get all channel guards")
	}

	return guards, nil
}
